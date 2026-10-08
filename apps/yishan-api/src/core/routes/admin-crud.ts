import type { FastifyRequest } from 'fastify'
import type { PermissionRef } from '@/core/permissions/catalog.js'
import { registerPermissions as defaultRegisterPermissions } from '@/core/permissions/catalog.js'
import { ResponseUtil } from '@/utils/response.js'
import type { RouteRegistrar } from '@/core/routes/route-registrar.js'

export type CrudAction = 'list' | 'create' | 'update' | 'delete'

const registeredCrudPermissionCodes = new Set<string>()

export type CrudMessages = Partial<Record<`${CrudAction}Success`, (acceptLanguage?: string) => string>>

export interface CrudListConfig {
  schema?: Record<string, unknown>
  path?: string
  service: (query: unknown, request: FastifyRequest) => Promise<{ list: unknown[]; total: number }>
}

export interface CrudMutationConfig {
  schema?: Record<string, unknown>
  path?: string
  service: (request: FastifyRequest) => Promise<unknown>
}

export interface CrudByIdConfig {
  schema?: Record<string, unknown>
  path?: string
  service: (id: number, request: FastifyRequest) => Promise<unknown>
  parseId?: (rawId: string) => number
}

export interface CrudUpdateConfig extends CrudByIdConfig {
  service: (id: number, request: FastifyRequest) => Promise<unknown>
}

export interface CrudDeleteConfig extends CrudByIdConfig {
  service: (id: number, request: FastifyRequest) => Promise<unknown>
}

export interface CrudPermissionConfig {
  resource: string
  group: string
  perms: Record<CrudAction, string>
}

export interface CrudHandlersOptions extends CrudPermissionConfig {
  messages?: CrudMessages
  predeclaredPermissions?: Record<CrudAction, PermissionRef>
  registerPermissions?: (...permissions: PermissionRef[]) => void
}

export interface CrudHandlers {
  permissions: Record<CrudAction, PermissionRef>
  list(config: CrudListConfig): void
  create(config: CrudMutationConfig): void
  update(config: CrudUpdateConfig): void
  delete(config: CrudDeleteConfig): void
}

function languageOf(request: FastifyRequest): string | undefined {
  return request.headers['accept-language'] as string | undefined
}

function parseId(rawId: string, customParser?: (rawId: string) => number): number {
  return customParser ? customParser(rawId) : Number(rawId)
}

function baseSchema(schema: Record<string, unknown> | undefined): Record<string, unknown> {
  return schema ? { ...schema } : {}
}

function buildCrudPermissions({ resource, group, perms }: CrudPermissionConfig): Record<CrudAction, PermissionRef> {
  return Object.fromEntries(
    (Object.keys(perms) as CrudAction[]).map((action) => [action, {
      code: `${group}:${resource}:${action}`,
      label: perms[action],
      group,
    }]),
  ) as Record<CrudAction, PermissionRef>
}

function registerDefaultCrudPermissions(permissions: Record<CrudAction, PermissionRef>): void {
  // Fastify route plugins are recreated in tests and can be mounted more than once.
  // Keep the process-wide permission catalog idempotent across those instances.
  const freshPermissions = Object.values(permissions).filter(({ code }) => !registeredCrudPermissionCodes.has(code))
  if (freshPermissions.length > 0) {
    defaultRegisterPermissions(...freshPermissions)
    freshPermissions.forEach(({ code }) => registeredCrudPermissionCodes.add(code))
  }
}

/** Declares the uniform CRUD permissions when an admin route module is imported. */
export function declareCrudPermissions(
  resource: string,
  group: string,
  perms: Record<CrudAction, string>,
): Record<CrudAction, PermissionRef> {
  const permissions = buildCrudPermissions({ resource, group, perms })
  registerDefaultCrudPermissions(permissions)
  return permissions
}

export function createCrudHandlers(route: RouteRegistrar, options: CrudHandlersOptions): CrudHandlers {
  const permissions = options.predeclaredPermissions ?? buildCrudPermissions(options)

  if (!options.predeclaredPermissions) {
    if (options.registerPermissions) {
      options.registerPermissions(...Object.values(permissions))
    } else {
      registerDefaultCrudPermissions(permissions)
    }
  }

  return {
    permissions,
    list(config) {
      route.get(config.path ?? '/', {
        access: { permission: permissions.list },
        schema: baseSchema(config.schema),
      }, async (request, reply) => {
        const result = await config.service(request.query, request)
        const query = request.query as { page?: number; pageSize?: number }
        const message = options.messages?.listSuccess?.(languageOf(request))
        return ResponseUtil.paginated(reply, result.list, query.page, query.pageSize, result.total, message)
      })
    },
    create(config) {
      route.post(config.path ?? '/', {
        access: { permission: permissions.create },
        schema: baseSchema(config.schema),
      }, async (request, reply) => {
        const result = await config.service(request)
        const message = options.messages?.createSuccess?.(languageOf(request))
        return ResponseUtil.success(reply, result, message)
      })
    },
    update(config) {
      route.put(config.path ?? '/:id', {
        access: { permission: permissions.update },
        schema: baseSchema(config.schema),
      }, async (request, reply) => {
        const id = parseId((request.params as { id: string }).id, config.parseId)
        const result = await config.service(id, request)
        const message = options.messages?.updateSuccess?.(languageOf(request))
        return ResponseUtil.success(reply, result, message)
      })
    },
    delete(config) {
      route.delete(config.path ?? '/:id', {
        access: { permission: permissions.delete },
        schema: baseSchema(config.schema),
      }, async (request, reply) => {
        const id = parseId((request.params as { id: string }).id, config.parseId)
        const result = await config.service(id, request)
        const message = options.messages?.deleteSuccess?.(languageOf(request))
        return ResponseUtil.success(reply, result, message)
      })
    },
  }
}
