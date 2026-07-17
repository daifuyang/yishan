/**
 * require-admin.ts — 旧版基于 role ID 的管理员判定。
 *
 * Section 1 — RBAC 整改：本文件已迁移为基于 *角色 code* 的判定，使用
 * `PermissionService` 提供的 roleCodes 集合。super_admin 自动放行。
 *
 * 推荐：新代码直接用 `fastify.requireRole('super_admin')` 或
 * `fastify.requirePermission('system:dashboard:read')` 等更细粒度的装饰器。
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { BusinessError } from "../../exceptions/business-error.js";
import { AuthErrorCode } from "../../constants/business-codes/auth.js";
import { ROLE_CODES } from "../../constants/permission-codes.js";
import { PermissionService } from "../services/permission.service.js";

const ADMIN_ROLE_CODES = new Set<string>([
  ROLE_CODES.SUPER_ADMIN,
  ROLE_CODES.ADMIN,
]);

export async function requireAdmin(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const currentUser = (request as any).currentUser;
  const roleIds: number[] = currentUser?.roleIds ?? [];

  if (!roleIds.length) {
    throw new BusinessError(
      AuthErrorCode.FORBIDDEN,
      "需要管理员权限才能访问此接口",
    );
  }

  const { roleCodes } = await PermissionService.loadForRoleIds(roleIds);
  const isAdmin = [...roleCodes].some((code) => ADMIN_ROLE_CODES.has(code));

  if (!isAdmin) {
    throw new BusinessError(
      AuthErrorCode.FORBIDDEN,
      "需要管理员权限才能访问此接口",
    );
  }
}
