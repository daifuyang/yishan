/**
 * rbac.ts — Section 1 RBAC 拦截唯一入口。
 *
 * 单一职责：
 *   1. 装饰器 `requirePermission(permRef)` 返回一个 preHandler；
 *   2. 该 preHandler 校验当前 JWT/PAT 身份是否持有 perm.code；
 *   3. 公开权限点（声明 `public: true`）只做身份校验；
 *   4. 用户权限集合来自 `fastify.authProvider.loadPermissions`；超管哨兵与 PAT scope 交集由
 *      core/auth/effective-permissions.ts 计算。
 *
 * 不参与：
 *   - schema 元数据注入（route-registrar.ts）；
 *   - permission catalog 构建（routes 顶层自注册 + catalog.ts）；
 *   - 缓存逻辑（permission.service.ts TTL）。
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { BusinessError } from '../../../exceptions/business-error.js';
import { AuthErrorCode } from '../../../constants/business-codes/auth.js';
import { computeEffectivePerms, hasPermission } from '../../auth/effective-permissions.js';
import {
  isBypassCode,
  PERMISSION_CODES,
  type PermissionRef,
} from '../../permissions/catalog.js';

declare module 'fastify' {
  interface FastifyInstance {
    requirePermission: (permission: PermissionRef) => (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
  }
}

export const makeRequirePermissionHandler = (
  fastify: FastifyInstance,
): ((permission: PermissionRef) => (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void) =>
  (permission) => async (request, _reply) => {
    const permCode = permission.code;
    const currentUser = request.currentUser;
    const tokenScope = request.tokenScope;

    if (!currentUser?.id) {
      throw new BusinessError(AuthErrorCode.UNAUTHORIZED, '缺少认证身份，无法进行权限校验');
    }

    // 公共 / 认证通道：仅身份即可，不查 perm
    if (isBypassCode(permCode)) {
      return;
    }

    const roleIds: number[] = currentUser.roleIds ?? [];
    if (!roleIds.length) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, `当前用户没有权限访问要求 ${permCode} 的接口`);
    }

    // 用户权限来源由 AuthProvider 决定（默认：角色 → sys_role_permission，超管追加哨兵）。
    const rolePerms = await fastify.authProvider.loadPermissions(currentUser);

    // EARLY GATE：目标 code 不在活动目录中（已被禁用 / 不存在）→ 直接拒
    if (!PERMISSION_CODES.has(permCode)) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, `权限 ${permCode} 不在活动权限目录中`);
    }

    // PAT scope 交集：JWT/cookie 时 tokenScope === undefined
    const effectivePerms = computeEffectivePerms(rolePerms, tokenScope, PERMISSION_CODES);

    if (!hasPermission(effectivePerms, permCode)) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, `当前用户没有权限访问要求 ${permCode} 的接口`);
    }

    (request as any).effectivePermissions = effectivePerms;
  };

export default fp(
  async (fastify: FastifyInstance) => {
    fastify.decorate('requirePermission', makeRequirePermissionHandler(fastify));
  },
  {
    name: 'rbac',
    dependencies: ['jwt-auth'],
  },
);
