/**
 * App 工作台菜单数据访问 Repository
 */

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysWorkbenchMenu, sysRoleWorkbenchMenu } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

type AppMenuRow = typeof sysWorkbenchMenu.$inferSelect;
export type AppMenuPublicRow = Omit<AppMenuRow, "deletedAt" | "version">;

export interface CreateAppMenuInput {
  parentId: number | null;
  type: number;
  name: string;
  icon: string | null;
  page: string | null;
  moduleId: string;
  sortOrder: number;
  status: number;
  creatorId: number;
}

export interface UpdateAppMenuInput {
  parentId?: number | null;
  type?: number;
  name?: string;
  icon?: string | null;
  page?: string | null;
  moduleId?: string;
  sortOrder?: number;
  status?: number;
  updaterId: number;
}

const columns = {
  id: sysWorkbenchMenu.id,
  parentId: sysWorkbenchMenu.parentId,
  type: sysWorkbenchMenu.type,
  name: sysWorkbenchMenu.name,
  icon: sysWorkbenchMenu.icon,
  page: sysWorkbenchMenu.page,
  moduleId: sysWorkbenchMenu.moduleId,
  sortOrder: sysWorkbenchMenu.sortOrder,
  status: sysWorkbenchMenu.status,
  creatorId: sysWorkbenchMenu.creatorId,
  createdAt: sysWorkbenchMenu.createdAt,
  updaterId: sysWorkbenchMenu.updaterId,
  updatedAt: sysWorkbenchMenu.updatedAt,
};

function parentCondition(parentId: number | null) {
  return parentId === null ? isNull(sysWorkbenchMenu.parentId) : eq(sysWorkbenchMenu.parentId, parentId);
}

export class AppMenuRepository {
  /** 全部未删除节点，同级按 sort_order、id 升序 */
  static async listAll(db: AppQueryDb = drizzleDb): Promise<AppMenuPublicRow[]> {
    return db
      .select(columns)
      .from(sysWorkbenchMenu)
      .where(isNull(sysWorkbenchMenu.deletedAt))
      .orderBy(asc(sysWorkbenchMenu.sortOrder), asc(sysWorkbenchMenu.id));
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<AppMenuPublicRow | null> {
    const [row] = await db
      .select(columns)
      .from(sysWorkbenchMenu)
      .where(and(eq(sysWorkbenchMenu.id, id), isNull(sysWorkbenchMenu.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  static async findByParentAndName(
    parentId: number | null,
    name: string,
    db: AppQueryDb = drizzleDb,
  ): Promise<AppMenuPublicRow | null> {
    const [row] = await db
      .select(columns)
      .from(sysWorkbenchMenu)
      .where(and(isNull(sysWorkbenchMenu.deletedAt), eq(sysWorkbenchMenu.name, name), parentCondition(parentId)))
      .limit(1);
    return row ?? null;
  }

  static async findByPage(page: string, db: AppQueryDb = drizzleDb): Promise<AppMenuPublicRow | null> {
    const [row] = await db
      .select(columns)
      .from(sysWorkbenchMenu)
      .where(and(isNull(sysWorkbenchMenu.deletedAt), eq(sysWorkbenchMenu.page, page)))
      .limit(1);
    return row ?? null;
  }

  static async listChildren(parentId: number | null, db: AppQueryDb = drizzleDb): Promise<AppMenuPublicRow[]> {
    return db
      .select(columns)
      .from(sysWorkbenchMenu)
      .where(and(isNull(sysWorkbenchMenu.deletedAt), parentCondition(parentId)))
      .orderBy(asc(sysWorkbenchMenu.sortOrder), asc(sysWorkbenchMenu.id));
  }

  static async create(input: CreateAppMenuInput, db: AppQueryDb = drizzleDb): Promise<AppMenuPublicRow> {
    const { creatorId, ...fields } = input;
    const now = dateUtils.now();
    const [inserted] = await db
      .insert(sysWorkbenchMenu)
      .values({ ...fields, creatorId, updaterId: creatorId, createdAt: now, updatedAt: now })
      .$returningId();
    const created = await this.findById(inserted.id, db);
    if (!created) throw new Error("Failed to read back created app menu");
    return created;
  }

  static async update(id: number, input: UpdateAppMenuInput, db: AppQueryDb = drizzleDb): Promise<AppMenuPublicRow> {
    await db
      .update(sysWorkbenchMenu)
      .set({ ...input, updatedAt: dateUtils.now() })
      .where(and(eq(sysWorkbenchMenu.id, id), isNull(sysWorkbenchMenu.deletedAt)));
    const updated = await this.findById(id, db);
    if (!updated) throw new Error("Failed to read back updated app menu");
    return updated;
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    const now = dateUtils.now();
    await db
      .update(sysWorkbenchMenu)
      .set({ deletedAt: now, status: 0, updatedAt: now })
      .where(and(eq(sysWorkbenchMenu.id, id), isNull(sysWorkbenchMenu.deletedAt)));
  }

  static async deleteRoleLinks(appMenuId: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db.delete(sysRoleWorkbenchMenu).where(eq(sysRoleWorkbenchMenu.workbenchMenuId, appMenuId));
  }

  static async findIdsByRoleIds(roleIds: number[], db: AppQueryDb = drizzleDb): Promise<number[]> {
    if (roleIds.length === 0) return [];
    const rows = await db
      .select({ appMenuId: sysRoleWorkbenchMenu.workbenchMenuId })
      .from(sysRoleWorkbenchMenu)
      .where(and(inArray(sysRoleWorkbenchMenu.roleId, [...new Set(roleIds)]), isNull(sysRoleWorkbenchMenu.deletedAt)));
    return [...new Set(rows.map((row) => row.appMenuId))];
  }

  /** 把 orderedIds 的顺序写回 sort_order（10, 20, 30 …） */
  static async writeOrder(orderedIds: readonly number[], db: AppQueryDb = drizzleDb): Promise<void> {
    const now = dateUtils.now();
    for (const [index, id] of orderedIds.entries()) {
      await db
        .update(sysWorkbenchMenu)
        .set({ sortOrder: (index + 1) * 10, updatedAt: now })
        .where(and(eq(sysWorkbenchMenu.id, id), isNull(sysWorkbenchMenu.deletedAt)));
    }
  }

  static async countChildren(parentId: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysWorkbenchMenu)
      .where(and(isNull(sysWorkbenchMenu.deletedAt), eq(sysWorkbenchMenu.parentId, parentId)));
    return Number(row?.c ?? 0);
  }
}
