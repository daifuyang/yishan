import Fastify from 'fastify'
import usersPlugin from '../src/core/routes/api/v1/app/users/index.ts'
import registerLoginLogSchemas from '../src/core/schemas/login-log.ts'
import registerUserSchemas from '../src/core/schemas/user.ts'
import registerCommonSchemas from '../src/core/schemas/common.ts'
import { errorHandlerPlugin } from '@yishan/core-api/plugins'
import { LoginLogService } from '../src/core/services/login-log.service.ts'
import { BusinessError } from '@yishan/core-api/errors'
import { SystemManageErrorCode } from '@yishan/core-api/business-codes/system'
import { describe, it, expect, vi, beforeEach } from './runtime-fixture'

const DETAIL_URL = '/api/v1/app/users/me/login-logs/42'

const detailRow = {
  id: 42,
  userId: 7,
  username: 'demo',
  realName: '演示用户',
  status: '1',
  message: '登录成功',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
  createdAt: '2026-10-13T08:00:00.000Z',
  updatedAt: '2026-10-13T08:30:00.000Z',
}

async function buildApp(userId = 7) {
  const app = Fastify({ logger: false })
  const routes: any[] = []
  app.addHook('onRoute', routeOptions => { routes.push(routeOptions) })
  app.decorate('authenticate', async (request: any) => {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      const error = new Error('Unauthorized') as any
      error.statusCode = 401
      throw error
    }
    request.currentUser = { id: userId, username: 'demo', roleIds: [] }
  })
  // 单测不需要真实 RBAC：no-op 占位。
  app.decorate('requirePermission', () => async (_request: any, _reply: any) => undefined)

  await app.register(errorHandlerPlugin)
  registerCommonSchemas(app)
  registerUserSchemas(app)
  registerLoginLogSchemas(app)
  await app.register(usersPlugin, { prefix: '/api/v1/app/users' })
  await app.ready()
  return { app, routes }
}

function findRoute(routes: any[], method: string, url: string) {
  return routes.find(r => r.method === method && r.url === url)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/v1/app/users/me/login-logs/:id route contract', () => {
  it('registers the detail route with the list permission and the shared detail response ref', async () => {
    const { app, routes } = await buildApp()

    const detail = findRoute(routes, 'GET', '/api/v1/app/users/me/login-logs/:id')
    const list = findRoute(routes, 'GET', '/api/v1/app/users/me/login-logs')

    expect(detail).toBeDefined()
    expect(list).toBeDefined()
    expect(detail.schema.operationId).toBe('appGetMyLoginLog')
    expect(detail.schema['x-permission-code']).toBe('app:user:my-logins')
    // 详情路由复用列表路由的既有权限，不新增权限码。
    expect(detail.schema['x-permission-code']).toBe(list.schema['x-permission-code'])

    // params.id 为正整数。
    const id = detail.schema.params.properties.id
    expect(id.type).toBe('integer')
    expect(id.minimum).toBe(1)

    // 响应引用沿用既有的详情 schema，不自造。
    expect(detail.schema.response['200'].$ref).toBe('sysLoginLogDetailResp#')

    await app.close()
  })

  it('returns the service payload wrapped in the success envelope', async () => {
    const getMyLoginLogById = vi
      .spyOn(LoginLogService, 'getMyLoginLogById')
      .mockResolvedValue(detailRow as any)

    const { app } = await buildApp(7)
    const res = await app.inject({
      method: 'GET',
      url: DETAIL_URL,
      headers: { Authorization: 'Bearer demo-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(detailRow)

    // 服务契约是 (userId, id)：先取 currentUser.id，再传数字型路由 id。
    expect(getMyLoginLogById).toHaveBeenCalledTimes(1)
    const [argUserId, argId] = getMyLoginLogById.mock.calls[0]
    expect(argUserId).toBe(7)
    expect(argId).toBe(42)
    expect(typeof argId).toBe('number')

    await app.close()
  })

  it('passes another user id through as currentUser.id (no route-level reshaping)', async () => {
    const getMyLoginLogById = vi
      .spyOn(LoginLogService, 'getMyLoginLogById')
      .mockResolvedValue(detailRow as any)

    const { app } = await buildApp(99)
    await app.inject({
      method: 'GET',
      url: DETAIL_URL,
      headers: { Authorization: 'Bearer demo-token' },
    })

    expect(getMyLoginLogById).toHaveBeenCalledWith(99, 42)

    await app.close()
  })

  it('surfaces LOGIN_LOG_NOT_FOUND unchanged', async () => {
    vi.spyOn(LoginLogService, 'getMyLoginLogById').mockRejectedValue(
      new BusinessError(SystemManageErrorCode.LOGIN_LOG_NOT_FOUND, '登录日志不存在'),
    )

    const { app } = await buildApp(7)
    const res = await app.inject({
      method: 'GET',
      url: DETAIL_URL,
      headers: { Authorization: 'Bearer demo-token' },
    })

    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(SystemManageErrorCode.LOGIN_LOG_NOT_FOUND)

    await app.close()
  })

  it('requires authentication', async () => {
    const { app } = await buildApp(7)
    const res = await app.inject({ method: 'GET', url: DETAIL_URL })

    expect(res.statusCode).toBe(401)

    await app.close()
  })

  it('rejects a non-positive-integer id via the params schema', async () => {
    const getMyLoginLogById = vi.spyOn(LoginLogService, 'getMyLoginLogById')
    const { app } = await buildApp(7)

    for (const url of [
      '/api/v1/app/users/me/login-logs/abc',
      '/api/v1/app/users/me/login-logs/0',
      '/api/v1/app/users/me/login-logs/1.5',
    ]) {
      const res = await app.inject({
        method: 'GET',
        url,
        headers: { Authorization: 'Bearer demo-token' },
      })
      expect(res.statusCode, url).toBe(400)
    }
    expect(getMyLoginLogById).not.toHaveBeenCalled()

    await app.close()
  })
})
