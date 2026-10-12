import Fastify from 'fastify'
import adminPermissionsPlugin from '../src/core/routes/api/v1/admin/permissions/index.ts'
import registerPermissionSchemas from '../src/core/schemas/permission.ts'
import registerCommonSchemas from '../src/core/schemas/common.ts'
import { errorHandlerPlugin } from '@yishan/core-api/plugins'
import { describe, it, expect } from './runtime-fixture'

describe('Admin Permissions routes', () => {
  it('GET /catalog 应返回符合响应 schema 的权限目录', async () => {
    const app = Fastify({ logger: false })
    app.decorate('requirePermission', () => async () => undefined)
    app.decorate('requireRole', () => async () => undefined)
    app.decorate('authenticate', async () => undefined)
    await app.register(errorHandlerPlugin)
    registerCommonSchemas(app)
    registerPermissionSchemas(app)
    await app.register(adminPermissionsPlugin)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/catalog' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toContainEqual(expect.objectContaining({ code: 'system:permission:catalog' }))
    await app.close()
  })
})
