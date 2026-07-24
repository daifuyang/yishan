/**
 * route-registrar.ts — 业务路由统一入口。
 *
 * 单一职责：
 *   1. 根据路由声明的 `access.permission` 拼装 preHandler 链（authenticate + requirePermission）；
 *   2. 把 perm 元数据写入 OpenAPI schema；
 *   3. 把 `x-*-auth-flavor` 之类的 rbac 元信息由 requirePermission 自身负责 onRoute hook 注入；
 *
 * 不参与具体的权限校验——那是 rbac.ts 的工作。
 */

import type { FastifyInstance, RouteShorthandOptions } from 'fastify';
import { isBypassCode, type PermissionRef } from '../permissions/catalog.js';

export type RouteAccess = {
  readonly permission: PermissionRef;
  /**
   * 使用 softAuthenticate 替代 authenticate：允许请求体中的 token 字段作为
   * Authorization header 的回退。仅用于"鸡生蛋"类接口（如 logout），其他路由不应设置。
   * 当 softAuth=true 时，route-registrar 不会再注入标准 authenticate。
   */
  readonly softAuth?: boolean;
};

export interface ManagedRouteOptions extends Omit<RouteShorthandOptions, 'preHandler'> {
  /** 每个业务路由必须显式声明它要求的权限点。'public' / 'authenticated' 不再允许——所有路由都注入唯一的 PERMS.code，rbac 通过 BYPASS_CODES 决定是否真正拦截。 */
  access: RouteAccess;
  /** 业务侧的额外 preHandler，会在 authenticate + requirePermission 之后追加。 */
  preHandler?: RouteShorthandOptions['preHandler'];
}

type ManagedRouteMethod = <T = unknown>(
  url: string,
  options: ManagedRouteOptions,
  handler: any,
) => FastifyInstance;

export interface RouteRegistrar {
  get: ManagedRouteMethod;
  post: ManagedRouteMethod;
  put: ManagedRouteMethod;
  patch: ManagedRouteMethod;
  delete: ManagedRouteMethod;
}

function asHandlers(value: RouteShorthandOptions['preHandler']): NonNullable<RouteShorthandOptions['preHandler']>[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** 把 PERM 元数据写入 schema。供 admin 客户端与 OpenAPI 文档生成使用。 */
function decorateSchema(
  schema: Record<string, unknown> | undefined,
  permission: PermissionRef,
): Record<string, unknown> {
  return {
    ...(schema ?? {}),
    'x-permission-code': permission.code,
    'x-permission-label': permission.label,
    'x-permission-group': permission.group,
  };
}

/* ---------- Fastify decorator shape ---------- */

export function createRouteRegistrar(fastify: FastifyInstance): RouteRegistrar {
  const register = (method: 'get' | 'post' | 'put' | 'patch' | 'delete'): ManagedRouteMethod => (
    url,
    options,
    handler,
  ) => {
    const { access, preHandler, schema, ...rest } = options;
    const guards: unknown[] = [];
    // BYPASS_CODES（login / refresh / cron / health）= 完全 public：
    // 不挂 authenticate，不挂 requirePermission；可选的 preHandler 仍追加。
    // 这与生产语义一致（"健康检查不需要 token"），也让 mock 友好。
    if (!isBypassCode(access.permission.code)) {
      if (access.softAuth && typeof (fastify as any).softAuthenticate === 'function') {
        // softAuth: true —— 鸡生蛋接口（logout 等）：用 softAuthenticate 替代 authenticate
        guards.push((fastify as any).softAuthenticate);
      } else if (typeof (fastify as any).authenticate === 'function') {
        guards.push((fastify as any).authenticate);
      }
      if (typeof (fastify as any).requirePermission === 'function') {
        guards.push((fastify as any).requirePermission(access.permission));
      }
    }

    return (fastify[method] as any)(url, {
      ...rest,
      schema: decorateSchema(schema as Record<string, unknown> | undefined, access.permission),
      preHandler: [...guards, ...asHandlers(preHandler)],
    }, handler);
  };

  return {
    get: register('get'),
    post: register('post'),
    put: register('put'),
    patch: register('patch'),
    delete: register('delete'),
  };
}
