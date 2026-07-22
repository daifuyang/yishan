/**
 * Permission catalog — 单一事实源。
 *
 * 每个路由文件就近 export `const PERMS = { ... }` 并调用 `registerPermissions(...)`，
 * 注册副作用在该文件被 import 时执行一次。Fastify @fastify/autoload 与 module autoload
 * 都会让所有 routes 文件被 import，从而完成注册。
 */

export interface PermissionRef {
  readonly code: string;
  readonly label: string;
  readonly group: string;
  readonly description?: string;
}

const REGISTRY: PermissionRef[] = [];
const CODES: Set<string> = new Set();

/**
 * 在启动期注册权限声明。每个 `code` 全局唯一；重复注册 throw。
 * 调用时机：本文件被 import 时，由 routes 文件模块顶层副作用触发。
 */
export const registerPermissions = (...defs: readonly PermissionRef[]): void => {
  for (const def of defs) {
    if (!def.code || !def.label || !def.group) {
      throw new Error(`permission declaration requires code, label and group: ${JSON.stringify(def)}`);
    }
    if (CODES.has(def.code)) {
      throw new Error(`duplicate permission declaration: ${def.code}`);
    }
    CODES.add(def.code);
    REGISTRY.push(def);
  }
};

/**
 * 当前已注册的所有 code 集合 — 与 CODES 共享引用。注册后会即时反映。
 * 导出为 ReadonlySet<string>，外部不能 mutate；新增只能通过 registerPermissions。
 */
export const PERMISSION_CODES: ReadonlySet<string> = CODES;

/** 启动期一次性复制为冻结数组；菜单创建、admin 后台展示使用。 */
export const listPermissions = (): ReadonlyArray<PermissionRef> =>
  Object.freeze([...REGISTRY]);

/**
 * 已知不需要 RBAC 角色持有的"公共"code：login / refresh / 定时任务回调 / 健康检查等。
 * 这些 code 仍然 catalog 注册（用于 OpenAPI、admin UI 展示），但运行时 rbac 跳过权限校验。
 * 仅认证身份，不强制要求 perm。
 *
 * 注意：'auth:logout' 不在本集合中。logout 必须携带有效 token 才能撤销当前用户
 * 会话，鉴权由 route-registrar 自动注入的 authenticate + requirePermission 链完成。
 */
export const BYPASS_CODES: ReadonlySet<string> = Object.freeze(
  new Set([
    'auth:login',
    'auth:refresh',
    'system:cron',
    'system:health',
    'system:options:public',
  ]),
);

export const isBypassCode = (code: string): boolean => BYPASS_CODES.has(code);
