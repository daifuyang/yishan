/**
 * 权限点编码目录（Permission Code Catalog）
 *
 * Section 1 — RBAC：菜单只负责展示，授权职责统一收敛到 permission code。
 * 命名约定：`<resource>:<entity>:<action>`，例如 `system:user:list`、
 * `shop:product:update`。
 *
 * 路由层通过 `fastify.requirePermission(permCode)` 校验；菜单或插件 manifest
 * 中 `<menuItem.perm>` 必须与这里的某个 code 严格匹配，不能依赖菜单 ID。
 *
 * 新增权限点请同步更新本文件，并在 README/RBAC.md 文档里登记。
 */

import { BusinessError } from "../exceptions/business-error.js";
import { ValidationErrorCode } from "./business-codes/validation.js";

export const PERMISSION_CODES = {
  // System
  SYSTEM_USER_LIST: "system:user:list",
  SYSTEM_USER_CREATE: "system:user:create",
  SYSTEM_USER_UPDATE: "system:user:update",
  SYSTEM_USER_DELETE: "system:user:delete",
  SYSTEM_ROLE_LIST: "system:role:list",
  SYSTEM_ROLE_CREATE: "system:role:create",
  SYSTEM_ROLE_UPDATE: "system:role:update",
  SYSTEM_ROLE_DELETE: "system:role:delete",
  SYSTEM_MENU_LIST: "system:menu:list",
  SYSTEM_MENU_CREATE: "system:menu:create",
  SYSTEM_MENU_UPDATE: "system:menu:update",
  SYSTEM_MENU_DELETE: "system:menu:delete",
  SYSTEM_DEPARTMENT_LIST: "system:department:list",
  SYSTEM_DEPARTMENT_CREATE: "system:department:create",
  SYSTEM_DEPARTMENT_UPDATE: "system:department:update",
  SYSTEM_DEPARTMENT_DELETE: "system:department:delete",
  SYSTEM_DICT_LIST: "system:dict:list",
  SYSTEM_DICT_CREATE: "system:dict:create",
  SYSTEM_DICT_UPDATE: "system:dict:update",
  SYSTEM_DICT_DELETE: "system:dict:delete",
  SYSTEM_ATTACHMENT_LIST: "system:attachment:list",
  SYSTEM_ATTACHMENT_CREATE: "system:attachment:create",
  SYSTEM_ATTACHMENT_UPDATE: "system:attachment:update",
  SYSTEM_ATTACHMENT_DELETE: "system:attachment:delete",
  SYSTEM_PLUGIN_LIST: "system:plugin:list",
  SYSTEM_PLUGIN_INSTALL: "system:plugin:install",
  SYSTEM_PLUGIN_ENABLE: "system:plugin:enable",
  SYSTEM_PLUGIN_DISABLE: "system:plugin:disable",
  SYSTEM_PLUGIN_SYNC: "system:plugin:sync",
  SYSTEM_PLUGIN_AUDIT: "system:plugin:audit",
  SYSTEM_OPTION_LIST: "system:option:list",
  SYSTEM_OPTION_UPDATE: "system:option:update",
  SYSTEM_DASHBOARD_READ: "system:dashboard:read",
  SYSTEM_LOGIN_LOG_LIST: "system:login-log:list",
  SYSTEM_REGION_LIST: "system:region:list",
  SYSTEM_STORAGE_LIST: "system:storage:list",
  SYSTEM_STORAGE_UPDATE: "system:storage:update",
  SYSTEM_STORAGE_UPLOAD_TOKEN: "system:storage:upload-token",
  SYSTEM_TOKEN_LIST: "system:token:list",
  SYSTEM_TOKEN_CLEANUP: "system:token:cleanup",

  SYSTEM_POSITION_LIST: "system:position:list",
  SYSTEM_POSITION_CREATE: "system:position:create",
  SYSTEM_POSITION_UPDATE: "system:position:update",
  SYSTEM_POSITION_DELETE: "system:position:delete",

  // API Token (PAT)
  API_TOKEN_MANAGE: "system:api-token:manage",
} as const;

export type PermissionCode = typeof PERMISSION_CODES[keyof typeof PERMISSION_CODES];

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
 * 运行时注册的 manifest.permissions 应通过 isKnownPermissionCodeRuntime 注入。
 */
const STATIC_PERMISSION_SET: ReadonlySet<string> = new Set<string>(
  Object.values(PERMISSION_CODES),
);

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
  HOSPITAL_ACCOUNT: "hospital_account",
} as const;

export type RoleCode = typeof ROLE_CODES[keyof typeof ROLE_CODES];

// ============================================================================
// Permission Definitions (single source of truth for labels and grouping)
// ============================================================================

export interface PermissionDefinition {
  code: string;
  group: 'system' | 'shop' | 'portal';
  label: string;
  description?: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // System
  { code: "system:user:list", group: "system", label: "用户管理-列表" },
  { code: "system:user:create", group: "system", label: "用户管理-创建" },
  { code: "system:user:update", group: "system", label: "用户管理-更新" },
  { code: "system:user:delete", group: "system", label: "用户管理-删除" },
  { code: "system:role:list", group: "system", label: "角色管理-列表" },
  { code: "system:role:create", group: "system", label: "角色管理-创建" },
  { code: "system:role:update", group: "system", label: "角色管理-更新" },
  { code: "system:role:delete", group: "system", label: "角色管理-删除" },
  { code: "system:menu:list", group: "system", label: "菜单管理-列表" },
  { code: "system:menu:create", group: "system", label: "菜单管理-创建" },
  { code: "system:menu:update", group: "system", label: "菜单管理-更新" },
  { code: "system:menu:delete", group: "system", label: "菜单管理-删除" },
  { code: "system:department:list", group: "system", label: "部门管理-列表" },
  { code: "system:department:create", group: "system", label: "部门管理-创建" },
  { code: "system:department:update", group: "system", label: "部门管理-更新" },
  { code: "system:department:delete", group: "system", label: "部门管理-删除" },
  { code: "system:position:list", group: "system", label: "岗位管理-列表" },
  { code: "system:position:create", group: "system", label: "岗位管理-创建" },
  { code: "system:position:update", group: "system", label: "岗位管理-更新" },
  { code: "system:position:delete", group: "system", label: "岗位管理-删除" },
  { code: "system:dict:list", group: "system", label: "字典管理-列表" },
  { code: "system:dict:create", group: "system", label: "字典管理-创建" },
  { code: "system:dict:update", group: "system", label: "字典管理-更新" },
  { code: "system:dict:delete", group: "system", label: "字典管理-删除" },
  { code: "system:attachment:list", group: "system", label: "附件管理-列表" },
  { code: "system:attachment:create", group: "system", label: "附件管理-创建" },
  { code: "system:attachment:update", group: "system", label: "附件管理-更新" },
  { code: "system:attachment:delete", group: "system", label: "附件管理-删除" },
  { code: "system:plugin:list", group: "system", label: "插件管理-列表" },
  { code: "system:plugin:install", group: "system", label: "插件管理-安装" },
  { code: "system:plugin:enable", group: "system", label: "插件管理-启用" },
  { code: "system:plugin:disable", group: "system", label: "插件管理-禁用" },
  { code: "system:plugin:sync", group: "system", label: "插件管理-同步" },
  { code: "system:plugin:audit", group: "system", label: "插件管理-审计" },
  { code: "system:option:list", group: "system", label: "系统选项-列表" },
  { code: "system:option:update", group: "system", label: "系统选项-更新" },
  { code: "system:dashboard:read", group: "system", label: "仪表盘-读取" },
  { code: "system:login-log:list", group: "system", label: "登录日志-列表" },
  { code: "system:region:list", group: "system", label: "地区管理-列表" },
  { code: "system:storage:list", group: "system", label: "存储管理-列表" },
  { code: "system:storage:update", group: "system", label: "存储管理-更新" },
  { code: "system:storage:upload-token", group: "system", label: "存储管理-上传令牌" },
  { code: "system:token:list", group: "system", label: "API Token-列表" },
  { code: "system:token:cleanup", group: "system", label: "API Token-清理" },
  { code: "system:api-token:manage", group: "system", label: "API Token-管理" },
  // NOTE: shop/portal/hello 权限已移至对应插件 manifest
  // Core 权限仅包含 system: 前缀的权限
];

// Development environment integrity assertion
if (process.env.NODE_ENV !== 'production') {
  // system: 前缀的权限必须在 PERMISSION_DEFINITIONS 中定义
  const systemCodes = Object.values(PERMISSION_CODES).filter(c => c.startsWith('system:'));
  for (const code of systemCodes) {
    if (!PERMISSION_DEFINITIONS.find(d => d.code === code)) {
      throw new Error(`Missing definition for system permission code: ${code}`);
    }
  }

  // Core PERMISSION_DEFINITIONS 必须全部在 PERMISSION_CODES 中有定义
  for (const def of PERMISSION_DEFINITIONS) {
    if (!Object.values(PERMISSION_CODES).includes(def.code as any)) {
      throw new Error(`Definition for '${def.code}' not found in PERMISSION_CODES`);
    }
  }

  // shop/portal 权限已从 Core PERMISSION_DEFINITIONS 移除，改为由插件 manifest 提供
  // PERMISSION_CODES 中保留这些常量用于路由权限校验
}
