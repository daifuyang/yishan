import { ResourceErrorCode } from '../../constants/business-codes/resource.js'
import { BusinessError } from '../../exceptions/business-error.js'
import { HookEmitReport, PluginRuntime } from '../../plugins-runtime/index.js'
import { RegisteredPlugin } from '../../plugins-runtime/types.js'
import { PersistedPluginRuntimeState } from '../../plugins-runtime/persistence.js'
import { PluginMenuSyncService, type SyncStrategy, type ConflictDetail } from './plugin-menu-sync.service.js'

export interface PluginMenuItemResponse {
  name: string
  path: string
  perm?: string
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

export class PluginManageService {
  constructor(private readonly runtime: PluginRuntime) {}

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

  async enablePlugin(name: string, strategy: SyncStrategy = 'safe'): Promise<PluginManageItem> {
    const runtimePlugin = this.runtime.registry.get(name)
    if (!runtimePlugin) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_NOT_FOUND, `插件不存在: ${name}`)
    }

    const pluginId = runtimePlugin.manifest.pluginId
    this.runtime.lifecycle.enable(name)
    await this.runtime.persistence.updateRuntimeState(pluginId, name, 'enabled', true)

    await this.performMenuSync(runtimePlugin, strategy)

    return this.getPlugin(name)
  }

  async syncPlugin(name: string, strategy: SyncStrategy = 'safe'): Promise<PluginManageItem> {
    const runtimePlugin = this.runtime.registry.get(name)
    if (!runtimePlugin) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_NOT_FOUND, `插件不存在: ${name}`)
    }

    const dbState = await this.runtime.persistence.getRuntimeState(name)
    const isEnabled = dbState?.enabled ?? runtimePlugin.state === 'enabled'
    if (!isEnabled) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_STATUS_ERROR, `插件未启用，无法同步菜单: ${name}`)
    }

    await this.performMenuSync(runtimePlugin, strategy)

    return this.getPlugin(name)
  }

  private async performMenuSync(runtimePlugin: RegisteredPlugin, strategy: SyncStrategy) {
    const pluginId = runtimePlugin.manifest.pluginId
    const name = runtimePlugin.manifest.name

    const menuSync = new PluginMenuSyncService()
    let syncResult: Awaited<ReturnType<typeof menuSync.syncPluginMenus>>

    try {
      syncResult = await menuSync.syncPluginMenus(runtimePlugin.manifest, 1, strategy)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.runtime.lifecycle.transition(name, 'error', `菜单同步异常: ${msg}`)
      await this.runtime.persistence.updateRuntimeState(pluginId, name, 'error', true, `菜单同步异常: ${msg}`)
      throw new BusinessError(ResourceErrorCode.RESOURCE_STATUS_ERROR, `菜单同步失败: ${msg}`)
    }

    let pluginInstallId: number | undefined
    try {
      const pluginInstall = await this.getPluginInstallRecord(pluginId, runtimePlugin.manifest.name)
      if (pluginInstall) {
        pluginInstallId = pluginInstall.id
        await menuSync.saveSyncAudit(pluginInstall.id, strategy, syncResult)
        await this.prisma.sysPluginInstall.update({
          where: { id: pluginInstall.id },
          data: { syncStrategy: strategy },
        })
      }
    } catch {
      // non-fatal: sync audit should not block plugin enable
    }

    if (syncResult.status === 'failed' || (strategy === 'strict' && syncResult.conflicted > 0)) {
      const errorMsg = syncResult.errors.join('; ') || `strict 策略下存在 ${syncResult.conflicted} 个冲突`
      this.runtime.lifecycle.transition(name, 'error', errorMsg)
      await this.runtime.persistence.updateRuntimeState(pluginId, name, 'error', true, errorMsg)
      await this.updatePluginInstallError(pluginInstallId, errorMsg)
      throw new BusinessError(ResourceErrorCode.RESOURCE_STATUS_ERROR, `菜单同步冲突: ${errorMsg}`)
    }
  }

  async disablePlugin(name: string): Promise<PluginManageItem> {
    const runtimePlugin = this.runtime.registry.get(name)
    if (!runtimePlugin) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_NOT_FOUND, `插件不存在: ${name}`)
    }

    const pluginId = runtimePlugin.manifest.pluginId
    this.runtime.lifecycle.disable(name)
    await this.runtime.persistence.updateRuntimeState(pluginId, name, 'disabled', false)

    try {
      const menuSync = new PluginMenuSyncService()
      await menuSync.hidePluginMenus(pluginId)
    } catch {
      // non-fatal: menu hide should not block plugin disable
    }

    return this.getPlugin(name)
  }

  async getSyncLogs(name: string, limit = 10) {
    const runtimePlugin = this.runtime.registry.get(name)
    if (!runtimePlugin) {
      throw new BusinessError(ResourceErrorCode.RESOURCE_NOT_FOUND, `插件不存在: ${name}`)
    }
    const pluginInstall = await this.getPluginInstallRecord(name)
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

  private get prisma() {
    const { prismaManager } = require('../../utils/prisma.js')
    return prismaManager.getClient()
  }

  private async getPluginInstallRecord(pluginId?: string, pluginName?: string) {
    let plugin = null
    if (pluginId) {
      plugin = await this.prisma.sysPlugin.findFirst({
        where: { pluginId },
        include: { installs: { include: { syncLogs: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
      })
    }
    if (!plugin && pluginName) {
      plugin = await this.prisma.sysPlugin.findFirst({
        where: { name: pluginName },
        include: { installs: { include: { syncLogs: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
      })
    }
    if (!plugin || plugin.installs.length === 0) return null
    return plugin.installs[0]
  }

  private async updatePluginInstallError(installId: number | undefined, error: string) {
    if (!installId) return
    await this.prisma.sysPluginInstall.update({
      where: { id: installId },
      data: { lastError: error },
    })
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
        perm: m.perm
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
