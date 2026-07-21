/**
 * 权限点编码目录（Permission Code Catalog）
 *
 * Section 1 — RBAC：菜单只负责展示，授权职责统一收敛到 permission code。
 * 命名约定：`<resource>:<entity>:<action>`，例如 `system:user:list`、
 * `shop:product:update`。
 *
 * 路由层通过 `fastify.requirePermission(permCode)` 校验；菜单或插件 manifest
 * 中 `<menuItem.permissionCodes>` 必须引用这里或插件 manifest 中已声明的 code，不能依赖菜单 ID。
 *
 * 新增权限点请同步更新本文件，并在 README/RBAC.md 文档里登记。
 */

import { BusinessError } from "../exceptions/business-error.js";
import { ValidationErrorCode } from "./business-codes/validation.js";
import { PERMISSION_CODES } from '../core/permissions/catalog.js';

/** Permission codes are declared by Core modules or plugin manifests. */
export type PermissionCode = string;

/**
 * 内部 sentinel：标记当前 PAT 调用方允许保留 super_admin 旁路。
 * 实际从未在菜单 perm 字段出现，仅在 rbac.ts 与 api-token.service.ts 内部流转。
 *
 * bypass 规则（单一策略）：
 *   - "__super_admin__" 不会凭空授予旁路，必须 rolePerms 中已包含
 *   - scope 是严格上限：非 "*" 通配下，即便 rolePerms 含旁路，旁路也会被剥离
 *   - 空 scopes 一律拒绝，即便 rolePerms 含 super_admin 旁路
 */
export const SUPER_ADMIN_BYPASS = "__super_admin__";

/** PAT scope 通配符：完全继承用户角色权限（含 super_admin 旁路）。 */
export const PAT_WILDCARD = "*";

/**
 * 静态已登记的 permission code 集合（用于 isKnownPermissionCode 校验）。
 * 直接引用 catalog.ts 的 PERMISSION_CODES（启动期由 routes 顶层副作用注册完成）。
 */
const STATIC_PERMISSION_SET: ReadonlySet<string> = PERMISSION_CODES;

/** 校验字符串是否为已登记的权限点编码（含 PAT 内部 sentinel 与通配符）。 */
export function isKnownPermissionCode(
  code: string | null | undefined,
): code is PermissionCode {
  if (!code) return false;
  return (
    code === PAT_WILDCARD ||
    code === SUPER_ADMIN_BYPASS ||
    STATIC_PERMISSION_SET.has(code)
  );
}

/**
 * 运行时校验（含外部传入的扩展 code 集合）。用于插件 manifest.permissions
 * 与动态 permission 注册场景。
 */
export function isKnownPermissionCodeRuntime(
  code: string | null | undefined,
  extras?: ReadonlyArray<string>,
): code is PermissionCode {
  if (isKnownPermissionCode(code)) return true;
  if (!code || !extras) return false;
  return extras.includes(code);
}

/**
 * 标准化 PAT scopes：
 *   - 保留通配符 "*" 与 super_admin 旁路标记 "__super_admin__"
 *   - 保留所有静态 PERMISSION_CODES 中已登记的 code
 *   - 保留 extras 中（来自 manifest）注册的扩展 code
 *   - 其他未知 code 抛 BusinessError（不再静默丢弃，避免用户配置失误）
 */
export function normalizeApiTokenScopes(
  scopes: readonly string[] | null | undefined,
  extras?: ReadonlyArray<string>,
): string[] {
  if (!scopes) return [];
  const result: string[] = [];
  for (const code of scopes) {
    if (isKnownPermissionCodeRuntime(code, extras)) {
      result.push(code);
    } else {
      // 主动抛错：阻止无效 PAT 配置静默落地
      throw new BusinessError(
        ValidationErrorCode.INVALID_PARAMETER,
        `未知权限码: ${code}`,
      );
    }
  }
  return result;
}

/**
 * 内置角色编码常量。注意：超级管理员通过 role.code === SUPER_ADMIN_ROLE_CODE
 * 进行身份判定，禁止使用数据库角色 ID；插件与菜单也只允许引用 code 而非 ID。
 */
export const ROLE_CODES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  NORMAL_USER: "normal_user",
} as const;

export type RoleCode = typeof ROLE_CODES[keyof typeof ROLE_CODES];
