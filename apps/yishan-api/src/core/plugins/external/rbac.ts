/**
 * rbac.ts — RBAC plugin
 *
 * Implements Section 1 of `tmp/个人项目收尾建议.md`:
 *   - 用户 → 角色 → 权限点
 *   - 菜单只负责展示，不承担授权职责
 *   - 后端统一校验 permission code，不再依赖数据库角色 ID
 *
 * Exposes two Fastify decorators:
 *
 *   fastify.requirePermission(permCode)
 *     返回一个 preHandler，校验当前请求的 JWT/cookie/PAT 身份是否持有 permCode 权限。
 *     super_admin 角色（code = 'super_admin'）仅对 JWT/cookie 登录生效；
 *     PAT 下旁路需通过 tokenScope `*` 或显式 `__super_admin__` 保留。
 *
 *   fastify.requireRole(roleCode)
 *     返回一个 preHandler，校验当前请求是否持有某个 roleCode。
 *
 * PAT（API Token）鉴权语义：
 *   - tokenScope 为 undefined            → JWT/cookie 普通登录：effectivePerms = rolePerms
 *   - tokenScope 包含 "*"                → 通配：effectivePerms = rolePerms（含 super_admin 旁路）
 *   - tokenScope 长度为 0                → 显式空 scopes：拒绝一切
 *   - tokenScope 为非空列表              → 交集 = rolePerms ∩ tokenScope ∩ activeCatalog
 *                                          super_admin 旁路被剥离，PAT 只持有所选 scopes
 *                                          非活动插件 scope 不生效
 *
 * super_admin bypass 规则（单一策略）：
 *   - "*" 通配符：保留 rolePerms 中的 super_admin 旁路（管理员主动选择全部权限）
 *   - "__super_admin__"：仅当 rolePerms 中包含旁路时才生效，不会凭空授予
 *   - 普通 scopes：super_admin 旁路被剥离，scopes 是严格上限
 *   - 空 scopes：即便 rolePerms 包含 super_admin 旁路，也一律拒绝
 *
 * 新方案约束（2026-07-14）：
 *   - computeEffectivePerms 计算交集后再与活动权限目录相交，非活动插件 scope 不生效
 *
 * 必须在 jwt-auth 之后注册（在 app.ts 已按字母顺序保证）。
 */

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BusinessError } from "../../../exceptions/business-error.js";
import { AuthErrorCode } from "../../../constants/business-codes/auth.js";
import { PermissionService } from "../../services/permission.service.js";
import {
  PAT_WILDCARD,
  SUPER_ADMIN_BYPASS,
} from "../../../constants/permission-codes.js";
import { getGlobalCatalog } from "../../services/permission-catalog.service.js";
import type { PermissionRef } from '../../permissions/define-permissions.js';

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void;

declare module "fastify" {
  interface FastifyInstance {
    /**
     * 校验 `request.currentUser` 是否持有 `permCode`。要求 preHandler 已先
     * 执行 `fastify.authenticate`。super_admin 自动放行。
     */
    requirePermission: (permission: string | PermissionRef) => PreHandler;
    /**
     * 校验 `request.currentUser` 是否持有 `roleCode`。同样要求 authenticate 已执行。
     */
    requireRole: (roleCode: string) => PreHandler;
  }
}

/**
 * 辅助函数：判断权限代码是否对 PAT 生效。
 * `SUPER_ADMIN_BYPASS` 是内部 sentinel，不在活动权限目录中，但 PAT 仍可保留它。
 * 所有普通业务权限必须同时在 activeCodes 中才生效。
 */
function isActiveForPat(code: string, activeCodes: Set<string>): boolean {
  return code === SUPER_ADMIN_BYPASS || activeCodes.has(code);
}

/**
 * 内部：根据 tokenScope 与 rolePerms 计算 effectivePerms。
 * 与 requirePermission 装饰器共享同一套语义；单独 export 便于单测覆盖。
 *
 * PAT 最终计算公式（Section 2）：
 *   - tokenScope === undefined   → JWT/cookie 登录：effective = rolePerms
 *   - tokenScope 包含 "*"        → PAT 通配：effective = rolePerms（保留 bypass，受 activeCodes 限制）
 *   - tokenScope 长度为 0        → 显式空 scopes：拒绝一切
 *   - tokenScope 为非空列表      → rolePerms ∩ tokenScope（保留 bypass，受 activeCodes 限制）
 *
 * @param rolePerms 用户角色权限集合
 * @param tokenScope PAT scope 列表（undefined 表示 JWT/cookie 登录）
 * @param activeCodes 活动权限代码集合（由调用方从 Catalog 获取，不含 SUPER_ADMIN_BYPASS）
 */
export function computeEffectivePerms(
  rolePerms: Set<string>,
  tokenScope: string[] | undefined,
  activeCodes: Set<string>,
): Set<string> {
  // Case 1: 普通 JWT/cookie 登录，无 tokenScope，完整 rolePerms
  if (tokenScope === undefined) {
    return rolePerms;
  }
  // Case 2: PAT 通配
  // 通配符继承用户角色权限，但必须与活动权限目录相交
  // 非活动插件的权限不会因通配符而重新生效
  // SUPER_ADMIN_BYPASS 不在 activeCodes 中，但仍可保留（sentinel 不受 activeCodes 限制）
  if (tokenScope.includes(PAT_WILDCARD)) {
    return new Set([...rolePerms].filter((code) => isActiveForPat(code, activeCodes)));
  }
  // Case 3: 显式空 scopes —— 即便 super_admin 也一律拒绝
  if (tokenScope.length === 0) {
    return new Set<string>();
  }
  // Case 4: 严格交集（SUPER_ADMIN_BYPASS 保留需同时满足 rolePerms 含旁路 + tokenScope 显式请求）
  const requested = new Set<string>(
    [...rolePerms].filter((code) => tokenScope.includes(code)),
  );
  return new Set([...requested].filter((code) => isActiveForPat(code, activeCodes)));
}

export default fp<Record<string, never>>(
  async (fastify: FastifyInstance) => {
    fastify.decorate("requirePermission", (permission: string | PermissionRef): PreHandler => {
      const permCode = typeof permission === 'string' ? permission : permission.code;
      return async (request: FastifyRequest, _reply: FastifyReply) => {
        const currentUser = (request as any).currentUser;
        if (!currentUser?.id) {
          throw new BusinessError(
            AuthErrorCode.UNAUTHORIZED,
            "缺少认证身份，无法进行权限校验",
          );
        }
        const roleIds: number[] = currentUser.roleIds ?? [];
        if (!roleIds.length) {
          throw new BusinessError(
            AuthErrorCode.FORBIDDEN,
            `当前用户没有权限访问要求 ${permCode} 的接口`,
          );
        }
        const { perms: rolePerms } = await PermissionService.loadForRoleIds(roleIds);
        // 获取活动权限目录（refresh-on-read，确保多实例最终一致）
        const activeCodes = await getGlobalCatalog().getActiveCodes();
        // EARLY GATE: 目标权限不在活动目录中时直接拒绝，
        // 确保禁用插件的接口对 JWT、PAT、super_admin 均不可访问
        if (!activeCodes.has(permCode)) {
          throw new BusinessError(
            AuthErrorCode.FORBIDDEN,
            `权限 ${permCode} 不在活动权限目录中（插件已禁用或不存在）`,
          );
        }
        // PAT 有效权限由 computeEffectivePerms 统一计算；__super_admin__ 仅在
        // 角色已有该旁路，且 Token 使用 `*` 或显式请求时保留，
        // 普通业务权限必须处于活动目录中才生效。
        const tokenScope: string[] | undefined = (request as any).tokenScope;
        const effectivePerms = computeEffectivePerms(rolePerms, tokenScope, activeCodes);

        if (!PermissionService.has(effectivePerms, permCode)) {
          throw new BusinessError(
            AuthErrorCode.FORBIDDEN,
            `当前用户没有权限访问要求 ${permCode} 的接口`,
          );
        }
        // 给后续 hook 用：把有效 permissions 注入 request 上下文
        (request as any).effectivePermissions = effectivePerms;
      };
    });

    fastify.decorate("requireRole", (roleCode: string): PreHandler => {
      return async (request: FastifyRequest, _reply: FastifyReply) => {
        const currentUser = (request as any).currentUser;
        if (!currentUser?.id) {
          throw new BusinessError(
            AuthErrorCode.UNAUTHORIZED,
            "缺少认证身份，无法进行角色校验",
          );
        }
        const roleIds: number[] = currentUser.roleIds ?? [];
        if (!roleIds.length) {
          throw new BusinessError(
            AuthErrorCode.FORBIDDEN,
            `当前用户未持有角色 ${roleCode}`,
          );
        }
        // PAT 不允许被 requireRole 命中（角色与 tokenScope 是不同的维度）
        const tokenScope: string[] | undefined = (request as any).tokenScope;
        if (tokenScope) {
          throw new BusinessError(
            AuthErrorCode.FORBIDDEN,
            "API Token 不能用 requireRole 校验，请改用 requirePermission / tokenScope",
          );
        }
        const { roleCodes } = await PermissionService.loadForRoleIds(roleIds);
        if (!roleCodes.has(roleCode)) {
          throw new BusinessError(
            AuthErrorCode.FORBIDDEN,
            `当前用户未持有角色 ${roleCode}`,
          );
        }
        (request as any).effectiveRoleCodes = roleCodes;
      };
    });
  },
  {
    name: "rbac",
    // rbac 只装饰器扩展，必须在 jwt-auth 之后注册
    dependencies: ["jwt-auth"],
  },
);
