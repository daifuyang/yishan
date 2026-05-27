import { prismaManager } from '../../utils/prisma.js'
import { PluginManifest, PluginMenuItem } from '../../plugins-runtime/types.js'

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
  private readonly prisma = prismaManager.getClient()

  private buildPluginMenuKey(pluginId: string, path: string): string {
    return `${pluginId}:${path}`
  }

  async resolveParentMenuId(manifest: PluginManifest): Promise<number | null> {
    if (!manifest.routeBase) return null
    
    const match = manifest.routeBase.match(/^\/api\/modules\/([^/]+)\/([^/]+)/)
    if (!match) return null
    
    const [, org, pluginName] = match

    const pluginParentPath = `/plugins/${org}/${pluginName}`
    const rootName = manifest.menuRootName?.trim() || `${org}/${pluginName}`
    const rootIcon = manifest.menuRootIcon ?? manifest.icon ?? null
    const rootSort = Number.isFinite(manifest.menuRootSort) ? Number(manifest.menuRootSort) : 10
    
    let parentMenu = await this.prisma.sysMenu.findFirst({
      where: { path: pluginParentPath, type: 0, deletedAt: null }
    })
    
    if (!parentMenu) {
      const created = await this.prisma.sysMenu.create({
        data: {
          name: rootName,
          path: pluginParentPath,
          type: 0,
          status: 1,
          sort_order: rootSort,
          source: 'plugin',
          pluginName: manifest.name,
          pluginMenuKey: `${manifest.pluginId}:${pluginParentPath}`,
          icon: rootIcon,
          creatorId: 1,
        },
      })
      parentMenu = created
    } else {
      await this.prisma.sysMenu.update({
        where: { id: parentMenu.id },
        data: {
          name: rootName,
          icon: rootIcon,
          sort_order: rootSort,
          source: 'plugin',
          pluginName: manifest.name,
        },
      })
    }
    
    return parentMenu.id
  }

  async upsertPluginMenu(
    manifest: PluginManifest,
    menuItem: PluginMenuItem,
    creatorId: number,
    parentId: number | null
  ): Promise<{ id: number; isNew: boolean; skipped?: boolean; conflict?: ConflictDetail }> {
    const pluginId = manifest.pluginId
    const pluginMenuKey = this.buildPluginMenuKey(pluginId, menuItem.path)

    const existingByKey = await this.prisma.sysMenu.findUnique({
      where: { pluginMenuKey },
    })

    if (existingByKey) {
      await this.prisma.sysMenu.update({
        where: { id: existingByKey.id },
        data: {
          name: menuItem.name,
          path: menuItem.path,
          type: 1,
          status: 1,
          sort_order: 0,
          source: 'plugin',
          pluginName: manifest.name,
          pluginMenuKey,
          perm: menuItem.perm ?? null,
          icon: menuItem.icon ?? null,
          updaterId: creatorId,
          parentId,
        },
      })
      return { id: existingByKey.id, isNew: false }
    }

    const existingByPath = await this.prisma.sysMenu.findUnique({
      where: { path: menuItem.path },
    })

    if (existingByPath) {
      const conflict: ConflictDetail = {
        path: menuItem.path,
        name: menuItem.name,
        existingPluginName: existingByPath.pluginName ?? 'core',
        reason: `路径 ${menuItem.path} 已被 ${existingByPath.pluginName ?? '核心菜单'} 占用`,
      }
      return { id: 0, isNew: false, skipped: true, conflict }
    }

    const created = await this.prisma.sysMenu.create({
      data: {
        name: menuItem.name,
        path: menuItem.path,
        type: 1,
        status: 1,
        sort_order: 0,
        source: 'plugin',
        pluginName: manifest.name,
        pluginMenuKey,
        perm: menuItem.perm ?? null,
        icon: menuItem.icon ?? null,
        creatorId,
        parentId,
      },
    })

    return { id: created.id, isNew: true }
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

    for (const menuItem of manifest.menus) {
      try {
        const upsertResult = await this.upsertPluginMenu(manifest, menuItem, creatorId, parentId)

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
    const syncLog = await this.prisma.sysPluginSyncLog.create({
      data: {
        pluginInstallId,
        strategy,
        status: result.status ?? 'success',
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        conflicted: result.conflicted,
        conflictDetails: result.conflictDetails as any,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
      },
    })
    return syncLog.id
  }

  async getLatestSyncLog(pluginInstallId: number): Promise<SyncLogRecord | null> {
    const log = await this.prisma.sysPluginSyncLog.findFirst({
      where: { pluginInstallId },
      orderBy: { createdAt: 'desc' },
    })
    if (!log) return null
    return {
      id: log.id,
      strategy: log.strategy,
      status: log.status,
      created: log.created,
      updated: log.updated,
      skipped: log.skipped,
      conflicted: log.conflicted,
      conflictDetails: (log.conflictDetails as any) ?? [],
      errorMessage: log.errorMessage ?? null,
      createdAt: log.createdAt,
    }
  }

  async getSyncLogs(pluginInstallId: number, limit = 10): Promise<SyncLogRecord[]> {
    const logs = await this.prisma.sysPluginSyncLog.findMany({
      where: { pluginInstallId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return logs.map(log => ({
      id: log.id,
      strategy: log.strategy,
      status: log.status,
      created: log.created,
      updated: log.updated,
      skipped: log.skipped,
      conflicted: log.conflicted,
      conflictDetails: (log.conflictDetails as any) ?? [],
      errorMessage: log.errorMessage ?? null,
      createdAt: log.createdAt,
    }))
  }

  async hidePluginMenus(pluginId: string): Promise<number> {
    const result = await this.prisma.sysMenu.updateMany({
      where: {
        pluginMenuKey: {
          startsWith: `${pluginId}:`,
        },
        source: 'plugin',
        deletedAt: null,
      },
      data: {
        status: 0,
      },
    })
    return result.count
  }

  async restorePluginMenus(pluginId: string): Promise<number> {
    const result = await this.prisma.sysMenu.updateMany({
      where: {
        pluginMenuKey: {
          startsWith: `${pluginId}:`,
        },
        source: 'plugin',
        deletedAt: null,
      },
      data: {
        status: 1,
      },
    })
    return result.count
  }

  async softDeletePluginMenus(pluginId: string): Promise<number> {
    const result = await this.prisma.sysMenu.updateMany({
      where: {
        pluginMenuKey: {
          startsWith: `${pluginId}:`,
        },
        source: 'plugin',
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    })
    return result.count
  }

}
