import { AsyncLocalStorage } from 'node:async_hooks'
import type { FastifyInstance } from 'fastify'
import type { UserDirectory, UserExtension, UserMutation, UserLifecycleEvent, PermissionRef } from '@yishan/core-contracts'
import { PermissionCatalog } from '@yishan/core-api'
import { runWithPermissions } from '@yishan/core-api/permissions/catalog'
import type { SystemDatabase } from './db'
import type { SystemConfig } from './config/create'
import type { PermissionCacheEntry } from './core/services/permission.service'
import type { EnumCacheEntry } from './core/services/enum.service'
import { assertJwtSecretOrThrow } from './core/plugins/external/jwt-secret-validator'
import { createUserDirectory, toUserIdentity } from './users'
import type { SysUserResp } from './core/schemas/user'
import { setupSystem } from './setup'
import { createModuleStateStore } from './module-state'
import { createModuleAdministration } from './module-administration'

const scope = new AsyncLocalStorage<SystemRuntime>()

export function currentSystemRuntime(): SystemRuntime {
  const runtime = scope.getStore()
  if (!runtime) throw new Error('SystemRuntime scope is missing. Call runtime.run() for requests, startup and maintenance operations.')
  return runtime
}

export interface SystemRuntimeOptions {
  database: SystemDatabase
  config: SystemConfig
  extensions?: readonly UserExtension[]
  redis?: false | Record<string, unknown>
  staticAssets?: boolean
  onExtensionError?: (error: unknown, extensionId: string, event: UserLifecycleEvent) => void
}

export class SystemRuntime {
  readonly database: SystemDatabase
  readonly config: SystemConfig
  readonly permissions = new PermissionCatalog()
  readonly caches = {
    permissions: new Map<string, PermissionCacheEntry>(),
    enums: new Map<string, EnumCacheEntry>(),
    crud: new Set<string>(),
    routeDeclarations: new Map<string, PermissionRef>(),
    systemPermissionCodes: new Set<string>(),
  }
  readonly users: UserDirectory
  readonly moduleState: ReturnType<typeof createModuleStateStore>
  readonly moduleAdministration: ReturnType<typeof createModuleAdministration>
  readonly pendingSeedRoleIds = new Set<number>()
  private readonly extensions: readonly UserExtension[]

  constructor(readonly options: SystemRuntimeOptions) {
    assertJwtSecretOrThrow({ secret: options.config.JWT_CONFIG.secret, env: options.config.APP_CONFIG.nodeEnv, allowWeak: options.config.allowWeakJwt })
    this.database = options.database
    this.config = structuredClone(options.config)
    this.extensions = options.extensions ?? []
    const ids = new Set<string>()
    for (const extension of this.extensions) {
      if (!extension.id || ids.has(extension.id)) throw new Error(`Duplicate or empty user extension id: ${extension.id}`)
      ids.add(extension.id)
    }
    this.users = createUserDirectory(this)
    this.moduleState = createModuleStateStore(this)
    this.moduleAdministration = createModuleAdministration(this)
  }

  run<T>(fn: () => T): T {
    return scope.run(this, () => runWithPermissions(this.permissions, fn))
  }

  setup(fastify: FastifyInstance): Promise<void> {
    return this.run(() => setupSystem(fastify, this))
  }

  async validateUser(mutation: UserMutation): Promise<void> {
    for (const extension of this.extensions) await extension.validate?.(mutation)
  }

  async notifyUser(saved: Omit<UserLifecycleEvent, 'user'> & { user: SysUserResp }): Promise<void> {
    const event: UserLifecycleEvent = { ...saved, user: toUserIdentity(saved.user) }
    for (const extension of this.extensions) {
      try { await extension.onEvent?.(event) }
      catch (error) {
        // Persistence succeeded. Notification failure must not turn it into a failed save.
        try {
          if (this.options.onExtensionError) this.options.onExtensionError(error, extension.id, event)
          else console.error(`User extension notification failed: ${extension.id}`)
        } catch { console.error(`User extension error reporter failed: ${extension.id}`) }
      }
    }
  }
}

export function createSystemRuntime(options: SystemRuntimeOptions): SystemRuntime {
  return new SystemRuntime(options)
}
