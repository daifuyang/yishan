import type { IncomingMessage, ServerResponse } from 'node:http'
import '@fastify/swagger'
import type { FastifyInstance, FastifySchema, RawServerDefault, RouteGenericInterface, RouteHandlerMethod, RouteShorthandOptions, preHandlerHookHandler } from 'fastify'
import type { PermissionRef } from '../permissions/catalog'

export interface RouteAccess {
  readonly permission: PermissionRef
  readonly public?: boolean
  readonly softAuth?: boolean
}
export interface ManagedRouteOptions<Generic extends RouteGenericInterface = RouteGenericInterface> extends Omit<RouteShorthandOptions<RawServerDefault, IncomingMessage, ServerResponse, Generic>, 'preHandler'> {
  access: RouteAccess
  preHandler?: RouteShorthandOptions['preHandler']
}
type ManagedRouteMethod = <Generic extends RouteGenericInterface = RouteGenericInterface>(url: string, options: ManagedRouteOptions<Generic>, handler: RouteHandlerMethod<RawServerDefault, IncomingMessage, ServerResponse, Generic>) => FastifyInstance
export interface RouteRegistrar {
  get: ManagedRouteMethod
  post: ManagedRouteMethod
  put: ManagedRouteMethod
  patch: ManagedRouteMethod
  delete: ManagedRouteMethod
}

interface AuthenticationDecorators {
  authenticate?: preHandlerHookHandler
  softAuthenticate?: preHandlerHookHandler
  requirePermission?: (permission: PermissionRef) => preHandlerHookHandler
  /**
   * 建立行级数据权限上下文（system-api 的 data-scope 插件提供）。
   *
   * 必须是**路由级**钩子：Fastify 先跑实例级 preHandler 再跑路由级 preHandler，
   * 挂在实例上的话它会早于 authenticate 执行，那时 request.currentUser 还没挂上。
   * 因此由本文件在 guards 之后追加，保证「认证 → 权限校验 → 建范围 → 业务」。
   */
  establishDataScope?: preHandlerHookHandler
}

export function createRouteRegistrar(fastify: FastifyInstance): RouteRegistrar {
  const authentication = fastify as FastifyInstance & AuthenticationDecorators
  const register = (method: 'get' | 'post' | 'put' | 'patch' | 'delete'): ManagedRouteMethod => <Generic extends RouteGenericInterface>(url: string, options: ManagedRouteOptions<Generic>, handler: RouteHandlerMethod<RawServerDefault, IncomingMessage, ServerResponse, Generic>) => {
    const { access, preHandler, schema, ...rest } = options
    const isPublic = access.public === true
    const guards: preHandlerHookHandler[] = []
    if (!isPublic) {
      const authenticate = access.softAuth ? authentication.softAuthenticate : authentication.authenticate
      if (typeof authenticate !== 'function' || typeof authentication.requirePermission !== 'function') {
        throw new Error(`Protected route ${method.toUpperCase()} ${url} requires authenticate and requirePermission decorators`)
      }
      guards.push(authenticate, authentication.requirePermission(access.permission))
      // 行级数据范围必须在认证与垂直权限都通过之后建立，且按**本次操作**的权限码计算。
      // 未提供该装饰器时跳过（例如尚未装配 system-api 的独立部署）。
      if (typeof authentication.establishDataScope === 'function') {
        guards.push(authentication.establishDataScope)
      }
    }
    const decoratedSchema: FastifySchema = {
      ...(schema ?? {}),
      'x-permission-code': access.permission.code,
      'x-permission-label': access.permission.label,
      'x-permission-group': access.permission.group,
      security: isPublic ? [] : [{ bearerAuth: [] }],
    }
    return fastify[method]<Generic>(url, {
      ...rest,
      schema: decoratedSchema,
      preHandler: [...guards, ...(preHandler ? (Array.isArray(preHandler) ? preHandler : [preHandler]) : [])],
    }, handler)
  }
  return { get: register('get'), post: register('post'), put: register('put'), patch: register('patch'), delete: register('delete') }
}

declare module 'fastify' {
  interface FastifySchema {
    security?: readonly Record<string, readonly string[]>[]
    'x-permission-code'?: string
    'x-permission-label'?: string
    'x-permission-group'?: string
  }
}
