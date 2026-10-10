import type { Database } from '@yishan/core-database'
import type { schema } from './schema'
import { currentSystemRuntime } from '../runtime'

export type SystemDatabase = Database<typeof schema>
export type AppDb = SystemDatabase['db']
export type AppTx = Parameters<Parameters<AppDb['transaction']>[0]>[0]
export type AppQueryDb = AppDb | AppTx

// The facade resolves the explicit request/operation scope on every access.
export const drizzleDb: AppDb = new Proxy({} as AppDb, {
  get: (_target, property) => {
    const db = currentSystemRuntime().database.db
    const value = Reflect.get(db, property)
    return typeof value === 'function' ? value.bind(db) : value
  },
})

export const dbManager = {
  connect: () => currentSystemRuntime().database.connect(),
  disconnect: () => currentSystemRuntime().database.close(),
  healthCheck: () => currentSystemRuntime().database.healthCheck(),
  getConnectionStatus: () => currentSystemRuntime().database.getConnectionStatus(),
  transaction<T>(fn: (tx: AppTx) => Promise<T>): Promise<T> {
    return currentSystemRuntime().database.transaction(fn)
  },
}
