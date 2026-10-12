/**
 * 首页常用应用：用户固定的入口在前，其余已授权入口按使用习惯排序。
 * 只返回入口 id；是否有对应的移动端页面由 App 端 registry 判断并截断。
 */

import { dbManager } from "@/db";
import { AppHomeRepository, type WorkbenchUsageRow } from "../repositories/app-home.repository.js";
import type { AppMenuNode } from "../schemas/app-menu.js";
import { AppMenuService, type AppMenuModuleScope } from "./app-menu.service.js";

export const MAX_HOME_PINS = 8;
const HALF_LIFE_DAYS = 14;
const WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;

export interface HomeApps {
  pinned: number[];
  ranked: number[];
}

/** 次数按 14 天半衰期衰减；90 天前最后一次打开的不再参与推荐 */
export function usageScore(row: WorkbenchUsageRow, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - row.lastOpenedAt.getTime()) / DAY_MS);
  if (ageDays > WINDOW_DAYS) return 0;
  return row.openCount * 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

/** 授权树中的应用入口 id，保持树的先序（即工作台显示顺序） */
export function authorizedEntryIds(tree: readonly AppMenuNode[]): number[] {
  return tree.flatMap((node) =>
    // children 由 Type.Ref 声明，静态类型为 unknown[]，这里按同一节点结构收窄
    node.type === 1 ? [node.id] : ((node.children ?? []) as AppMenuNode[]).filter((entry) => entry.type === 1).map((entry) => entry.id),
  );
}

export function rankHomeApps(
  entryIds: readonly number[],
  pinnedIds: readonly number[],
  usage: readonly WorkbenchUsageRow[],
  now: Date,
): HomeApps {
  const available = new Set(entryIds);
  const pinned = [...new Set(pinnedIds)].filter((id) => available.has(id));
  const pinnedSet = new Set(pinned);
  const scores = new Map(usage.map((row) => [row.workbenchMenuId, usageScore(row, now)]));
  const order = new Map(entryIds.map((id, index) => [id, index]));
  const ranked = entryIds
    .filter((id) => !pinnedSet.has(id))
    .sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || order.get(a)! - order.get(b)!);
  return { pinned, ranked };
}

async function availableEntryIds(roleIds: number[], scope?: AppMenuModuleScope): Promise<number[]> {
  return authorizedEntryIds(await AppMenuService.getAuthorizedTree(roleIds, scope));
}

export class AppHomeService {
  static async getHome(
    userId: number,
    roleIds: number[],
    scope?: AppMenuModuleScope,
    now: Date = new Date(),
  ): Promise<HomeApps> {
    const [entryIds, pinned, usage] = await Promise.all([
      availableEntryIds(roleIds, scope),
      AppHomeRepository.listPinnedIds(userId),
      AppHomeRepository.listUsage(userId),
    ]);
    return rankHomeApps(entryIds, pinned, usage, now);
  }

  /** 去重保序，丢弃越权 / 分组 / 已删除的 id；schema 已限制最多 8 个，这里再兜底截断 */
  static async savePins(
    userId: number,
    roleIds: number[],
    menuIds: readonly number[],
    scope?: AppMenuModuleScope,
  ): Promise<HomeApps> {
    const available = new Set(await availableEntryIds(roleIds, scope));
    const next = [...new Set(menuIds)].filter((id) => available.has(id)).slice(0, MAX_HOME_PINS);
    await dbManager.transaction((tx) => AppHomeRepository.replacePins(userId, next, tx));
    return this.getHome(userId, roleIds, scope);
  }

  static async recordUsage(
    userId: number,
    roleIds: number[],
    menuId: number,
    scope?: AppMenuModuleScope,
  ): Promise<{ recorded: boolean }> {
    const available = await availableEntryIds(roleIds, scope);
    if (!available.includes(menuId)) return { recorded: false };
    await AppHomeRepository.incrementUsage(userId, menuId);
    return { recorded: true };
  }
}
