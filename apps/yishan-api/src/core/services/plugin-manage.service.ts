import { PluginRepository } from '../repositories/plugin.repository.js'
import { ResourceErrorCode } from '../../constants/business-codes/resource.js'
import { BusinessError } from '../../exceptions/business-error.js'
import { HookEmitReport, PluginRuntime } from '../../core/plugin-platform/index.js'
import { RegisteredPlugin } from '../../core/plugin-platform/types.js'
import { PersistedPluginRuntimeState } from '../../core/plugin-platform/persistence.js'
import { PluginMenuSyncService, type SyncStrategy, type ConflictDetail } from './plugin-menu-sync.service.js'
import { invalidateGlobalCatalog, initGlobalCatalog } from './permission-catalog.service.js'

export interface PluginMenuItemResponse {
  name: string
  path: string
  permissionCodes: string[]
}

export interface PluginSyncStatus {
  strategy: string
  status: string
  created: number
  updated: number
  skipped: number
  conflicted: number
  conflictDetails: ConflictDetail[]
  lastSyncAt: string | null
}

export interface PluginManageItem {
  pluginId?: string
  name: string
  version: string
  state: string
  enabled: boolean
  coreCompatibility?: string
  lastError?: string
  updatedAt?: string
  menus?: PluginMenuItemResponse[]
  syncStatus?: PluginSyncStatus | null
}

/**
 * 插件启停操作需要持久化事实 — 用于补偿、回滚取证。
 */
interface PersistedSnapshot {
  enabled: boolean
  state: PersistedPluginRuntimeState['lifecycleState']
}

export class PluginManageService {
  constructor(
    private readonly runtime: PluginRuntime,
    private readonly logger: { error: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void } = console as unknown as {
      error: (obj: unknown, msg?: string) => void
      warn: (obj: unknown, msg?: string) => void
    },
  ) {}

  async listPlugins(): Promise<PluginManageItem[]> {
    const dbStates = await this.runtime.persistence.listRuntimeStates()
    const dbMap = new Map(dbStates.map((item) => [item.name, item]))
    const runtimePlugins = this.runtime.registry.list()
    const names = new Set<string>([
      ...runtimePlugins.map((item) => item.manifest.name),
      ...dbStates.map((item) => item.name)
    ])

    const items = await Promise.all(
      Array.from(names).map((name) => {
        const runtimePlugin = this.runtime.registry.get(name)
        const dbState = dbMap.get(name)
        return this.mergePluginState(name, runtimePlugin, dbState)
      })
    )
    return items.sort((a, b) => a.name.localeCompare(b.name))
  }

  async getPlugin(name: string): Promise<PluginManageItem> {
    const runtimePlugin = this.runtime.registry.get(name)
    const dbState = await this.runtime.persistence.getRuntimeState(name)

    if (!runtimePlugin && !dbState) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_NOT_FOUND, `插件不存在: ${name}`)
    }

    return this.mergePluginState(name, runtimePlugin, dbState)
  }

  /**
   * 启用插件 — 固定顺序：
   *   1. 严格写数据库 (enabled=true)
   *   2. runtime.lifecycle.enable(name)
   *   3. 菜单同步
   *   4. 严格重建 Catalog
   *
   * 步骤 2/3/4 任意失败都会基于“原始持久化状态”执行补偿；
   * 补偿失败仅记录 error 日志并向上抛业务错误，调用方必须感知失败。
   */
  async enablePlugin(name: string, strategy: SyncStrategy = 'safe'): Promise<PluginManageItem> {
    const runtimePlugin = this.runtime.registry.get(name)
    if (!runtimePlugin) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_NOT_FOUND, `插件不存在: ${name}`)
    }

    const pluginId = runtimePlugin.manifest.pluginId
    // 必须在任何写入和副作用之前取证。后续 DB 已写为 enabled 时再读取，
    // 读到的将是新状态，无法用于回滚。
    const originalSnapshot = await this.readOriginalSnapshot(pluginId, name)

    // 1) 严格写数据库（持久化为唯一事实）
    await this.runtime.persistence.updateRuntimeStateStrict(
      pluginId,
      name,
      'enabled',
      true,
    )

    try {
      // 2) 启动 runtime
      this.runtime.lifecycle.enable(name)
      // 3) 菜单同步
      await this.performMenuSync(runtimePlugin, strategy)
      // 4) 严格重建 Catalog
      await this.rebuildCatalogStrict()
    } catch (error) {
      await this.rollbackEnable(pluginId, name, runtimePlugin, originalSnapshot, error)
      throw error
    }

    return this.getPlugin(name)
  }

  async syncPlugin(name: string, strategy: SyncStrategy = 'safe'): Promise<PluginManageItem> {
    const runtimePlugin = this.runtime.registry.get(name)
    if (!runtimePlugin) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_NOT_FOUND, `插件不存在: ${name}`)
    }

    // 菜单同步同样属于状态敏感副作用，必须以数据库事实为准，不能回退内存状态。
    const dbState = await this.runtime.persistence.getRuntimeStateStrict(
      runtimePlugin.manifest.pluginId,
      name,
    )
    if (!dbState?.enabled) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_STATUS_ERROR, `插件未启用，无法同步菜单: ${name}`)
    }

    await this.performMenuSync(runtimePlugin, strategy)

    // 同步后失效并重新构建权限目录（菜单可能关联权限变化）
    await this.rebuildCatalogStrict()

    return this.getPlugin(name)
  }

  /**
   * 同步菜单。失败时只抛业务错误，由调用方决定是否补偿。
   *
   * 不在此方法修改 lifecycle 或持久化状态：它既被启停事务调用，也被独立
   * sync 调用；在这里吞写入失败会破坏“DB 成功后才执行副作用”的边界。
   */
  private async performMenuSync(runtimePlugin: RegisteredPlugin, strategy: SyncStrategy) {
    const pluginId = runtimePlugin.manifest.pluginId

    const menuSync = new PluginMenuSyncService()
    let syncResult: Awaited<ReturnType<typeof menuSync.syncPluginMenus>>

    try {
      syncResult = await menuSync.syncPluginMenus(runtimePlugin.manifest, 1, strategy)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new BusinessError(ResourceErrorCode.RESOURCE_STATUS_ERROR, `菜单同步失败: ${msg}`)
    }

    let pluginInstallId: number | undefined
    try {
      const pluginInstall = await this.getPluginInstallRecord(pluginId, runtimePlugin.manifest.name)
      if (pluginInstall) {
        pluginInstallId = pluginInstall.id
        await menuSync.saveSyncAudit(pluginInstall.id, strategy, syncResult)
        await PluginRepository.updateInstallStrategy(pluginInstall.id, strategy)
      }
    } catch {
      // non-fatal: sync audit should not block plugin enable
    }

    if (syncResult.status === 'failed' || (strategy === 'strict' && syncResult.conflicted > 0)) {
      const errorMsg = syncResult.errors.join('; ') || `strict 策略下存在 ${syncResult.conflicted} 个冲突`
      if (pluginInstallId) {
        await PluginRepository.updateInstallError(pluginInstallId, errorMsg)
      }
      throw new BusinessError(ResourceErrorCode.RESOURCE_STATUS_ERROR, `菜单同步冲突: ${errorMsg}`)
    }
  }

  /**
   * 禁用插件 — 固定顺序：
   *   1. 严格写数据库 (enabled=false)
   *   2. runtime.lifecycle.disable(name)
   *   3. 隐藏菜单
   *   4. 严格重建 Catalog
   */
  async disablePlugin(name: string): Promise<PluginManageItem> {
    const runtimePlugin = this.runtime.registry.get(name)
    if (!runtimePlugin) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_NOT_FOUND, `插件不存在: ${name}`)
    }

    const pluginId = runtimePlugin.manifest.pluginId
    // 与 enable 相同：必须在严格写入前取证，失败补偿才有真实旧状态。
    const originalSnapshot = await this.readOriginalSnapshot(pluginId, name)

    // 1) 严格写数据库
    await this.runtime.persistence.updateRuntimeStateStrict(
      pluginId,
      name,
      'disabled',
      false,
    )

    try {
      // 2) runtime 切到 disabled
      this.runtime.lifecycle.disable(name)
      // 3) 隐藏菜单
      const menuSync = new PluginMenuSyncService()
      await menuSync.hidePluginMenus(pluginId)
      // 4) 重建 Catalog
      await this.rebuildCatalogStrict()
    } catch (error) {
      await this.rollbackDisable(pluginId, name, runtimePlugin, originalSnapshot, error)
      throw error
    }

    return this.getPlugin(name)
  }

  async getSyncLogs(name: string, limit = 10) {
    const runtimePlugin = this.runtime.registry.get(name)
    if (!runtimePlugin) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_NOT_FOUND, `插件不存在: ${name}`)
    }
    const pluginInstall = await this.getPluginInstallRecord(runtimePlugin.manifest.pluginId, name)
    if (!pluginInstall) {
      return []
    }
    const menuSync = new PluginMenuSyncService()
    return menuSync.getSyncLogs(pluginInstall.id, limit)
  }

  getHookReports(limit = 50): HookEmitReport[] {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 50
    const reports = this.runtime.hooks.getExecutionReports()
    return reports.slice(-normalizedLimit).reverse()
  }

  // -------------------------------------------------------------------------
  // 补偿路径（私有）
  // -------------------------------------------------------------------------

  /**
   * 读取补偿所需的原始持久化状态。**只使用 strict reader**，绝不依赖内存 fallback。
   * 数据库读取失败时抛业务错误，绝不猜测默认 enabled。
   */
  private async readOriginalSnapshot(pluginId: string, name: string): Promise<PersistedSnapshot> {
    const original = await this.runtime.persistence.getRuntimeStateStrict(pluginId, name)
    if (!original) {
      throw new BusinessError(
        ResourceErrorCode.RESOURCE_NOT_FOUND,
        `插件 ${name} 缺少持久化记录，无法完成补偿`,
      )
    }
    return {
      enabled: original.enabled,
      state: original.lifecycleState,
    }
  }

  /**
   * 启用流程失败后的补偿：基于原始持久化状态恢复。
   */
  private async rollbackEnable(
    pluginId: string,
    name: string,
    runtimePlugin: RegisteredPlugin,
    snapshot: PersistedSnapshot,
    cause: unknown,
  ): Promise<void> {
    try {
      // 1) runtime 切回原状态
      if (snapshot.state && runtimePlugin.state !== snapshot.state) {
        try {
          this.runtime.lifecycle.transition(name, snapshot.state)
        } catch (transitionErr) {
          this.logger.warn(
            { plugin: name, error: (transitionErr as Error).message },
            'plugin enable rollback: lifecycle transition refused, continuing',
          )
        }
      }
      // 2) DB 写回原状态（仍使用 strict write，但容忍失败并记 error 日志）
      try {
        await this.runtime.persistence.updateRuntimeStateStrict(
          pluginId,
          name,
          snapshot.state,
          snapshot.enabled,
        )
      } catch (writeErr) {
        this.logger.error(
          { plugin: name, error: (writeErr as Error).message },
          'plugin enable rollback: strict state restore failed',
        )
      }
      // 3) 隐藏/恢复菜单：原状态非 enabled 时隐藏；不强制（失败仅日志）
      try {
        const menuSync = new PluginMenuSyncService()
        if (!snapshot.enabled) {
          await menuSync.hidePluginMenus(pluginId)
        } else {
          await menuSync.restorePluginMenus(pluginId)
        }
      } catch (menuErr) {
        this.logger.warn(
          { plugin: name, error: (menuErr as Error).message },
          'plugin enable rollback: menu restore skipped',
        )
      }
      await this.rebuildCatalogAfterRollback(name)
    } finally {
      this.logger.error(
        { plugin: name, error: (cause as Error)?.message ?? String(cause) },
        'plugin enable failed and rolled back',
      )
    }
  }

  /**
   * 禁用流程失败后的补偿：恢复操作前取得的原始持久化状态。
   */
  private async rollbackDisable(
    pluginId: string,
    name: string,
    runtimePlugin: RegisteredPlugin,
    snapshot: PersistedSnapshot,
    cause: unknown,
  ): Promise<void> {
    try {
      // runtime 恢复原状态
      try {
        if (runtimePlugin.state !== snapshot.state) {
          this.runtime.lifecycle.transition(name, snapshot.state)
        }
      } catch (transitionErr) {
        this.logger.warn(
          { plugin: name, error: (transitionErr as Error).message },
          'plugin disable rollback: lifecycle transition refused, continuing',
        )
      }
      // DB 写回原状态（strict 失败仅记录 error，原请求仍失败）
      try {
        await this.runtime.persistence.updateRuntimeStateStrict(
          pluginId,
          name,
          snapshot.state,
          snapshot.enabled,
        )
      } catch (writeErr) {
        this.logger.error(
          { plugin: name, error: (writeErr as Error).message },
          'plugin disable rollback: strict state restore failed',
        )
      }
      // 菜单恢复原状态（失败仅日志）
      try {
        const menuSync = new PluginMenuSyncService()
        if (snapshot.enabled) {
          await menuSync.restorePluginMenus(pluginId)
        } else {
          await menuSync.hidePluginMenus(pluginId)
        }
      } catch (menuErr) {
        this.logger.warn(
          { plugin: name, error: (menuErr as Error).message },
          'plugin disable rollback: menu hide skipped',
        )
      }
      await this.rebuildCatalogAfterRollback(name)
    } finally {
      this.logger.error(
        { plugin: name, error: (cause as Error)?.message ?? String(cause) },
        'plugin disable failed and rolled back',
      )
    }
  }

  /**
   * 严格重建 Catalog：先失效再基于 strict reader 重新初始化。
   * 失败时不得吞错。
   */
  private async rebuildCatalogStrict(): Promise<void> {
    await invalidateGlobalCatalog()
    await initGlobalCatalog(
      () => this.runtime.persistence.listPluginStatesStrict(),
      { listManifests: () => this.runtime.registry.list().map(p => p.manifest) }
    )
  }

  /** 补偿后刷新 Catalog；失败只能记录，不能掩盖原始操作失败。 */
  private async rebuildCatalogAfterRollback(name: string): Promise<void> {
    try {
      await this.rebuildCatalogStrict()
    } catch (catalogErr) {
      this.logger.error(
        { plugin: name, error: (catalogErr as Error).message },
        'plugin rollback: catalog rebuild failed',
      )
    }
  }

  private async getPluginInstallRecord(pluginId?: string, pluginName?: string) {
    return await PluginRepository.findInstallWithLatestLog(pluginId, pluginName)
  }

  private async mergePluginState(
    name: string,
    runtimePlugin?: RegisteredPlugin,
    dbState?: PersistedPluginRuntimeState | null
  ): Promise<PluginManageItem> {
    const enabled = dbState?.enabled ?? runtimePlugin?.state === 'enabled'
    const pluginId = runtimePlugin?.manifest.pluginId ?? dbState?.pluginId
    const item: PluginManageItem = {
      pluginId,
      name,
      version: runtimePlugin?.manifest.version ?? dbState?.version ?? '',
      state: runtimePlugin?.state ?? dbState?.lifecycleState ?? 'discovered',
      enabled,
      coreCompatibility: runtimePlugin?.manifest.coreCompatibility ?? dbState?.coreCompatibility,
      lastError: runtimePlugin?.error ?? dbState?.lastError,
      updatedAt: dbState?.updatedAt?.toISOString?.(),
      menus: enabled ? (runtimePlugin?.manifest.menus ?? []).map(m => ({
        name: m.name,
        path: m.path,
        permissionCodes: m.permissionCodes ?? []
      })) : [],
      syncStatus: null,
    }

    try {
      const pluginInstall = await this.getPluginInstallRecord(pluginId, name)
      if (pluginInstall && pluginInstall.syncLogs.length > 0) {
        const latestLog = pluginInstall.syncLogs[0]
        item.syncStatus = {
          strategy: latestLog.strategy,
          status: latestLog.status,
          created: latestLog.created,
          updated: latestLog.updated,
          skipped: latestLog.skipped,
          conflicted: latestLog.conflicted,
          conflictDetails: (latestLog.conflictDetails as any) ?? [],
          lastSyncAt: latestLog.createdAt.toISOString(),
        }
      }
    } catch {
      // non-fatal: sync status should not block plugin list
    }

    return item
  }
}
