import { currentSystemRuntime } from '@/runtime'
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
import { PERMISSION_CODES } from "@yishan/core-api/permissions/catalog";
import type { MobileCapabilities } from "../schemas/auth.js";
import { computeEffectivePerms } from "../auth/effective-permissions.js";


export interface PermissionCacheEntry {
  perms: Set<string>;
  roleCodes: Set<string>;
  loadedAt: number;
}

const DEFAULT_TTL_MS = 30_000; // 30s

/** Bump this version when cache schema/invalidation logic changes. */
const CACHE_VERSION = "v1";

export class PermissionService {
  private static get cache() { return currentSystemRuntime().caches.permissions }

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

  static async getMobileCapabilities(
    roleIds: number[],
    moduleLoader: { listModuleIds(): ReadonlySet<string>; enabledIdsCached(): Promise<ReadonlySet<string>> },
    tokenScope?: readonly string[],
  ): Promise<MobileCapabilities> {
    const [{ perms }, enabledIds] = await Promise.all([
      PermissionService.loadForRoleIds(roleIds),
      moduleLoader.enabledIdsCached(),
    ]);
    const mountedIds = moduleLoader.listModuleIds();
    const effectivePerms = computeEffectivePerms(perms, tokenScope, PERMISSION_CODES);
    return {
      permissions: [...PERMISSION_CODES]
        .filter((code) => PermissionService.has(effectivePerms, code))
        .sort(),
      enabledModuleIds: [...enabledIds].filter((id) => mountedIds.has(id)).sort(),
    };
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

// 有效权限计算属于 kernel 机制（core/auth/effective-permissions.ts）；这里重导出以保持
// 既有导入路径兼容。
export {
  SUPER_ADMIN_BYPASS,
  PAT_WILDCARD,
  computeEffectivePerms,
} from "../auth/effective-permissions.js";
