import { eq, sql } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { sysPlugin, sysPluginInstall, sysPluginVersion } from '@/db/schema'
import { PluginLifecycleState, PluginManifest, PluginPersistenceRecord } from './types'

/**
 * 插件状态快照，用于权限目录缓存版本管理。
 * 不依赖固定版本号，使用 enabled + updatedAt 指纹实现多实例最终一致。
 */
export interface PluginStateSnapshot {
  pluginId: string;
  enabled: boolean;
  updatedAt: string | null;
}

/**
 * 插件状态读取器接口，供 PermissionCatalogService 使用。
 * 从数据库读取持久化的插件启用状态。
 * @deprecated 已改为使用函数式接口 () => Promise<PluginStateSnapshot[]>
 */
export interface PluginStateReader {
  /** 返回 pluginId -> { enabled, updatedAt } 的快照数组；数据来自数据库。 */
  listPluginStates(): Promise<PluginStateSnapshot[]>;
}

type PluginClient = typeof drizzleDb

export interface PersistedPluginRuntimeState {
  pluginId?: string
  name: string
  version: string
  coreCompatibility?: string
  lifecycleState: PluginLifecycleState
  enabled: boolean
  lastError?: string
  updatedAt?: Date
}

function mapManifestToRecord(manifest: PluginManifest): PluginPersistenceRecord {
  return {
    pluginId: manifest.pluginId,
    name: manifest.name,
    version: manifest.version,
    coreCompatibility: manifest.coreCompatibility,
    compatRange: manifest.compatRange,
    routeBase: manifest.routeBase,
    lifecycleState: 'discovered',
    enabled: false
  }
}

function runtimeColumns() {
  return {
    pluginId: true,
    name: true,
    currentVersion: true,
    coreCompatibility: true,
    lifecycleState: true,
    enabled: true,
    lastError: true,
    updatedAt: true
  } as const
}

export class PluginPersistenceRepository {
  constructor(private readonly client: PluginClient = drizzleDb) {}

  async upsertManifest(manifest: PluginManifest): Promise<void> {
    const data = mapManifestToRecord(manifest)
    const now = new Date()

    let plugin = await this.client.query.sysPlugin.findFirst({
      where: eq(sysPlugin.pluginId, data.pluginId)
    })

    if (!plugin && data.name) {
      plugin = await this.client.query.sysPlugin.findFirst({
        where: eq(sysPlugin.name, data.name)
      })
    }

    if (plugin) {
      await this.client.update(sysPlugin)
        .set({
          pluginId: data.pluginId,
          name: data.name,
          currentVersion: data.version,
          coreCompatibility: data.coreCompatibility,
          compatRange: data.compatRange,
          routeBase: data.routeBase,
          lastSyncedAt: now
        })
        .where(eq(sysPlugin.id, plugin.id))
    } else {
      const [created] = await this.client.insert(sysPlugin).values({
        pluginId: data.pluginId,
        name: data.name,
        currentVersion: data.version,
        coreCompatibility: data.coreCompatibility,
        compatRange: data.compatRange,
        routeBase: data.routeBase,
        lifecycleState: data.lifecycleState,
        enabled: data.enabled,
        installedAt: now,
        lastSyncedAt: now
      }).$returningId()
      plugin = { id: created.id } as any
    }

    if (!plugin) throw new Error('Failed to resolve plugin persistence row')
    const pluginId = plugin.id

    await this.client.insert(sysPluginVersion).values({
      pluginId,
      version: manifest.version,
      manifest: manifest as unknown as object
    }).onDuplicateKeyUpdate({
      set: {
        manifest: sql`VALUES(manifest)`
      }
    })

    await this.client.insert(sysPluginInstall).values({
      pluginId,
      lifecycleState: data.lifecycleState,
      enabled: data.enabled,
      installedAt: now
    }).onDuplicateKeyUpdate({
      set: {
        lifecycleState: sql`VALUES(lifecycle_state)`,
        enabled: sql`VALUES(enabled)`,
        lastError: null
      }
    })
  }

  async updateRuntimeState(pluginId: string, name: string, state: PluginLifecycleState, enabled: boolean, error?: string): Promise<void> {
    let plugin = await this.client.query.sysPlugin.findFirst({
      where: eq(sysPlugin.pluginId, pluginId),
      columns: { id: true }
    })

    if (!plugin && name) {
      plugin = await this.client.query.sysPlugin.findFirst({
        where: eq(sysPlugin.name, name),
        columns: { id: true }
      })
    }

    if (!plugin) {
      return
    }

    const dbPluginId = plugin.id

    await this.client.update(sysPlugin)
      .set({
        lifecycleState: state,
        enabled,
        lastError: error,
        lastSyncedAt: new Date()
      })
      .where(eq(sysPlugin.id, dbPluginId))

    await this.client.insert(sysPluginInstall).values({
      pluginId: dbPluginId,
      lifecycleState: state,
      enabled,
      installedAt: new Date(),
      lastError: error
    }).onDuplicateKeyUpdate({
      set: {
        lifecycleState: sql`VALUES(lifecycle_state)`,
        enabled: sql`VALUES(enabled)`,
        lastError: sql`VALUES(last_error)`,
        uninstalledAt: state === 'unloaded' ? new Date() : null
      }
    })
  }

  async listRuntimeStates(): Promise<PersistedPluginRuntimeState[]> {
    const rows = await this.client.query.sysPlugin.findMany({
      columns: runtimeColumns()
    })

    return rows.map((row) => ({
      pluginId: row.pluginId ?? undefined,
      name: row.name ?? '',
      version: row.currentVersion,
      coreCompatibility: row.coreCompatibility ?? undefined,
      lifecycleState: row.lifecycleState as PluginLifecycleState,
      enabled: row.enabled,
      lastError: row.lastError ?? undefined,
      updatedAt: row.updatedAt
    }))
  }

  async getRuntimeState(pluginId: string, name?: string): Promise<PersistedPluginRuntimeState | null> {
    let row = await this.client.query.sysPlugin.findFirst({
      where: eq(sysPlugin.pluginId, pluginId),
      columns: runtimeColumns()
    })

    if (!row && name) {
      row = await this.client.query.sysPlugin.findFirst({
        where: eq(sysPlugin.name, name),
        columns: runtimeColumns()
      })
    }

    if (!row) {
      return null
    }

    return {
      pluginId: row.pluginId ?? undefined,
      name: row.name ?? '',
      version: row.currentVersion,
      coreCompatibility: row.coreCompatibility ?? undefined,
      lifecycleState: row.lifecycleState as PluginLifecycleState,
      enabled: row.enabled,
      lastError: row.lastError ?? undefined,
      updatedAt: row.updatedAt
    }
  }
}

export class PluginPersistenceService {
  private degraded = false
  private readonly memoryState = new Map<string, PluginPersistenceRecord>()

  constructor(
    private readonly repository: PluginPersistenceRepository,
    private readonly logger?: { warn: (obj: unknown, msg?: string) => void }
  ) {}

  isDegraded(): boolean {
    return this.degraded
  }

  getMemoryRecord(pluginId: string): PluginPersistenceRecord | undefined {
    return this.memoryState.get(pluginId)
  }

  /**
   * 实现 PluginStateReader 接口，供 PermissionCatalogService 使用。
   * 返回插件状态快照数组，使用 enabled + updatedAt 指纹实现多实例最终一致。
   * 注意：此方法在数据库读取失败时会降级返回内存状态，仅适用于管理页展示，
   * 不可作为授权目录的 reader。
   */
  async listPluginStates(): Promise<PluginStateSnapshot[]> {
    const states = await this.listRuntimeStates();
    return states
      .filter(state => state.pluginId)
      .map(state => ({
        pluginId: state.pluginId!,
        enabled: state.enabled,
        updatedAt: state.updatedAt ? state.updatedAt.toISOString() : null,
      }));
  }

  /**
   * 授权目录专用：只使用数据库事实状态，读取失败必须抛错。
   * 禁止内存降级；调用方据此拒绝授权。
   */
  async listPluginStatesStrict(): Promise<PluginStateSnapshot[]> {
    try {
      const states = await this.repository.listRuntimeStates();
      return states
        .filter(state => state.pluginId)
        .map(state => ({
          pluginId: state.pluginId!,
          enabled: state.enabled,
          updatedAt: state.updatedAt ? state.updatedAt.toISOString() : null,
        }));
    } catch (error) {
      this.markDegraded(error, 'strict plugin state read failed');
      throw error;
    }
  }

  async syncManifest(manifest: PluginManifest): Promise<void> {
    const record = mapManifestToRecord(manifest)
    this.memoryState.set(record.pluginId, record)

    try {
      await this.repository.upsertManifest(manifest)
    } catch (error) {
      this.markDegraded(error, 'sync manifest failed')
    }
  }

  /**
   * 兼容旧的非严格写入口；**禁止**用于插件启停流程。
   *
   * 仅供诊断、批量 reconcile 等非关键场景使用；调用方需要能够容忍数据库失败
   * 后内存状态与持久化状态不一致的情况。插件启用/禁用必须使用
   * {@link PluginPersistenceService.updateRuntimeStateStrict}。
   */
  async updateRuntimeState(
    pluginId: string,
    name: string,
    state: PluginLifecycleState,
    enabled: boolean,
    error?: string,
  ): Promise<void> {
    const current = this.memoryState.get(pluginId)
    if (current) {
      current.lifecycleState = state
      current.enabled = enabled
      current.lastError = error
    }

    try {
      await this.repository.updateRuntimeState(pluginId, name, state, enabled, error)
    } catch (persistError) {
      this.markDegraded(persistError, 'update runtime state failed')
    }
  }

  /**
   * 插件生命周期状态变更专用：直接写数据库，写失败必须抛错。
   *
   * 写入数据库成功后才允许更新 `memoryState`，失败时不允许把内存状态伪装为
   * 已持久化状态。`PluginManageService` 必须先调用本方法，DB 写入成功后再
   * 执行 runtime/menu 等副作用。
   */
  async updateRuntimeStateStrict(
    pluginId: string,
    name: string,
    state: PluginLifecycleState,
    enabled: boolean,
    error?: string,
  ): Promise<void> {
    try {
      await this.repository.updateRuntimeState(pluginId, name, state, enabled, error)
    } catch (cause) {
      this.markDegraded(cause, 'strict plugin runtime state write failed')
      throw cause
    }
    // DB 持久化成功后，再安全地同步内存视图（用于管理页显示与降级 fallback）。
    const current = this.memoryState.get(pluginId)
    if (current) {
      current.lifecycleState = state
      current.enabled = enabled
      current.lastError = error
    }
  }

  async listRuntimeStates(): Promise<PersistedPluginRuntimeState[]> {
    try {
      return await this.repository.listRuntimeStates()
    } catch (error) {
      this.markDegraded(error, 'list runtime states failed')
      return Array.from(this.memoryState.values()).map((item) => ({
        pluginId: item.pluginId,
        name: item.name,
        version: item.version,
        coreCompatibility: item.coreCompatibility,
        lifecycleState: item.lifecycleState,
        enabled: item.enabled,
        lastError: item.lastError
      }))
    }
  }

  async getRuntimeState(pluginId: string, name?: string): Promise<PersistedPluginRuntimeState | null> {
    try {
      const record = await this.repository.getRuntimeState(pluginId, name)
      if (record) {
        return record
      }
    } catch (error) {
      this.markDegraded(error, 'get runtime state failed')
    }

    const memoryRecord = this.memoryState.get(pluginId)
    if (!memoryRecord) {
      return null
    }

    return {
      pluginId: memoryRecord.pluginId,
      name: memoryRecord.name,
      version: memoryRecord.version,
      coreCompatibility: memoryRecord.coreCompatibility,
      lifecycleState: memoryRecord.lifecycleState,
      enabled: memoryRecord.enabled,
      lastError: memoryRecord.lastError
    }
  }

  /**
   * 严格按数据库读取单条运行时状态，失败必须抛错。
   *
   * 仅读取持久化事实状态，不调用任何 memory fallback；用于
   * `PluginManageService` 启停操作前的“原始状态取证”，
   * 以及需要确权业务依赖真实持久化数据的场景。
   *
   * 数据库无对应记录时返回 `null`；数据库读异常时抛错并标记 degraded。
   */
  async getRuntimeStateStrict(
    pluginId: string,
    name?: string,
  ): Promise<PersistedPluginRuntimeState | null> {
    try {
      return await this.repository.getRuntimeState(pluginId, name)
    } catch (cause) {
      this.markDegraded(cause, 'strict plugin state single read failed')
      throw cause
    }
  }

  private markDegraded(error: unknown, message: string): void {
    this.degraded = true
    if (this.logger) {
      this.logger.warn({ error: error instanceof Error ? error.message : error }, message)
    }
  }
}

export function createPluginPersistenceService(
  logger?: { warn: (obj: unknown, msg?: string) => void },
  repository?: PluginPersistenceRepository
): PluginPersistenceService {
  return new PluginPersistenceService(repository ?? new PluginPersistenceRepository(), logger)
}
