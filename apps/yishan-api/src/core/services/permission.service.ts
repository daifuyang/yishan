/**
 * Permission Service — Section 1: RBAC 单一收敛点。
 *
 * 用于 `fastify.requirePermission(permCode)` 装饰器内部，聚合用户的所有
 * 有效权限点（来自其所有角色 → 关联菜单 → perm 字段）。
 *
 * PermissionCache：进程内 TTL 缓存，cacheKey = `${roleIds.join(',')}|${version}`。
 * 当角色或角色菜单被更新时需调用 `invalidate(roleIds?)` 强制失效。
 *
 * 单一职责：roleId → effective perms（含 super_admin 旁路 / PAT scope 交集）。
 * 不负责 catalog 构建（catalog.ts）、rbac 拦截（rbac.ts）、缓存 menu 渲染（menu.service）。
 */

import { PermissionRepository } from "../repositories/permission.repository.js";
import { ROLE_CODES } from "../../constants/permission-codes.js";

interface PermissionCacheEntry {
  perms: Set<string>;
  roleCodes: Set<string>;
  loadedAt: number;
}

const DEFAULT_TTL_MS = 30_000; // 30s

/** Bump this version when cache schema/invalidation logic changes. */
const CACHE_VERSION = "v1";

export class PermissionService {
  private static cache = new Map<string, PermissionCacheEntry>();

  /**
   * Load effective permission codes + role codes for a set of role IDs.
   */
  static async loadForRoleIds(
    roleIds: number[] | number | undefined | null,
    opts: { ttlMs?: number } = {},
  ): Promise<{ perms: Set<string>; roleCodes: Set<string> }> {
    const normalizedRoleIds = Array.isArray(roleIds)
      ? roleIds
      : (roleIds != null ? [Number(roleIds)] : []);
    const validRoleIds = normalizedRoleIds
      .map(id => Number(id))
      .filter(id => !isNaN(id) && id > 0);

    if (validRoleIds.length === 0) {
      return { perms: new Set<string>(), roleCodes: new Set<string>() };
    }
    const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    const sortedIds = [...new Set(validRoleIds)].sort((a, b) => a - b);
    const cacheKey = `${sortedIds.join(",")}|${CACHE_VERSION}`;
    const now = Date.now();
    const cached = PermissionService.cache.get(cacheKey);
    if (cached && now - cached.loadedAt < ttlMs) {
      return { perms: cached.perms, roleCodes: cached.roleCodes };
    }
    const { perms, roleCodes } = await PermissionRepository.loadPermissionsByRoleIds(sortedIds);
    if (roleCodes.has(ROLE_CODES.SUPER_ADMIN)) {
      perms.add("__super_admin__");
    }
    PermissionService.cache.set(cacheKey, { perms, roleCodes, loadedAt: now });
    return { perms, roleCodes };
  }

  static async loadRoleIdsForUser(userId: number): Promise<number[]> {
    return PermissionRepository.loadActiveRoleIdsByUserId(userId);
  }

  /** Test whether the role set grants a permission code (with super-admin short-circuit). */
  static has(perms: Set<string>, code: string): boolean {
    return perms.has("__super_admin__") || perms.has(code);
  }

  static invalidate(roleIds?: number[]): void {
    if (!roleIds || roleIds.length === 0) {
      PermissionService.cache.clear();
      return;
    }
    const sortedIds = new Set(roleIds);
    for (const key of PermissionService.cache.keys()) {
      const [ids] = key.split("|");
      const idsList = ids.split(",").map((s) => Number(s));
      if (idsList.some((id) => sortedIds.has(id))) {
        PermissionService.cache.delete(key);
      }
    }
  }
}

/** sentinel：与 active catalog 无关，但仍可被持有。 */
export const SUPER_ADMIN_BYPASS = '__super_admin__';

/** PAT scope 通配符：完全继承 rolePerms（含 super_admin 旁路）。 */
export const PAT_WILDCARD = '*';

/**
 * 计算最终有效权限：
 *   - tokenScope undefined           → JWT/cookie 路径：effective = rolePerms
 *   - tokenScope contains '*'         → 通配：effective = rolePerms ∩ activeCodes（含 super_admin 旁路）
 *   - tokenScope length 0             → 显式空：拒绝一切
 *   - tokenScope non-empty list       → 交集 rolePerms ∩ tokenScope ∩ activeCodes
 *                                       super_admin 旁路被剥离（除非在 * 或显式哨兵）
 *
 * activeCodes 不包含 SUPER_ADMIN_BYPASS（sentinel 内部流转）；该函数对 sentinel
 * 通过 isActiveForPat 旁路过滤。
 */
function isActiveForPat(code: string, activeCodes: ReadonlySet<string>): boolean {
  if (code === SUPER_ADMIN_BYPASS || code === PAT_WILDCARD) return true;
  return activeCodes.has(code);
}

export function computeEffectivePerms(
  rolePerms: ReadonlySet<string>,
  tokenScope: readonly string[] | undefined,
  activeCodes: ReadonlySet<string>,
): Set<string> {
  // JWT/cookie 路径：直接以 rolePerms 为准，不做 active 过滤
  if (tokenScope === undefined) {
    return new Set(rolePerms);
  }
  // PAT 显式空 scope：拒绝一切
  if (tokenScope.length === 0) {
    return new Set();
  }
  // PAT 通配 '*'：完整 rolePerms ∩ activeCodes
  if (tokenScope.includes(PAT_WILDCARD)) {
    return new Set([...rolePerms].filter((code) => isActiveForPat(code, activeCodes)));
  }
  // PAT 显式 scopes：rolePerms ∩ scopes ∩ activeCodes
  const out = new Set<string>();
  for (const code of tokenScope) {
    if (!rolePerms.has(code)) continue;
    if (!isActiveForPat(code, activeCodes)) continue;
    out.add(code);
  }
  return out;
}
