import type { FastifyInstance, RouteShorthandOptions } from 'fastify';
import type { PermissionRef } from '../permissions/define-permissions.js';

export type RouteAccess =
  | 'public'
  | 'authenticated'
  | { readonly permission: PermissionRef };

export interface ManagedRouteOptions extends Omit<RouteShorthandOptions, 'preHandler'> {
  /** Every business route must make its authentication decision explicit. */
  access: RouteAccess;
  /** Guards that run after authentication and permission checks. */
  preHandler?: RouteShorthandOptions['preHandler'];
}

type ManagedRouteMethod = <T = unknown>(
  url: string,
  options: ManagedRouteOptions,
  // Preserve the existing route files' request generic types. Fastify's
  // shorthand overload is invoked internally after this boundary.
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

/**
 * Registers API routes with an explicit access policy.
 *
 * The wrapper is deliberately small: it delegates Fastify schema and handler
 * behavior unchanged while owning the security and OpenAPI metadata contract.
 */
export function createRouteRegistrar(fastify: FastifyInstance): RouteRegistrar {
  const register = (method: 'get' | 'post' | 'put' | 'patch' | 'delete'): ManagedRouteMethod => (
    url,
    options,
    handler,
  ) => {
    const { access, preHandler, schema, ...rest } = options;
    const guards: unknown[] = [];
    let routeSchema = schema as Record<string, unknown> | undefined;

    if (access === 'authenticated') {
      guards.push(fastify.authenticate);
    } else if (access !== 'public') {
      guards.push(fastify.authenticate, fastify.requirePermission(access.permission));
      routeSchema = { ...(routeSchema ?? {}), 'x-permission-code': access.permission.code, 'x-permission-label': access.permission.label };
    }

    return (fastify[method] as any)(url, {
      ...rest,
      schema: routeSchema,
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
