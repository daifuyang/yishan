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
  /**
   * 公开权限点：只登记（OpenAPI、展示），运行时不挂 authenticate / requirePermission。
   * 用于登录、刷新令牌、健康检查等匿名接口。由声明它的路由文件（Core 或模块）自己标注，
   * Core 不维护业务码清单。
   */
  readonly public?: boolean;
}

/** 权限分组的展示元数据。分组由声明权限的一方（system 或模块）自己登记。 */
export interface PermissionGroupRef {
  readonly id: string;
  readonly label: string;
}

const REGISTRY: PermissionRef[] = [];
// 启动期 registerPermissions 持续写入；外部通过 PERMISSION_CODES 拿到的是同一个 Set。
// 类型声明为 ReadonlySet<string> 让 TypeScript 卡死外部 add() / delete()，运行时不 freeze。
// 重要：不能在 import 期 eager freeze（如 Object.freeze + 新 Set 快照），
// 否则测试环境下 setup.ts 在 beforeAll 才 import 路由文件、caller 又在 beforeAll 之前
// 第一次访问 PERMISSION_CODES，会冻结成空 Set，路由注册再也填不进来。
const CODES = new Set<string>();

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
    if (def.public === true) PUBLIC_CODES.add(def.code);
    REGISTRY.push(def);
  }
};

/**
 * 当前已注册的所有 code 集合的只读视图。
 * 外部代码只能 has() / for..of；add() / delete() 由 TypeScript 的 ReadonlySet
 * 类型在编译期拦住，运行时不 freeze（见上方注释）。
 */
export const PERMISSION_CODES: ReadonlySet<string> = CODES;

/** 启动期一次性复制为冻结数组；菜单创建、admin 后台展示使用。 */
export const listPermissions = (): ReadonlyArray<PermissionRef> =>
  Object.freeze([...REGISTRY]);

const PUBLIC_CODES = new Set<string>();
const GROUPS = new Map<string, PermissionGroupRef>();

/**
 * 登记权限分组的展示名（如 PAT 可授予范围的分组标题）。同一分组可重复登记，
 * 但 label 必须一致；未登记的分组展示时回退为分组 id。
 */
export const registerPermissionGroups = (...defs: readonly PermissionGroupRef[]): void => {
  for (const def of defs) {
    if (!def.id || !def.label) {
      throw new Error(`permission group requires id and label: ${JSON.stringify(def)}`);
    }
    const existing = GROUPS.get(def.id);
    if (existing && existing.label !== def.label) {
      throw new Error(`conflicting permission group label for ${def.id}: ${existing.label} vs ${def.label}`);
    }
    GROUPS.set(def.id, def);
  }
};

/** 已登记分组的展示名；未登记时返回 undefined。 */
export const getPermissionGroupLabel = (id: string): string | undefined => GROUPS.get(id)?.label;

/**
 * 是否为公开权限点（声明时 `public: true`）。公开 code 仍登记在目录中（OpenAPI、
 * admin 展示），但 route-registrar 不为其挂鉴权，rbac 也不做权限校验。
 *
 * 注意：'auth:logout' 不是公开权限。logout 必须携带有效 token 才能撤销当前用户
 * 会话，鉴权由 route-registrar 自动注入的 softAuthenticate + requirePermission 链完成。
 */
export const isBypassCode = (code: string): boolean => PUBLIC_CODES.has(code);
