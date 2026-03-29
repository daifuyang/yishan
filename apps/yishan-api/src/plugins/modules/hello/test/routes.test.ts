import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import helloPublicRoutes from '../routes/api/v1/index.js'
import helloAdminRoutes from '../routes/api/v1/admin/index.js'
import helloAdminMeRoutes from '../routes/api/v1/admin/me/index.js'

async function buildApp () {
  const app = Fastify({ logger: false })

  app.decorate('authenticate', async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({
        success: false,
        code: 401,
        message: 'Unauthorized',
        data: null
      })
    }
    request.currentUser = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      realName: 'Admin',
      gender: 1,
      genderName: '男',
      status: '1',
      statusName: '启用',
      loginCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginTime: new Date().toISOString()
    }
  })

  await app.register(helloPublicRoutes, { prefix: '/hello/v1' })
  await app.register(async (adminScope) => {
    adminScope.addHook('preHandler', async (request, reply) => {
      return adminScope.authenticate(request, reply)
    })
    await adminScope.register(helloAdminRoutes)
    await adminScope.register(helloAdminMeRoutes, { prefix: '/me' })
  }, { prefix: '/hello/v1/admin' })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Hello module routes', () => {
  it('GET /hello/v1/ping 返回公开成功响应', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/hello/v1/ping'
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.module).toBe('hello')

    await app.close()
  })

  it('POST /hello/v1/echo 携带鉴权时返回成功', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/hello/v1/echo',
      headers: { Authorization: 'Bearer test-token' },
      payload: { message: 'hello auth' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.by).toBe('admin')
    expect(body.data.echo).toBe('hello auth')

    await app.close()
  })

  it('POST /hello/v1/echo 缺少鉴权时返回 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/hello/v1/echo',
      payload: { message: 'hello world' }
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.success).toBe(false)

    await app.close()
  })

  it('POST /hello/v1/echo 请求体校验失败时返回 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/hello/v1/echo',
      headers: { Authorization: 'Bearer test-token' },
      payload: { message: '' }
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.statusCode).toBe(400)

    await app.close()
  })

  it('GET /hello/v1/admin/ 携带鉴权时返回成功', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/hello/v1/admin/',
      headers: { Authorization: 'Bearer test-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.module).toBe('hello')

    await app.close()
  })

  it('GET /hello/v1/admin/me 缺少鉴权时返回 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/hello/v1/admin/me'
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.success).toBe(false)

    await app.close()
  })

  it('GET /hello/v1/admin/me 携带鉴权时返回当前用户', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/hello/v1/admin/me',
      headers: { Authorization: 'Bearer test-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.userId).toBe(1)
    expect(body.data.username).toBe('admin')
    expect(body.data.permission).toBe('authenticated')

    await app.close()
  })
})
