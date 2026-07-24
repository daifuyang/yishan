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
// 仅在 registerPermissions 内写入；外部通过 PERMISSION_CODES 拿到的是冻结视图。
// 用 as ReadonlySet<string> 强转以表达"外部不可 mutate"的契约。
let CODES_BUILDER: Set<string> = new Set();

/**
 * 在启动期注册权限声明。每个 `code` 全局唯一；重复注册 throw。
 * 调用时机：本文件被 import 时，由 routes 文件模块顶层副作用触发。
 * 第一次调用本函数后，CODES 即被冻结为只读视图——后续任何 CODES.add() 都会失败。
 */
export const registerPermissions = (...defs: readonly PermissionRef[]): void => {
  for (const def of defs) {
    if (!def.code || !def.label || !def.group) {
      throw new Error(`permission declaration requires code, label and group: ${JSON.stringify(def)}`);
    }
    if (CODES_BUILDER.has(def.code)) {
      throw new Error(`duplicate permission declaration: ${def.code}`);
    }
    CODES_BUILDER.add(def.code);
    REGISTRY.push(def);
  }
};

let _FROZEN_CODES: ReadonlySet<string> | null = null;
function getCodesReadonly(): ReadonlySet<string> {
  if (!_FROZEN_CODES) {
    // 一次性冻结视图：从此任何 CODES.add() 都不会反映进来。
    _FROZEN_CODES = Object.freeze(new Set(CODES_BUILDER)) as ReadonlySet<string>;
  }
  return _FROZEN_CODES;
}

/**
 * 当前已注册的所有 code 集合的只读视图。
 * 外部代码只能 has() / for..of；不能 add() / delete()。
 * 新增只能通过 registerPermissions（启动期）。
 */
export const PERMISSION_CODES: ReadonlySet<string> = new Proxy(new Set(), {
  has: (_t, p) => getCodesReadonly().has(p as string),
  get: (_t, p) => {
    const s = getCodesReadonly() as any;
    return s[p];
  },
  ownKeys: () => [...getCodesReadonly().keys()],
  getOwnPropertyDescriptor: (_t, p) => {
    const s = getCodesReadonly() as any;
    return s.has(p) ? { configurable: true, enumerable: true, value: s[p], writable: false } : undefined;
  },
});

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
