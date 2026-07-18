import { PluginMenuRepository, PluginSyncLogRepository } from "../repositories/plugin.repository.js";
import { PluginManifest, PluginMenuItem } from "../../core/plugin-platform/types.js";

export type SyncStrategy = 'strict' | 'safe'

export interface ConflictDetail {
  path: string
  name: string
  existingPluginName: string
  reason: string
}

export interface SyncResult {
  status: 'success' | 'partial' | 'failed'
  created: number
  updated: number
  skipped: number
  conflicted: number
  conflictDetails: ConflictDetail[]
  errors: string[]
}

export interface SyncLogRecord {
  id: number
  strategy: string
  status: string
  created: number
  updated: number
  skipped: number
  conflicted: number
  conflictDetails: ConflictDetail[]
  errorMessage: string | null
  createdAt: Date
}

export class PluginMenuSyncService {
  private buildPluginMenuKey(pluginId: string, path: string): string {
    return `${pluginId}:${path}`
  }

  async resolveParentMenuId(manifest: PluginManifest): Promise<number | null> {
    if (manifest.menuRoot === false) return null

    // 菜单命名空间属于插件标识，而非 API 路由。routeBase 的末段通常是
    // API 版本（例如 /api/modules/crm/v1），用它推导会错误生成
    // /plugins/crm/v1；pluginId 才是稳定的 <组织>/<插件> 标识。
    const [org, pluginName, ...rest] = manifest.pluginId.split('/')
    if (!org || !pluginName || rest.length > 0) return null

    const pluginParentPath = `/plugins/${org}/${pluginName}`
    const rootName = manifest.menuRootName?.trim() || `${org}/${pluginName}`
    const rootIcon = manifest.menuRootIcon ?? manifest.icon ?? null
    const rootSort = Number.isFinite(manifest.menuRootSort) ? Number(manifest.menuRootSort) : 10

    return await PluginMenuRepository.resolveOrCreateParentMenuId({
      path: pluginParentPath,
      name: rootName,
      icon: rootIcon,
      sortOrder: rootSort,
      pluginId: manifest.pluginId,
      pluginName: manifest.name,
      creatorId: 1,
    })
  }

  async upsertPluginMenu(
    manifest: PluginManifest,
    menuItem: PluginMenuItem,
    creatorId: number,
    parentId: number | null,
    sortOrder: number
  ): Promise<{ id: number; isNew: boolean; skipped?: boolean; conflict?: ConflictDetail }> {
    const pluginId = manifest.pluginId
    const pluginMenuKey = this.buildPluginMenuKey(pluginId, menuItem.path)

    return await PluginMenuRepository.upsertByPluginMenuKey({
      menuItemName: menuItem.name,
      menuItemPath: menuItem.path,
      menuItemIcon: menuItem.icon ?? null,
      permissionCodes: menuItem.permissionCodes ?? [],
      hideInMenu: menuItem.hideInMenu ?? false,
      pluginMenuKey,
      pluginId,
      pluginName: manifest.name,
      creatorId,
      updaterId: creatorId,
      parentId,
      sortOrder,
    })
  }

  async syncPluginMenus(
    manifest: PluginManifest,
    creatorId: number,
    strategy: SyncStrategy = 'safe'
  ): Promise<SyncResult> {
    const result: SyncResult = { status: 'success', created: 0, updated: 0, skipped: 0, conflicted: 0, conflictDetails: [], errors: [] }

    if (!manifest.menus || manifest.menus.length === 0) {
      return result
    }

    const parentId = await this.resolveParentMenuId(manifest)

    for (const [index, menuItem] of manifest.menus.entries()) {
      try {
        const upsertResult = await this.upsertPluginMenu(manifest, menuItem, creatorId, parentId, index + 2)

        if (upsertResult.skipped && upsertResult.conflict) {
          result.conflictDetails.push(upsertResult.conflict)
          result.conflicted++
          result.skipped++

          if (strategy === 'strict') {
            result.errors.push(`[${manifest.name}:${menuItem.path}] 冲突被策略 strict 拒绝: ${upsertResult.conflict.reason}`)
            result.status = 'failed'
            return result
          }
        } else if (upsertResult.isNew) {
          result.created++
        } else {
          result.updated++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`[${manifest.name}:${menuItem.path}] ${msg}`)
      }
    }

    if (result.conflicted > 0 && strategy === 'safe') {
      result.status = 'partial'
    } else if (result.errors.length > 0) {
      result.status = 'failed'
    } else {
      result.status = 'success'
    }

    return result
  }

  async saveSyncAudit(
    pluginInstallId: number,
    strategy: SyncStrategy,
    result: SyncResult
  ): Promise<number> {
    return await PluginSyncLogRepository.create({
      pluginInstallId,
      strategy,
      status: result.status ?? 'success',
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      conflicted: result.conflicted,
      conflictDetails: result.conflictDetails,
      errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
    })
  }

  async getLatestSyncLog(pluginInstallId: number): Promise<SyncLogRecord | null> {
    const log = await PluginSyncLogRepository.findLatestByInstallId(pluginInstallId)
    if (!log) return null
    return this.toSyncLogRecord(log)
  }

  async getSyncLogs(pluginInstallId: number, limit = 10): Promise<SyncLogRecord[]> {
    const logs = await PluginSyncLogRepository.listByInstallId(pluginInstallId, limit)
    return logs.map((log) => this.toSyncLogRecord(log))
  }

  async hidePluginMenus(pluginId: string): Promise<number> {
    return await PluginMenuRepository.setPluginMenusStatus(pluginId, 0)
  }

  async restorePluginMenus(pluginId: string): Promise<number> {
    return await PluginMenuRepository.setPluginMenusStatus(pluginId, 1)
  }

  async softDeletePluginMenus(pluginId: string): Promise<number> {
    return await PluginMenuRepository.softDeleteByPluginId(pluginId)
  }

  private toSyncLogRecord(log: { id: number; strategy: string; status: string; created: number; updated: number; skipped: number; conflicted: number; conflictDetails: unknown; errorMessage: string | null; createdAt: Date }): SyncLogRecord {
    return {
      id: log.id,
      strategy: log.strategy,
      status: log.status,
      created: log.created,
      updated: log.updated,
      skipped: log.skipped,
      conflicted: log.conflicted,
      conflictDetails: (log.conflictDetails as ConflictDetail[]) ?? [],
      errorMessage: log.errorMessage ?? null,
      createdAt: log.createdAt,
    }
  }
}
