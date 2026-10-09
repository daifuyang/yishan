import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createConnection, type RowDataPacket } from 'mysql2/promise'
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Require the actual compiled product, so no unit DB mocks or source loader hide packaging defects.
const requireCompiled = createRequire(resolve('dist/app.js'))
const { buildApp } = requireCompiled('./app.js') as typeof import('../../src/app')
const { loadConfig } = requireCompiled('./config/index.js') as typeof import('../../src/config')
const { demoModules } = requireCompiled('./manifest.js') as typeof import('../../src/manifest')
const { createDatabase, migrateDatabase, inspectMigrationHistory } = requireCompiled('@yishan/core-database') as typeof import('@yishan/core-database')
const { systemModule, seedSystem, finalizeSystemSeed } = requireCompiled('@yishan/core-system-api') as typeof import('@yishan/core-system-api')
const { schema } = requireCompiled('@yishan/core-system-api/schema') as typeof import('@yishan/core-system-api/schema')

function assertDisposable(name: string) {
  if (!/^yishan_demo_test_[a-f0-9]{20}$/.test(name)) throw new Error('Refusing to mutate a non-test database')
}

interface CountRow extends RowDataPacket { count: number }
interface ProfileRow extends RowDataPacket { user_id: number; last_event: string }
interface PasswordRow extends RowDataPacket { password_hash: string }
interface OpenApiOperation { operationId?: string; description?: string; security?: readonly Record<string, readonly string[]>[] }
interface OpenApiDocument { paths: Record<string, Record<string, OpenApiOperation>>; components?: { schemas?: Record<string, unknown> } }

describe.skipIf(process.env.YISHAN_DEMO_MYSQL_TEST !== '1')('compiled Demo product with disposable local MySQL', () => {
  it('migrates and seeds twice, authenticates, enforces permissions and closes its own resources', async () => {
    const stack = readFileSync(resolve('../../../infra/local-dev-stack.yml'), 'utf8')
    const password = process.env.YISHAN_TEST_MYSQL_PASSWORD ?? /^\s*MYSQL_ROOT_PASSWORD:\s*([^\r\n]+)$/m.exec(stack)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
    if (!password) throw new Error('Local development MySQL password is missing')
    const connection = { host: '127.0.0.1', port: 3306, user: 'root', password }
    const name = `yishan_demo_test_${randomBytes(10).toString('hex')}`
    assertDisposable(name)
    const admin = await createConnection(connection)
    let app: FastifyInstance | undefined
    let ownsSchema = false
    const database = createDatabase({ connection: { ...connection, database: name }, schema })
    try {
      await admin.query('CREATE DATABASE ??', [name])
      ownsSchema = true
      const manifests = [systemModule, ...demoModules].flatMap(module => module.migrations ? [module.migrations] : [])
      await migrateDatabase(database.db, manifests)
      await migrateDatabase(database.db, manifests)
      expect((await inspectMigrationHistory(database.db, manifests)).every(result => result.pending.length === 0)).toBe(true)
      const config = loadConfig({ NODE_ENV: 'development', LOG_LEVEL: 'silent', JWT_SECRET: randomBytes(32).toString('hex'),
        DATABASE_URL: `mysql://root:${encodeURIComponent(password)}@127.0.0.1:3306/${name}`, SEED_ADMIN_PASSWORD: 'IntegrationAdmin123' })
      app = await buildApp(config, demoModules, { redis: false, staticAssets: false })
      const activeApp = app
      const seed = () => activeApp.system.run(async () => {
        await seedSystem()
        for (const module of demoModules) await module.seed?.(activeApp.system)
        await finalizeSystemSeed()
      })
      await seed()
      const counts = async () => {
        const values: number[] = []
        for (const table of ['sys_user', 'sys_role', 'sys_menu', 'sys_role_menu', 'sys_role_permission', 'sys_enum']) {
          const [rows] = await database.pool.query<CountRow[]>('SELECT COUNT(*) AS count FROM ??', [table])
          values.push(Number(rows[0].count))
        }
        return values
      }
      const firstCounts = await counts()
      const [firstPassword] = await database.pool.query<PasswordRow[]>('SELECT password_hash FROM sys_user WHERE username = ?', ['admin'])
      await database.pool.query("UPDATE sys_option SET value = 'operator-customized', status = 0 WHERE id = (SELECT id FROM (SELECT id FROM sys_option ORDER BY id LIMIT 1) picked)")
      await database.pool.query("UPDATE sys_dict_type SET name = 'Customized dictionary', status = 0 WHERE id = (SELECT id FROM (SELECT id FROM sys_dict_type ORDER BY id LIMIT 1) picked)")
      await database.pool.query("UPDATE sys_dict_data SET label = 'Customized label', status = 0 WHERE id = (SELECT id FROM (SELECT id FROM sys_dict_data ORDER BY id LIMIT 1) picked)")
      await database.pool.query("UPDATE sys_role SET name = 'Customized administrator', status = 0, deleted_at = NOW() WHERE code = 'admin'")
      await database.pool.query("UPDATE sys_menu SET name = 'Customized regions', status = 0, deleted_at = NOW() WHERE path = '/demo/region'")
      await database.pool.query("UPDATE sys_menu SET name = 'Customized System menu', status = 0 WHERE id = (SELECT id FROM (SELECT id FROM sys_menu WHERE path LIKE '/system/%' ORDER BY id LIMIT 1) picked)")
      await database.pool.query("UPDATE sys_post SET description = 'Customized post', status = 0 WHERE id = (SELECT id FROM (SELECT id FROM sys_post ORDER BY id LIMIT 1) picked)")
      await database.pool.query("UPDATE sys_dept SET description = 'Customized department', status = 0 WHERE id = (SELECT id FROM (SELECT id FROM sys_dept ORDER BY id LIMIT 1) picked)")
      await database.pool.query("UPDATE sys_region SET name = 'Customized region', status = 0 WHERE code = 110000")
      await database.pool.query("UPDATE sys_role_permission SET deleted_at = NOW() WHERE permission_code = 'demo:health:read' AND role_id = (SELECT id FROM sys_role WHERE code = 'admin')")
      await database.pool.query("UPDATE sys_role_menu SET deleted_at = NOW() WHERE menu_id = (SELECT id FROM sys_menu WHERE path = '/demo/region') AND role_id = (SELECT id FROM sys_role WHERE code = 'admin')")
      await database.pool.query("UPDATE portal_categories SET name = 'Customized news', deleted_at = NOW() WHERE slug = 'news'")
      await database.pool.query("UPDATE portal_articles SET title = 'Customized welcome', deleted_at = NOW() WHERE slug = 'welcome'")
      const operatorState = async () => {
        const values: unknown[] = []
        for (const query of [
          'SELECT value,status FROM sys_option ORDER BY id LIMIT 1',
          'SELECT name,status FROM sys_dict_type ORDER BY id LIMIT 1',
          'SELECT label,status FROM sys_dict_data ORDER BY id LIMIT 1',
          "SELECT name,status,deleted_at FROM sys_role WHERE code = 'admin'",
          "SELECT name,status,deleted_at FROM sys_menu WHERE path = '/demo/region'",
          "SELECT name,status FROM sys_menu WHERE path LIKE '/system/%' ORDER BY id LIMIT 1",
          'SELECT description,status FROM sys_post ORDER BY id LIMIT 1',
          'SELECT description,status FROM sys_dept ORDER BY id LIMIT 1',
          'SELECT name,status FROM sys_region WHERE code = 110000',
          "SELECT deleted_at FROM sys_role_permission WHERE permission_code = 'demo:health:read' AND role_id = (SELECT id FROM sys_role WHERE code = 'admin')",
          "SELECT deleted_at FROM sys_role_menu WHERE menu_id = (SELECT id FROM sys_menu WHERE path = '/demo/region') AND role_id = (SELECT id FROM sys_role WHERE code = 'admin')",
          "SELECT name,deleted_at FROM portal_categories WHERE slug = 'news'",
          "SELECT title,deleted_at FROM portal_articles WHERE slug = 'welcome'",
          "SELECT category_id FROM portal_article_categories WHERE article_id = (SELECT id FROM portal_articles WHERE slug = 'welcome')",
        ]) { const [rows] = await database.pool.query<RowDataPacket[]>(query); expect(rows.length).toBeGreaterThan(0); values.push(rows) }
        return values
      }
      const customized = await operatorState()
      await seed()
      expect(await counts()).toEqual(firstCounts)
      expect(await operatorState()).toEqual(customized)
      const [secondPassword] = await database.pool.query<PasswordRow[]>('SELECT password_hash FROM sys_user WHERE username = ?', ['admin'])
      expect(secondPassword[0].password_hash).toBe(firstPassword[0].password_hash)
      expect((await app.inject('/api/v1/auth/me')).statusCode).toBe(401)
      const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'admin', password: 'IntegrationAdmin123' } })
      expect(login.statusCode, login.body).toBe(200)
      const headers = { authorization: `Bearer ${login.json<{ data: { token: string } }>().data.token}` }
      expect(login.headers['set-cookie']).toBeDefined()
      expect(login.headers['x-request-id']).toBeDefined()
      expect((await app.inject({ url: '/api/v1/auth/me', headers })).statusCode).toBe(200)
      expect((await app.inject({ url: '/api/demo/v1/info', headers })).statusCode).toBe(200)
      const profileResponse = await app.inject({ url: '/api/demo/v1/me/profile', headers })
      expect(profileResponse.statusCode, profileResponse.body).toBe(200)
      expect(profileResponse.json().data.user).toMatchObject({ username: 'admin' })
      expect(profileResponse.json().data.user).not.toHaveProperty('passwordHash')
      expect(profileResponse.json().data).toHaveProperty('profile')
      expect((await app.inject({ url: '/api/v1/admin/system/module-management/list/', headers })).statusCode).toBe(200)
      const createUser = async (username: string, phone: string) => app!.inject({ method: 'POST', url: '/api/v1/admin/users', headers,
        payload: { username, phone, realName: username, password: 'IntegrationUser123' } })
      const blocked = await createUser('demo_service', '19900000001')
      expect(blocked.statusCode).toBe(400)
      const [reserved] = await database.pool.query<CountRow[]>('SELECT COUNT(*) AS count FROM sys_user WHERE username = ?', ['demo_service'])
      expect(Number(reserved[0].count)).toBe(0)
      const created = await createUser('integration_person', '19900000002')
      expect(created.statusCode, created.body).toBe(200)
      const userId = created.json<{ data: { id: number } }>().data.id
      const [profiles] = await database.pool.query<ProfileRow[]>('SELECT user_id,last_event FROM demo_user_profile WHERE user_id = ?', [userId])
      expect(profiles.map(row => row.last_event)).toEqual(['user.created'])
      const updated = await app.inject({ method: 'PUT', url: `/api/v1/admin/users/${userId}`, headers, payload: { nickname: 'Updated' } })
      expect(updated.statusCode, updated.body).toBe(200)
      const [updatedProfiles] = await database.pool.query<ProfileRow[]>('SELECT user_id,last_event FROM demo_user_profile WHERE user_id = ?', [userId])
      expect(updatedProfiles.map(row => row.last_event)).toEqual(['user.updated'])
      const personLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'integration_person', password: 'IntegrationUser123' } })
      expect(personLogin.statusCode, personLogin.body).toBe(200)
      const personHeaders = { authorization: `Bearer ${personLogin.json<{ data: { token: string } }>().data.token}` }
      expect((await app.inject({ url: '/api/v1/admin/users', headers: personHeaders })).statusCode).toBe(403)
      const pat = await app.inject({ method: 'POST', url: '/api/v1/me/api-tokens', headers, payload: { name: 'integration', duration: '7d', scopes: ['demo:health:read'] } })
      expect(pat.statusCode, pat.body).toBe(200)
      const patData = pat.json<{ data: { id: number; token: string } }>().data
      const patHeaders = { authorization: `Bearer ${patData.token}` }
      expect((await app.inject({ url: '/api/demo/v1/info', headers: patHeaders })).statusCode).toBe(200)
      expect((await app.inject({ url: '/api/v1/admin/users', headers: patHeaders })).statusCode).toBe(403)
      expect((await app.inject({ method: 'DELETE', url: `/api/v1/me/api-tokens/${patData.id}`, headers })).statusCode).toBe(200)
      expect((await app.inject({ url: '/api/demo/v1/info', headers: patHeaders })).statusCode).toBe(401)
      expect(await app.system.moduleAdministration.list([])).toEqual([])
      expect(await app.system.moduleAdministration.setEnabled('missing', false)).toBeUndefined()
      expect(await app.system.moduleAdministration.setEnabled('demo', false)).toEqual({ previous: true })
      await app.moduleLoader.invalidateEnabledCache()
      const disabled = await app.inject({ url: '/api/demo/v1/info', headers })
      expect(disabled.statusCode).toBe(404)
      expect(disabled.json().code).toBe(40400)
      expect(await app.system.moduleAdministration.setEnabled('demo', true)).toEqual({ previous: false })
      await app.moduleLoader.invalidateEnabledCache()
      expect((await app.inject({ url: '/api/demo/v1/info', headers })).statusCode).toBe(200)
      const malformed = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {} })
      expect(malformed.statusCode).toBe(400)
      expect(malformed.body).not.toContain('stack')
      expect((await app.inject({ url: '/api/v1/auth/me', headers: { authorization: 'Bearer invalid' } })).statusCode).toBe(401)
      const missing = await app.inject('/missing')
      expect(missing.statusCode).toBe(404)
      expect(missing.json().code).toBe(25005)
      const current = app.swagger() as OpenApiDocument
      writeFileSync(resolve(tmpdir(), 'yishan-demo-runtime-openapi.json'), JSON.stringify(current, null, 2))
      const runtimeBaseline = JSON.parse(readFileSync(resolve('../../../docs/architecture/api-v1-runtime-openapi.json'), 'utf8')) as OpenApiDocument
      expect(Object.keys(runtimeBaseline.paths).filter(path => !current.paths[path])).toEqual([])
      expect(Object.keys(current.paths).filter(path => !runtimeBaseline.paths[path])).toEqual(['/api/demo/v1/me/profile'])
      for (const [path, methods] of Object.entries(runtimeBaseline.paths)) {
        const expected = structuredClone(methods)
        // The old document inherited global bearer auth for these actually public operations.
        if (path === '/api/v1/app/auth/login' || path === '/api/v1/app/auth/refresh') expected.post.security = []
        if (path === '/api/v1/admin/system/module-management/list/') expected.get.description = '显式安装清单中的业务模块及当前启停、挂载状态。'
        if (path === '/api/v1/admin/system/module-management/toggle/{id}/toggle') delete expected.post.description
        expect(current.paths[path], `OpenAPI operation/schema/security changed: ${path}`).toEqual(expected)
      }
      expect(current.components?.schemas).toEqual(runtimeBaseline.components?.schemas)
      expect(current.paths['/api/v1/auth/login'].post.security).toEqual([])
      expect(current.paths['/api/health'].get.security).toEqual([])
      expect(current.paths['/api/v1/admin/users/'].get.security).toEqual([{ bearerAuth: [] }])
      const baseline = JSON.parse(readFileSync(resolve('../../../docs/architecture/api-v1-openapi.json'), 'utf8')) as OpenApiDocument
      const operations = (spec: OpenApiDocument) => Object.entries(spec.paths).flatMap(([path, methods]) => Object.entries(methods)
        .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method)).map(([method, op]) => `${method.toUpperCase()} ${path} (${op.operationId ?? '-'})`)).sort()
      const before = operations(baseline), after = operations(current)
      const difference = { baselinePaths: Object.keys(baseline.paths).length, currentPaths: Object.keys(current.paths).length,
        removed: before.filter(op => !after.includes(op)), added: after.filter(op => !before.includes(op)) }
      writeFileSync(resolve(tmpdir(), 'yishan-demo-openapi-diff.json'), JSON.stringify(difference, null, 2))
      console.log('OpenAPI comparison:', JSON.stringify({ baselinePaths: difference.baselinePaths, currentPaths: difference.currentPaths,
        removedOperations: difference.removed.length, addedOperations: difference.added.length }))
      const appDatabase = app.system.database
      await app.close()
      app = undefined
      expect(await appDatabase.healthCheck()).toBe(false)
      const [rows] = await database.pool.query<CountRow[]>('SELECT 1 AS count')
      expect(rows[0].count).toBe(1)
    } finally {
      try { await app?.close(); await database.close() }
      finally { try { if (ownsSchema) { assertDisposable(name); await admin.query('DROP DATABASE ??', [name]) } } finally { await admin.end() } }
    }
  })
})
