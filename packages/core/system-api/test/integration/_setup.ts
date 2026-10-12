import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mysql from 'mysql2/promise'
import { it as baseIt } from 'vitest'
import { createDatabase, migrateDatabase } from '@yishan/core-database'
import { systemModule } from '@yishan/core-system-api'
import { createSystemConfig, createSystemRuntime, type SystemRuntime } from '../../src'
import { schema } from '../../src/db/schema'

export interface IntegrationContext {
  skip: boolean
  pool?: mysql.Pool
  closeDb?: () => Promise<void>
}

let runtime: SystemRuntime | undefined

function assertDisposable(name: string) {
  if (!/^yishan_system_test_[a-f0-9]{20}$/.test(name)) throw new Error('Refusing to mutate a non-test database')
}

export async function setupIntegration(): Promise<IntegrationContext> {
  if (process.env.YISHAN_RUN_INTEGRATION !== '1') return { skip: true }
  const stack = readFileSync(resolve('../../../infra/local-dev-stack.yml'), 'utf8')
  const password = process.env.YISHAN_TEST_MYSQL_PASSWORD ?? /^\s*MYSQL_ROOT_PASSWORD:\s*([^\r\n]+)$/m.exec(stack)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (!password) throw new Error('Local MySQL development password is missing')
  const name = `yishan_system_test_${randomBytes(10).toString('hex')}`
  assertDisposable(name)
  const connection = { host: '127.0.0.1', port: 3306, user: 'root', password }
  const admin = await mysql.createConnection(connection)
  const database = createDatabase({ connection: { ...connection, database: name }, schema })
  let ownsSchema = false
  const closeDb = async () => {
    try { await database.close() }
    finally {
      try { if (ownsSchema) { assertDisposable(name); await admin.query('DROP DATABASE ??', [name]) } }
      finally { await admin.end() }
    }
  }
  try {
    await admin.query('CREATE DATABASE ??', [name])
    ownsSchema = true
    await migrateDatabase(database.db, [systemModule.migrations!])
    runtime = createSystemRuntime({ database, config: createSystemConfig({ NODE_ENV: 'test', JWT_SECRET: randomBytes(32).toString('hex') }, resolve('.')), redis: false, staticAssets: false })
    return { skip: false, pool: database.pool, closeDb }
  } catch (error) { await closeDb(); throw error }
}

function scoped<T extends (...args: never[]) => unknown>(original: T): T {
  return new Proxy(original, {
    apply(target, receiver, args) {
      const index = args.findIndex(value => typeof value === 'function')
      if (index >= 0) {
        const callback = args[index] as (...values: unknown[]) => unknown
        args[index] = (...values: unknown[]) => runtime ? runtime.run(() => callback(...values)) : callback(...values)
      }
      return Reflect.apply(target, receiver, args)
    },
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => scoped(Reflect.apply(value, target, args))
    },
  })
}

export const it = scoped(baseIt)
