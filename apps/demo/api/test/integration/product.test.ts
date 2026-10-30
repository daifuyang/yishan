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
const { AiExecutionEnvFactory } = requireCompiled('./modules/ai/services/ai-chat.service.js') as typeof import('../../src/modules/ai/services/ai-chat.service')

function assertDisposable(name: string) {
  if (!/^yishan_demo_test_[a-f0-9]{20}$/.test(name)) throw new Error('Refusing to mutate a non-test database')
}

interface CountRow extends RowDataPacket { count: number }
interface ProfileRow extends RowDataPacket { user_id: number; last_event: string }
interface PasswordRow extends RowDataPacket { password_hash: string }
interface OpenApiOperation { operationId?: string; description?: string; security?: readonly Record<string, readonly string[]>[] }
interface OpenApiSchema { properties?: Record<string, unknown> }
interface OpenApiDocument { paths: Record<string, Record<string, OpenApiOperation>>; components?: { schemas?: Record<string, OpenApiSchema> } }

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
      const chatUrl = '/api/ai/v1/conversations'
      expect((await app.inject(chatUrl)).statusCode).toBe(401)
      const chatCreated = await app.inject({ method: 'POST', url: chatUrl, headers })
      expect(chatCreated.statusCode, chatCreated.body).toBe(200)
      const chatId = chatCreated.json<{ data: { id: string } }>().data.id
      expect(chatId).toEqual(expect.any(String))
      await app.system.run(async () => {
        // Core system is always mounted and is deliberately absent from the optional-module table.
        expect(await activeApp.system.moduleState.enabledIds()).not.toContain('system')
        const user = await activeApp.system.users.findById(1)
        if (!user) throw new Error('Seed administrator is missing')
        const execution = await new AiExecutionEnvFactory({ db: activeApp.system.database.db }).env(
          { userId: user.id, roleIds: [...user.roleIds], deptIds: [...user.deptIds] },
          { requestId: 'integration-system-tools', conversationId: chatId },
        )
        for (const [name, input] of [
          ['list_users', { status: '1' }], ['get_user', { id: 1 }],
          ['list_roles', {}], ['get_role', { id: user.roleIds[0] }],
          ['list_departments', {}], ['get_department', { id: 1 }],
          ['prepare_create_user', { username: 'draft-user' }],
          ['prepare_update_user', { id: 1, realName: '草稿姓名' }],
          ['prepare_create_department', { name: '草稿部门' }],
        ] as const) {
          const outcome = await execution.execute(name, input)
          expect(outcome.ok, `${name}: ${JSON.stringify(outcome)}`).toBe(true)
        }
        const [audits] = await database.pool.query<RowDataPacket[]>('SELECT capability_name, execution_status FROM ai_audit WHERE request_id = ?', ['integration-system-tools'])
        expect(audits).toHaveLength(9)
        expect(audits.every(row => row.execution_status === 'success')).toBe(true)
      })
      // Structured collection uses only drafts until the final protected business request.
      const formDefinition = await app.inject({ url: '/api/v1/admin/users/create-form', headers })
      expect(formDefinition.statusCode, formDefinition.body).toBe(200)
      expect(formDefinition.json().data.fields).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'password', sensitive: true })]))
      const candidatesResponse = await app.inject({ url: '/api/v1/admin/users/create-options', headers })
      expect(candidatesResponse.statusCode, candidatesResponse.body).toBe(200)
      const candidates = candidatesResponse.json<{ data: { departments: { id: number; status: string }[]; roles: { id: number }[] } }>().data
      // 只挑**启用中**的部门。create-options 返回的是整棵树，种子把根部门置成了停用状态
      // （status '0'），按位置取 slice(0, 1) 会挑到它，草稿服务随即以 30011 拒绝 ——
      // 那是正确的拒绝，测试要的是一个真正可用的候选，不是「列表里碰巧第一个」。
      const creatableDepartments = candidates.departments.filter(department => department.status === '1')
            const interactionConversation = await app.inject({ method: 'POST', url: chatUrl, headers })
      const interactionConversationId = interactionConversation.json<{ data: { id: string } }>().data.id
      const prepared = await app.inject({ method: 'POST', url: chatUrl + '/' + interactionConversationId + '/drafts', headers,
        payload: { module: 'system', action: 'user.create', formData: { username: 'ai_interactive_user', phone: '17625458588', realName: '周杰伦', nickname: '阿伦' } } })
      expect(prepared.statusCode, prepared.body).toBe(200)
      const preparedDraft = prepared.json<{ data: { draftId: string; draftVersion: number } }>().data
      const answered = await app.inject({ method: 'PATCH', url: '/api/ai/v1/drafts/' + preparedDraft.draftId, headers,
        payload: { draftVersion: preparedDraft.draftVersion, formData: { deptIds: creatableDepartments.slice(0, 1).map(item => item.id), roleIds: candidates.roles.slice(0, 1).map(item => item.id) } } })
      expect(answered.statusCode, answered.body).toBe(200)
                  const reviewDraft = answered.json<{ data: { draftId: string; draftVersion: number; formData: Record<string, unknown> } }>().data
      const [beforeConfirm] = await database.pool.query<CountRow[]>('SELECT COUNT(*) AS count FROM sys_user WHERE username = ?', ['ai_interactive_user'])
      expect(Number(beforeConfirm[0].count)).toBe(0)
      expect(reviewDraft.formData).not.toHaveProperty('password')
      expect(reviewDraft.formData).not.toHaveProperty('avatar')
      const finalPayload = { ...reviewDraft.formData, password: 'InteractiveLocal123', avatar: '/uploads/test-avatar.png', draftSubmission: { draftId: reviewDraft.draftId, draftVersion: reviewDraft.draftVersion } }
      const confirmed = await app.inject({ method: 'POST', url: '/api/v1/admin/users', headers, payload: finalPayload })
      expect(confirmed.statusCode, confirmed.body).toBe(200)
      const confirmedUser = confirmed.json<{ data: { id: number; avatar: string } }>().data
      expect(confirmedUser.avatar).toBe('/uploads/test-avatar.png')
      const replayed = await app.inject({ method: 'POST', url: '/api/v1/admin/users', headers, payload: finalPayload })
      expect(replayed.statusCode, replayed.body).toBe(200)
      expect(replayed.json().data.id).toBe(confirmedUser.id)
      const [afterConfirm] = await database.pool.query<CountRow[]>('SELECT COUNT(*) AS count FROM sys_user WHERE username = ?', ['ai_interactive_user'])
      expect(Number(afterConfirm[0].count)).toBe(1)
      const receipt = await app.inject({ url: '/api/ai/v1/drafts/' + preparedDraft.draftId, headers })
      expect(receipt.json().data.status).toBe('completed')
      expect(JSON.stringify(receipt.json())).not.toContain('InteractiveLocal123')
      const chatRenamed = await app.inject({ method: 'PATCH', url: `${chatUrl}/${chatId}`, headers, payload: { title: '持久化验收' } })
      expect(chatRenamed.json().data.title).toBe('持久化验收')
      expect((await app.inject({ url: chatUrl, headers })).json().data.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: chatId, title: '持久化验收' })]))
      const [chatRows] = await database.pool.query<RowDataPacket[]>('SELECT owner_id, title FROM ai_conversations WHERE id = ?', [chatId])
      expect(chatRows[0].title).toBe('持久化验收')
      // A foreign owner's record is indistinguishable from an unknown conversation.
      await database.pool.query('UPDATE ai_conversations SET owner_id = ? WHERE id = ?', [Number(chatRows[0].owner_id) + 100000, chatId])
      expect((await app.inject({ url: `${chatUrl}/${chatId}`, headers })).statusCode).toBe(404)
      expect((await app.inject({ method: 'PATCH', url: `${chatUrl}/${chatId}`, headers, payload: { title: '越权修改' } })).statusCode).toBe(404)
      expect((await app.inject({ method: 'DELETE', url: `${chatUrl}/${chatId}`, headers })).statusCode).toBe(404)
      expect((await app.inject({ method: 'POST', url: '/api/ai/v1/chat', headers, payload: { id: chatId, messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: '你好' }] }], trigger: 'submit-message' } })).statusCode).toBe(404)
      await database.pool.query('UPDATE ai_conversations SET owner_id = ? WHERE id = ?', [chatRows[0].owner_id, chatId])
      expect((await app.inject({ method: 'DELETE', url: `${chatUrl}/${chatId}`, headers })).statusCode).toBe(200)
      expect((await app.inject({ url: `${chatUrl}/${chatId}`, headers })).statusCode).toBe(404)
      for (const module of ['portal', 'shop']) {
        const url = `/api/${module}/v1/categories/`
        const createdCategory = await app.inject({ method: 'POST', url, headers,
          payload: { name: `${module} response contract`, description: 'Created through HTTP' } })
        expect(createdCategory.statusCode, createdCategory.body).toBe(200)
        const category = createdCategory.json<{ id: number; name: string; createdAt: string }>()
        expect(category.id).toBeGreaterThan(0)
        expect(category.createdAt).toEqual(expect.any(String))
        expect(category).not.toHaveProperty('data')
        const updatedCategory = await app.inject({ method: 'PATCH', url: `${url}${category.id}`, headers,
          payload: { description: 'Updated through HTTP' } })
        expect(updatedCategory.statusCode, updatedCategory.body).toBe(200)
        expect(updatedCategory.json()).toMatchObject({ id: category.id, description: 'Updated through HTTP' })
        const categoryDetail = await app.inject({ url: `${url}${category.id}`, headers })
        expect(categoryDetail.statusCode, categoryDetail.body).toBe(200)
        expect(categoryDetail.json()).toMatchObject({ id: category.id, description: 'Updated through HTTP' })
        const removedCategory = await app.inject({ method: 'DELETE', url: `${url}${category.id}`, headers })
        expect(removedCategory.statusCode, removedCategory.body).toBe(200)
        expect(removedCategory.json()).toEqual({ success: true })
      }
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
      const createScopeRole = async (name: string, dataScope: string, permissionCodes: string[]) => {
        const response = await app!.inject({ method: 'POST', url: '/api/v1/admin/roles', headers,
          payload: { name, dataScope, permissionCodes } })
        expect(response.statusCode, response.body).toBe(200)
        return response.json<{ data: { id: number } }>().data.id
      }
      const selfRoleId = await createScopeRole('本人用户管理', '4', ['system:user:list', 'system:user:update', 'system:user:delete'])
      const unrelatedRoleId = await createScopeRole('无关全量角色', '1', ['system:role:list'])
      const assigned = await app.inject({ method: 'PUT', url: `/api/v1/admin/users/${userId}`, headers,
        payload: { roleIds: [selfRoleId, unrelatedRoleId] } })
      expect(assigned.statusCode, assigned.body).toBe(200)
      const restrictedList = await app.inject({ url: '/api/v1/admin/users', headers: personHeaders })
      expect(restrictedList.statusCode, restrictedList.body).toBe(200)
      expect(restrictedList.json().data.map((user: { id: number }) => user.id)).toEqual([userId])
      const deniedDetail = await app.inject({ url: '/api/v1/admin/users/1', headers: personHeaders })
      const missingDetail = await app.inject({ url: '/api/v1/admin/users/9999999', headers: personHeaders })
      expect(deniedDetail.json()).toMatchObject({ success: false, code: missingDetail.json().code })
      expect(deniedDetail.json().data).toEqual(missingDetail.json().data)
      expect(deniedDetail.json().data).not.toHaveProperty('id')
      const deniedUpdate = await app.inject({ method: 'PUT', url: '/api/v1/admin/users/1', headers: personHeaders, payload: { nickname: '越权修改' } })
      expect(deniedUpdate.json()).toMatchObject({ success: false, code: missingDetail.json().code })
      const customRoleId = await createScopeRole('自定义部门验收', '5', ['system:user:list'])
      const customUpdated = await app.inject({ method: 'PUT', url: `/api/v1/admin/roles/${customRoleId}`, headers,
        payload: { deptIds: [1, 1] } })
      expect(customUpdated.json().success, customUpdated.body).toBe(true)
      const customDetail = await app.inject({ url: `/api/v1/admin/roles/${customRoleId}`, headers })
      expect(customDetail.json().data.deptIds).toEqual([1])
      const switched = await app.inject({ method: 'PUT', url: `/api/v1/admin/roles/${customRoleId}`, headers,
        payload: { dataScope: '4' } })
      expect(switched.json().success, switched.body).toBe(true)
      const clearedDetail = await app.inject({ url: `/api/v1/admin/roles/${customRoleId}`, headers })
      expect(clearedDetail.json().data.deptIds).toEqual([])
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
      expect(current).toEqual(JSON.parse(readFileSync(resolve('openapi.json'), 'utf8')))
      const runtimeBaseline = JSON.parse(readFileSync(resolve('../../../docs/architecture/api-v1-runtime-openapi.json'), 'utf8')) as OpenApiDocument
      expect(Object.keys(runtimeBaseline.paths).filter(path => !current.paths[path])).toEqual([])
      expect(Object.keys(current.paths).filter(path => !runtimeBaseline.paths[path]).sort()).toEqual([
        '/api/ai/v1/chat', '/api/ai/v1/conversations', '/api/ai/v1/conversations/{id}', '/api/demo/v1/me/profile',
        // Task 10：AI 原生建号的动作草稿端点，以及同源的用户创建表单定义/候选端点。
        '/api/ai/v1/conversations/{id}/drafts', '/api/ai/v1/drafts/{draftId}', '/api/ai/v1/drafts/{draftId}/cancel',
        '/api/ai/v1/drafts/{draftId}/questions', '/api/ai/v1/drafts/{draftId}/questions/answer',
        '/api/ai/v1/settings', '/api/ai/v1/settings/test',
        '/api/v1/admin/users/create-form', '/api/v1/admin/users/create-options',
      ].sort())
      for (const [path, methods] of Object.entries(runtimeBaseline.paths)) {
        const expected = structuredClone(methods)
        // The old document inherited global bearer auth for these actually public operations.
        if (path === '/api/v1/app/auth/login' || path === '/api/v1/app/auth/refresh') expected.post.security = []
        if (path === '/api/v1/admin/system/module-management/list/') expected.get.description = '显式安装清单中的业务模块及当前启停、挂载状态。'
        if (path === '/api/v1/admin/system/module-management/toggle/{id}/toggle') delete expected.post.description
        expect(current.paths[path], `OpenAPI operation/schema/security changed: ${path}`).toEqual(expected)
      }
      // The role contract intentionally gained custom data-scope departments.
      for (const name of ['sysRole', 'saveRoleReq', 'updateRoleReq']) {
        const expected = runtimeBaseline.components?.schemas?.[name]
        if (!expected?.properties) throw new Error(`Missing role baseline schema: ${name}`)
        expected.properties.deptIds = {
          type: 'array', items: { type: 'integer', minimum: 1 },
          description: name === 'sysRole' ? '自定义数据范围的部门ID列表（dataScope="5" 时生效）' : '自定义数据范围的部门ID列表（dataScope=5 时生效）',
        }
      }
      // Task 10：建号草稿让 create 请求多带一个 draftSubmission 引用（真正的创建仍然
      // 只由原生表单的 onFinish 发起），并新增同源的表单定义/候选响应契约。
      const createUserBaseline = runtimeBaseline.components?.schemas?.createUserReq
      if (!createUserBaseline?.properties) throw new Error('Missing createUserReq baseline schema')
      const draftSubmission = current.components?.schemas?.createUserReq?.properties?.draftSubmission
      if (!draftSubmission) throw new Error('createUserReq lost draftSubmission')
      createUserBaseline.properties.draftSubmission = draftSubmission
      for (const name of ['userCreateOptionsQuery', 'userCreateFormResp', 'userCreateOptionsResp']) {
        const schema = current.components?.schemas?.[name]
        if (!schema) throw new Error(`Missing ${name} schema`)
        if (runtimeBaseline.components?.schemas) runtimeBaseline.components.schemas[name] = schema
      }
      // 历史密码兼容：sys_user 多了 password_format / password_change_recommended，
      // 登录与资料契约随之透出。这里从当前 schema 取属性而不是手抄 description，
      // 避免文案微调后出现无意义的测试失败；同时断言字段必须存在，防止静默丢失。
      for (const name of ['sysUser', 'loginData', 'currentUser']) {
        const expected = runtimeBaseline.components?.schemas?.[name]
        if (!expected?.properties) throw new Error(`Missing ${name} baseline schema`)
        const recommended = current.components?.schemas?.[name]?.properties?.passwordChangeRecommended
        if (!recommended) throw new Error(`${name} lost passwordChangeRecommended`)
        expected.properties.passwordChangeRecommended = recommended
      }
      const loginFormat = current.components?.schemas?.loginData?.properties?.passwordFormat
      if (!loginFormat) throw new Error('loginData lost passwordFormat')
      const loginDataBaseline = runtimeBaseline.components?.schemas?.loginData
      if (!loginDataBaseline?.properties) throw new Error('Missing loginData baseline schema')
      loginDataBaseline.properties.passwordFormat = loginFormat
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
