/**
 * disposable-database.ts — 集成测试的**可丢弃数据库夹具**。
 *
 * 只包含 product.test.ts 与 ai-user-creation.test.ts 都真正需要的东西：
 *
 *   1. 本地开发 MySQL 的连接参数（口令来自 `YISHAN_TEST_MYSQL_PASSWORD`，
 *      否则读 `infra/local-dev-stack.yml`，绝不写死任何凭据）。
 *   2. 建库、**连跑两次**迁移、检查迁移历史、按需启动若干 app 实例、销毁。
 *
 * 这里**刻意不含任何业务断言**。每个测试文件各自断言自己的东西 ——
 * 把 product 的断言搬过来会变成「共享的断言」，那种东西改一处就悄悄改了两处测试。
 *
 * 保护：库名必须匹配 `yishan_demo_test_<20 位 hex>`，建库与销毁前各校验一次。
 * 迁移永远不会落到业务库上。
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { createConnection, type Connection } from 'mysql2/promise'
import type { FastifyInstance } from 'fastify'

// 用编译产物加载：单元测试的源码加载器 / DB mock 会掩盖打包缺陷。
const requireCompiled = createRequire(resolve('dist/app.js'))
const { buildApp } = requireCompiled('./app.js') as typeof import('../../src/app')
const { loadConfig } = requireCompiled('./config/index.js') as typeof import('../../src/config')
const { demoModules } = requireCompiled('./manifest.js') as typeof import('../../src/manifest')
const { createDatabase, migrateDatabase, inspectMigrationHistory } = requireCompiled('@yishan/core-database') as typeof import('@yishan/core-database')
const { systemModule, seedSystem, finalizeSystemSeed } = requireCompiled('@yishan/core-system-api') as typeof import('@yishan/core-system-api')
const { schema } = requireCompiled('@yishan/core-system-api/schema') as typeof import('@yishan/core-system-api/schema')

export const ADMIN_PASSWORD = 'IntegrationAdmin123'
export const CREATED_USER_PASSWORD = 'IntegrationUser123'

export function assertDisposable(name: string) {
  if (!/^yishan_demo_test_[a-f0-9]{20}$/.test(name)) throw new Error('Refusing to mutate a non-test database')
}

/** 本地开发 MySQL 的连接参数与口令。口令不来自仓库里的任何明文配置以外的来源。 */
export function localMysqlConnection(): { host: string; port: number; user: string; password: string } {
  const stack = readFileSync(resolve('../../../infra/local-dev-stack.yml'), 'utf8')
  const password = process.env.YISHAN_TEST_MYSQL_PASSWORD
    ?? /^\s*MYSQL_ROOT_PASSWORD:\s*([^\r\n]+)$/m.exec(stack)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (!password) throw new Error('Local development MySQL password is missing')
  return { host: '127.0.0.1', port: 3306, user: 'root', password }
}

export interface DisposableStack {
  readonly name: string
  readonly database: ReturnType<typeof createDatabase>
  readonly jwtSecret: string
  /** 新建一个**独立连接池**的 app 实例。并发测试需要两个互不相干的实例。 */
  buildInstance(): Promise<FastifyInstance>
  /** 把全部迁移**连跑两次**，返回第二次之后仍然为空的 pending 列表。 */
  migrateTwice(): Promise<{ id: string; pending: readonly string[] }[]>
  seed(app: FastifyInstance): Promise<void>
  close(): Promise<void>
}

export async function createDisposableStack(): Promise<DisposableStack> {
  const connection = localMysqlConnection()
  const name = `yishan_demo_test_${randomBytes(10).toString('hex')}`
  assertDisposable(name)
  const admin: Connection = await createConnection(connection)
  const database = createDatabase({ connection: { ...connection, database: name }, schema })
  let ownsSchema = false
  const instances: FastifyInstance[] = []
  const jwtSecret = randomBytes(32).toString('hex')
  try {
    await admin.query('CREATE DATABASE ??', [name])
    ownsSchema = true
  } catch (error) {
    await database.close()
    await admin.end()
    throw error
  }

  const manifests = [systemModule, ...demoModules].flatMap(module => (module.migrations ? [module.migrations] : []))

  return {
    name,
    database,
    jwtSecret,
    async migrateTwice() {
      // 跑两次是**断言**：迁移必须幂等，否则第二次会把已有数据冲掉。
      await migrateDatabase(database.db, manifests)
      await migrateDatabase(database.db, manifests)
      return inspectMigrationHistory(database.db, manifests)
    },
    async buildInstance() {
      const config = loadConfig({
        NODE_ENV: 'development',
        LOG_LEVEL: 'silent',
        JWT_SECRET: jwtSecret,
        DATABASE_URL: `mysql://root:${encodeURIComponent(connection.password)}@127.0.0.1:3306/${name}`,
        SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
      })
      const app = await buildApp(config, demoModules, { redis: false, staticAssets: false })
      instances.push(app)
      return app
    },
    async seed(app) {
      await app.system.run(async () => {
        await seedSystem()
        for (const module of demoModules) await module.seed?.(app.system)
        await finalizeSystemSeed()
      })
    },
    async close() {
      try {
        for (const app of instances) await app.close().catch(() => undefined)
        await database.close()
      } finally {
        try {
          if (ownsSchema) { assertDisposable(name); await admin.query('DROP DATABASE ??', [name]) }
        } finally {
          await admin.end()
        }
      }
    },
  }
}

/** 真实登录取令牌。夹具里不硬编码任何令牌。 */
export async function loginHeaders(app: FastifyInstance, username: string, password: string): Promise<{ authorization: string }> {
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username, password } })
  if (response.statusCode !== 200) throw new Error(`Login failed for ${username}: ${response.body}`)
  return { authorization: `Bearer ${response.json<{ data: { token: string } }>().data.token}` }
}
