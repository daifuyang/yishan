import type { FastifyInstance, RouteShorthandOptions } from 'fastify'

import type { PermissionRef } from './permissions.js'
import type { PluginServer } from './types.js'

export type RouteAccess =
  | 'public'
  | 'authenticated'
  | { readonly permission: PermissionRef }

export interface ManagedRouteOptions
  extends Omit<RouteShorthandOptions, 'preHandler'> {
  /** Every business route must make its authentication decision explicit. */
  access: RouteAccess
  /** Guards that run after authentication and permission checks. */
  preHandler?: RouteShorthandOptions['preHandler']
  // Fastify v5 puts OpenAPI metadata (summary/description/tags/operationId/
  // security) on RouteOptions as top-level fields, not inside `schema`. Some
  // plugins historically nested them inside `schema` — we accept both via
  // an index signature so plugin authors can write either style without
  // fighting the type checker.
  [key: string]: unknown
}

type ManagedRouteMethod = <T = unknown>(
  url: string,
  options: ManagedRouteOptions,
  handler: any,
) => FastifyInstance

export interface RouteRegistrar {
  get: ManagedRouteMethod
  post: ManagedRouteMethod
  put: ManagedRouteMethod
  patch: ManagedRouteMethod
  delete: ManagedRouteMethod
}

function asHandlers(
  value: RouteShorthandOptions['preHandler'],
): NonNullable<RouteShorthandOptions['preHandler']>[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** Register Fastify routes while enforcing an explicit access policy. */
export function createRouteRegistrar(fastify: FastifyInstance): RouteRegistrar {
  const server = fastify as PluginServer
  const register = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  ): ManagedRouteMethod => (url, options, handler) => {
    const { access, preHandler, schema, ...rest } = options
    const guards: unknown[] = []
    let routeSchema = schema as Record<string, unknown> | undefined

    if (access === 'authenticated') {
      guards.push(server.authenticate)
    } else if (access !== 'public') {
      guards.push(
        server.authenticate,
        server.requirePermission(access.permission),
      )
      routeSchema = {
        ...(routeSchema ?? {}),
        'x-permission-code': access.permission.code,
        'x-permission-label': access.permission.label,
      }
    }

    return (fastify[method] as any)(
      url,
      {
        ...rest,
        schema: routeSchema,
        preHandler: [...guards, ...asHandlers(preHandler)],
      },
      handler,
    )
  }

  return {
    get: register('get'),
    post: register('post'),
    put: register('put'),
    patch: register('patch'),
    delete: register('delete'),
  }
}
