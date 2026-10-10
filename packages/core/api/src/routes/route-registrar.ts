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
