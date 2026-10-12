import { beforeEach as baseBeforeEach, beforeAll as baseBeforeAll, afterEach as baseAfterEach, afterAll as baseAfterAll, it as baseIt, test as baseTest } from 'vitest'
import { createSystemConfig, createSystemRuntime } from '@yishan/core-system-api'
import type { SystemRuntimeOptions } from '@yishan/core-system-api'
import { drizzleDb, dbManager } from './mocks/drizzle'

export * from 'vitest'

export function createTestRuntime() {
  return createSystemRuntime({
    database: { db: drizzleDb, connect: dbManager.connect, close: dbManager.disconnect, healthCheck: dbManager.healthCheck, transaction: drizzleDb.transaction, getConnectionStatus: dbManager.getConnectionStatus } as unknown as SystemRuntimeOptions['database'],
    config: createSystemConfig({ NODE_ENV: 'test', JWT_SECRET: 'isolated-demo-test-secret-1234567890123456789', ADMIN_REDIRECT_ROOT: 'false' }, process.cwd()),
    redis: false, staticAssets: false,
  })
}
let runtime = createTestRuntime()
export function resetTestRuntime() { runtime = createTestRuntime() }
export function testRuntime() { return runtime }

function scoped<T extends (...args: never[]) => unknown>(original: T): T {
  return new Proxy(original, {
    apply(target, receiver, args) {
      const callbackIndex = args.findIndex(value => typeof value === 'function')
      if (callbackIndex >= 0) {
        const callback = args[callbackIndex] as (...values: unknown[]) => unknown
        args[callbackIndex] = (...values: unknown[]) => runtime.run(() => callback(...values))
      }
      return Reflect.apply(target, receiver, args)
    },
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver)
      if (typeof value !== 'function') return value
      if (property === 'each' || property === 'for') return (...args: unknown[]) => scoped(Reflect.apply(value, target, args))
      return scoped(value as T)
    },
  })
}
export const it = scoped(baseIt)
export const test = scoped(baseTest)
export const beforeEach = scoped(baseBeforeEach)
export const beforeAll = scoped(baseBeforeAll)
export const afterEach = scoped(baseAfterEach)
export const afterAll = scoped(baseAfterAll)
