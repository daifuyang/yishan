import { prismaManager } from '../utils/prisma'
import { PluginLifecycleState, PluginManifest, PluginPersistenceRecord } from './types'

type PluginClient = ReturnType<typeof prismaManager.getClient>

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

export class PluginPersistenceRepository {
  constructor(private readonly client: PluginClient = prismaManager.getClient()) {}

  async upsertManifest(manifest: PluginManifest): Promise<void> {
    const data = mapManifestToRecord(manifest)

    let plugin = await this.client.sysPlugin.findFirst({
      where: { pluginId: data.pluginId }
    });

    if (!plugin && data.name) {
      plugin = await this.client.sysPlugin.findFirst({
        where: { name: data.name }
      });
    }

    if (plugin) {
      await this.client.sysPlugin.update({
        where: { id: plugin.id },
        data: {
          pluginId: data.pluginId,
          name: data.name,
          currentVersion: data.version,
          coreCompatibility: data.coreCompatibility,
          compatRange: data.compatRange,
          routeBase: data.routeBase,
          lastSyncedAt: new Date()
        }
      });
    } else {
      plugin = await this.client.sysPlugin.create({
        data: {
          pluginId: data.pluginId,
          name: data.name,
          currentVersion: data.version,
          coreCompatibility: data.coreCompatibility,
          compatRange: data.compatRange,
          routeBase: data.routeBase,
          lifecycleState: data.lifecycleState,
          enabled: data.enabled,
          installedAt: new Date(),
          lastSyncedAt: new Date()
        }
      });
    }

    await this.client.sysPluginVersion.upsert({
      where: {
        pluginId_version: {
          pluginId: plugin.id,
          version: manifest.version
        }
      },
      create: {
        pluginId: plugin.id,
        version: manifest.version,
        manifest: manifest as unknown as object
      },
      update: {
        manifest: manifest as unknown as object
      }
    })

    await this.client.sysPluginInstall.upsert({
      where: { pluginId: plugin.id },
      create: {
        pluginId: plugin.id,
        lifecycleState: data.lifecycleState,
        enabled: data.enabled,
        installedAt: new Date()
      },
      update: {
        lifecycleState: data.lifecycleState,
        enabled: data.enabled,
        lastError: null
      }
    })
  }

  async updateRuntimeState(pluginId: string, name: string, state: PluginLifecycleState, enabled: boolean, error?: string): Promise<void> {
    let plugin = await this.client.sysPlugin.findFirst({
      where: { pluginId },
      select: { id: true }
    });

    if (!plugin && name) {
      plugin = await this.client.sysPlugin.findFirst({
        where: { name },
        select: { id: true }
      });
    }

    if (!plugin) {
      return
    }

    await this.client.sysPlugin.update({
      where: { id: plugin.id },
      data: {
        lifecycleState: state,
        enabled,
        lastError: error,
        lastSyncedAt: new Date()
      }
    })

    await this.client.sysPluginInstall.upsert({
      where: { pluginId: plugin.id },
      create: {
        pluginId: plugin.id,
        lifecycleState: state,
        enabled,
        installedAt: new Date(),
        lastError: error
      },
      update: {
        lifecycleState: state,
        enabled,
        lastError: error,
        uninstalledAt: state === 'unloaded' ? new Date() : null
      }
    })
  }

  async listRuntimeStates(): Promise<PersistedPluginRuntimeState[]> {
    const rows = await this.client.sysPlugin.findMany({
      select: {
        pluginId: true,
        name: true,
        currentVersion: true,
        coreCompatibility: true,
        lifecycleState: true,
        enabled: true,
        lastError: true,
        updatedAt: true
      }
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
    let row = await this.client.sysPlugin.findFirst({
      where: { pluginId },
      select: {
        pluginId: true,
        name: true,
        currentVersion: true,
        coreCompatibility: true,
        lifecycleState: true,
        enabled: true,
        lastError: true,
        updatedAt: true
      }
    })

    if (!row && name) {
      row = await this.client.sysPlugin.findFirst({
        where: { name },
        select: {
          pluginId: true,
          name: true,
          currentVersion: true,
          coreCompatibility: true,
          lifecycleState: true,
          enabled: true,
          lastError: true,
          updatedAt: true
        }
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

  async syncManifest(manifest: PluginManifest): Promise<void> {
    const record = mapManifestToRecord(manifest)
    this.memoryState.set(record.pluginId, record)

    try {
      await this.repository.upsertManifest(manifest)
    } catch (error) {
      this.markDegraded(error, 'sync manifest failed')
    }
  }

  async updateRuntimeState(pluginId: string, name: string, state: PluginLifecycleState, enabled: boolean, error?: string): Promise<void> {
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
