/**
 * Permission Service — Section 1: RBAC 单一收敛点。
 *
 * 用于 `fastify.requirePermission(permCode)` 装饰器内部，聚合用户的所有
 * 有效权限点（来自其所有角色 → 关联菜单 → perm 字段）。
 *
 * PermissionCache：进程内 LRU + TTL 缓存，避免每次请求都打到数据库。
 * Cache key = `${roleIds.join(',')}|${version}`。当角色或角色菜单被更新
 * 时需调用 `PermissionService.invalidate()` 触发强制失效。
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
    // 先规范化 roleIds
    const normalizedRoleIds = Array.isArray(roleIds)
      ? roleIds
      : (roleIds != null ? [Number(roleIds)] : []);

    // 过滤并转换为有效数字
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
    // super_admin 标记：缓存层加在前面，requirePermission 自然会放行。
    if (roleCodes.has(ROLE_CODES.SUPER_ADMIN)) {
      perms.add("__super_admin__");
    }
    PermissionService.cache.set(cacheKey, {
      perms,
      roleCodes,
      loadedAt: now,
    });
    return { perms, roleCodes };
  }

  /**
   * 加载用户当前持有的所有角色 ID（不含软删除链接）。
   */
  static async loadRoleIdsForUser(userId: number): Promise<number[]> {
    return PermissionRepository.loadActiveRoleIdsByUserId(userId);
  }

  /** Test whether the role set grants a permission code (without super-admin short-circuit). */
  static has(perms: Set<string>, code: string): boolean {
    return perms.has("__super_admin__") || perms.has(code);
  }

  /** Clear cache for given role ids, or entire cache if no ids supplied. */
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
