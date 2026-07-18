/**
 * 插件安装 / 同步日志数据访问 Repository
 *
 * 把 `core/services/plugin-manage.service.ts` 与 `plugin-menu-sync.service.ts`
 * 中散落的 Drizzle 直接调用收敛到这里：
 *   - sysPlugin             — 插件元数据
 *   - sysPluginInstall      — 一次安装记录（每个 pluginId 一行）
 *   - sysPluginSyncLog      — 每次菜单同步产生的日志
 *
 * 服务层只关心业务编排（启停、合并、冲突解决），不再持有 drizzleDb。
 */

import { and, desc, eq, isNull, like, sql } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysMenu, sysPlugin, sysPluginInstall, sysPluginSyncLog } from "@/db/schema";
import { toAffectedCount } from "../db/result.js";

export type PluginRow = typeof sysPlugin.$inferSelect;
export type PluginInstallRow = typeof sysPluginInstall.$inferSelect;
export type PluginSyncLogRow = typeof sysPluginSyncLog.$inferSelect;
export type MenuRow = typeof sysMenu.$inferSelect;

// ---------------------------------------------------------------------------
// Plugin (sysPlugin)
// ---------------------------------------------------------------------------

export class PluginRepository {
  /**
   * 查找最近一次安装记录（含按 createdAt desc 取的第一条 sync log）。
   * 通过 pluginId 或 name 任一字段查找；都未命中返回 null。
   */
  static async findInstallWithLatestLog(
    pluginId?: string,
    pluginName?: string,
    db: AppQueryDb = drizzleDb,
  ): Promise<(PluginInstallRow & { syncLogs: PluginSyncLogRow[] }) | null> {
    const withInstalls = {
      sysPluginInstall_plugin_id: {
        with: {
          sysPluginSyncLog_plugin_install_id: {
            orderBy: desc(sysPluginSyncLog.createdAt),
            limit: 1,
          },
        },
      },
    } as const;

    let plugin: any = null;
    if (pluginId) {
      plugin = await db.query.sysPlugin.findFirst({
        where: eq(sysPlugin.pluginId, pluginId),
        with: withInstalls,
      });
    }
    if (!plugin && pluginName) {
      plugin = await db.query.sysPlugin.findFirst({
        where: eq(sysPlugin.name, pluginName),
        with: withInstalls,
      });
    }
    const installs = plugin?.sysPluginInstall_plugin_id ?? [];
    if (!plugin || installs.length === 0) return null;
    const install = installs[0];
    return {
      ...install,
      syncLogs: install.sysPluginSyncLog_plugin_install_id ?? [],
    };
  }

  /** 把一条 plugin install 记录的 syncStrategy 字段更新为给定值。 */
  static async updateInstallStrategy(installId: number, strategy: string, db: AppQueryDb = drizzleDb) {
    await db
      .update(sysPluginInstall)
      .set({ syncStrategy: strategy })
      .where(eq(sysPluginInstall.id, installId));
  }

  /** 写入 install.lastError，用于同步失败后的状态记录。 */
  static async updateInstallError(installId: number, error: string, db: AppQueryDb = drizzleDb) {
    await db
      .update(sysPluginInstall)
      .set({ lastError: error })
      .where(eq(sysPluginInstall.id, installId));
  }
}

// ---------------------------------------------------------------------------
// Plugin Sync Log (sysPluginSyncLog)
// ---------------------------------------------------------------------------

export class PluginSyncLogRepository {
  static async create(input: {
    pluginInstallId: number;
    strategy: string;
    status: string;
    created: number;
    updated: number;
    skipped: number;
    conflicted: number;
    conflictDetails: unknown;
    errorMessage: string | null;
  }, db: AppQueryDb = drizzleDb): Promise<number> {
    const [row] = await db
      .insert(sysPluginSyncLog)
      .values({
        pluginInstallId: input.pluginInstallId,
        strategy: input.strategy,
        status: input.status,
        created: input.created,
        updated: input.updated,
        skipped: input.skipped,
        conflicted: input.conflicted,
        conflictDetails: input.conflictDetails as any,
        errorMessage: input.errorMessage,
      })
      .$returningId();
    return row.id;
  }

  static async findLatestByInstallId(pluginInstallId: number, db: AppQueryDb = drizzleDb): Promise<PluginSyncLogRow | null> {
    const log = await db.query.sysPluginSyncLog.findFirst({
      where: eq(sysPluginSyncLog.pluginInstallId, pluginInstallId),
      orderBy: desc(sysPluginSyncLog.createdAt),
    });
    return log ?? null;
  }

  static async listByInstallId(pluginInstallId: number, limit: number, db: AppQueryDb = drizzleDb): Promise<PluginSyncLogRow[]> {
    return await db.query.sysPluginSyncLog.findMany({
      where: eq(sysPluginSyncLog.pluginInstallId, pluginInstallId),
      orderBy: desc(sysPluginSyncLog.createdAt),
      limit,
    });
  }
}

// ---------------------------------------------------------------------------
// Plugin Menu (sysMenu) — 只服务于插件菜单同步，不替代 MenuRepository。
// ---------------------------------------------------------------------------

export interface PluginMenuUpsertInput {
  menuItemName: string;
  menuItemPath: string;
  menuItemIcon?: string | null;
  menuItemPerm?: string | null;
  hideInMenu?: boolean;
  pluginMenuKey: string;
  pluginId: string;
  pluginName: string;
  creatorId: number;
  updaterId: number;
  parentId: number | null;
  sortOrder: number;
}

export interface PluginMenuUpsertResult {
  id: number;
  isNew: boolean;
  skipped?: boolean;
  conflict?: { path: string; name: string; existingPluginName: string; reason: string };
}

export class PluginMenuRepository {
  /**
   * 查找或创建插件的父级菜单（`/plugins/<org>/<pluginName>`），
   * 返回该父菜单 id。若父菜单已存在则刷新元数据；不存在则创建。
   */
  static async resolveOrCreateParentMenuId(input: {
    path: string;
    name: string;
    icon: string | null;
    sortOrder: number;
    pluginId: string;
    pluginName: string;
    creatorId: number;
  }, db: AppQueryDb = drizzleDb): Promise<number> {
    const existing = await db.query.sysMenu.findFirst({
      where: and(
        eq(sysMenu.path, input.path),
        eq(sysMenu.type, 0),
        isNull(sysMenu.deletedAt),
      ),
    });

    if (!existing) {
      const [created] = await db
        .insert(sysMenu)
        .values({
          name: input.name,
          path: input.path,
          type: 0,
          status: 1,
          sortOrder: input.sortOrder,
          source: 'plugin',
          pluginName: input.pluginName,
          pluginMenuKey: `${input.pluginId}:${input.path}`,
          icon: input.icon,
          creatorId: input.creatorId,
        })
        .$returningId();
      return created.id;
    }

    await db
      .update(sysMenu)
      .set({
        name: input.name,
        icon: input.icon,
        sortOrder: input.sortOrder,
        source: 'plugin',
        pluginName: input.pluginName,
      })
      .where(eq(sysMenu.id, existing.id));

    return existing.id;
  }

  /**
   * 幂等 upsert：按 pluginMenuKey 优先，命中即刷新；否则按 path 判冲突，
   * 冲突返回 skipped；都不命中则创建。
   */
  static async upsertByPluginMenuKey(input: PluginMenuUpsertInput, db: AppQueryDb = drizzleDb): Promise<PluginMenuUpsertResult> {
    const existingByKey = await db.query.sysMenu.findFirst({
      where: eq(sysMenu.pluginMenuKey, input.pluginMenuKey),
    });

    if (existingByKey) {
      await db
        .update(sysMenu)
        .set({
          name: input.menuItemName,
          path: input.menuItemPath,
          type: 1,
          status: 1,
          sortOrder: input.sortOrder,
          source: 'plugin',
          pluginName: input.pluginName,
          pluginMenuKey: input.pluginMenuKey,
          perm: input.menuItemPerm ?? null,
          icon: input.menuItemIcon ?? null,
          hideInMenu: input.hideInMenu ?? false,
          updaterId: input.updaterId,
          parentId: input.parentId,
        })
        .where(eq(sysMenu.id, existingByKey.id));
      return { id: existingByKey.id, isNew: false };
    }

    const existingByPath = await db.query.sysMenu.findFirst({
      where: eq(sysMenu.path, input.menuItemPath),
    });

    if (existingByPath) {
      return {
        id: 0,
        isNew: false,
        skipped: true,
        conflict: {
          path: input.menuItemPath,
          name: input.menuItemName,
          existingPluginName: existingByPath.pluginName ?? 'core',
          reason: `路径 ${input.menuItemPath} 已被 ${existingByPath.pluginName ?? '核心菜单'} 占用`,
        },
      };
    }

    const [created] = await db
      .insert(sysMenu)
      .values({
        name: input.menuItemName,
        path: input.menuItemPath,
        type: 1,
        status: 1,
        sortOrder: input.sortOrder,
        source: 'plugin',
        pluginName: input.pluginName,
        pluginMenuKey: input.pluginMenuKey,
        perm: input.menuItemPerm ?? null,
        icon: input.menuItemIcon ?? null,
        hideInMenu: input.hideInMenu ?? false,
        creatorId: input.creatorId,
        parentId: input.parentId,
      })
      .$returningId();

    return { id: created.id, isNew: true };
  }

  /** 把该插件名下所有菜单软删（设置 deletedAt）。 */
  static async softDeleteByPluginId(pluginId: string, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db
      .update(sysMenu)
      .set({ deletedAt: sql`CURRENT_TIMESTAMP(0)` })
      .where(
        and(
          like(sysMenu.pluginMenuKey, `${pluginId}:%`),
          eq(sysMenu.source, 'plugin'),
          isNull(sysMenu.deletedAt),
        )!,
      );
    return toAffectedCount(result).count;
  }

  /** 切换插件菜单启停状态（status）。 */
  static async setPluginMenusStatus(pluginId: string, status: 0 | 1, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db
      .update(sysMenu)
      .set({ status })
      .where(
        and(
          like(sysMenu.pluginMenuKey, `${pluginId}:%`),
          eq(sysMenu.source, 'plugin'),
          isNull(sysMenu.deletedAt),
        )!,
      );
    return toAffectedCount(result).count;
  }
}
