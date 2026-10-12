import { beforeEach as baseBeforeEach, beforeAll as baseBeforeAll, afterEach as baseAfterEach, afterAll as baseAfterAll, it as baseIt, test as baseTest } from 'vitest'
import { createSystemConfig, createSystemRuntime, type SystemRuntime } from '../src'
import { drizzleDb, dbManager } from './mocks/drizzle'
import type { SystemDatabase } from '../src/db'
import type { PermissionRef } from '@yishan/core-contracts'

export * from 'vitest'
let runtime: SystemRuntime
let declarations: readonly PermissionRef[] = []

export function resetTestRuntime(): SystemRuntime {
  runtime = createSystemRuntime({
    database: { db: drizzleDb, connect: dbManager.connect, close: dbManager.disconnect, healthCheck: dbManager.healthCheck, transaction: drizzleDb.transaction, getConnectionStatus: dbManager.getConnectionStatus } as unknown as SystemDatabase,
    config: createSystemConfig({ NODE_ENV: 'test', JWT_SECRET: 'unit-test-secret-for-system-api-scope-123456', CRON_TOKEN: 'unit-cron-token-1234567890', ADMIN_REDIRECT_ROOT: 'false' }, process.cwd()),
    redis: false, staticAssets: false,
  })
  const register = runtime.permissions.register.bind(runtime.permissions)
  runtime.permissions.register = (...defs) => register(...defs.filter(def => !runtime.permissions.has(def.code)))
  runtime.permissions.register(...declarations)
  for (const definition of declarations) runtime.caches.systemPermissionCodes.add(definition.code)
  return runtime
}
export function testRuntime(): SystemRuntime { return runtime ?? resetTestRuntime() }
export function setTestPermissionDeclarations(defs: readonly PermissionRef[]): void { declarations = defs }

function wrapCallable<T extends (...args: never[]) => unknown>(original: T): T {
  return new Proxy(original, {
    apply(target, receiver, args) {
      const callbackIndex = args.findIndex(value => typeof value === 'function')
      if (callbackIndex >= 0) {
        const callback = args[callbackIndex] as (...values: unknown[]) => unknown
        args[callbackIndex] = (...values: unknown[]) => testRuntime().run(() => callback(...values))
      }
      return Reflect.apply(target, receiver, args)
    },
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver)
      if (typeof value !== 'function') return value
      if (property === 'each' || property === 'for') return (...args: unknown[]) => wrapCallable(Reflect.apply(value, target, args))
      return wrapCallable(value as T)
    },
  })
}
export const it = wrapCallable(baseIt)
export const test = wrapCallable(baseTest)
export const beforeEach = wrapCallable(baseBeforeEach)
export const beforeAll = wrapCallable(baseBeforeAll)
export const afterEach = wrapCallable(baseAfterEach)
export const afterAll = wrapCallable(baseAfterAll)
