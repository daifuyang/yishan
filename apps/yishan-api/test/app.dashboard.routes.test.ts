import Fastify from 'fastify'
import dashboardPlugin from '../src/core/routes/api/v1/app/dashboard/index.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import { DashboardService } from '../src/core/services/dashboard.service.ts'
import { describe, it, expect, vi, beforeEach } from 'vitest'

async function buildApp(currentUser?: any, mockRedis?: any) {
  const app = Fastify({ logger: false })

  app.decorate('authenticate', async (request: any) => {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      const error = new Error('Unauthorized')
      ;(error as any).statusCode = 401
      throw error
    }
    request.currentUser = currentUser || {
      id: 1,
      username: 'admin',
      roleIds: [1],
    }
  })
  // Section 1: 让单测不依赖真实 db 的 requirePermission。
  // 简单做法：roleIds=[1] 视为 super_admin 旁路；其它视为无权限。
  app.decorate('requirePermission', (_permCode: string) => async (request: any, _reply: any) => {
    const roleIds: number[] = request.currentUser?.roleIds ?? []
    if (roleIds.includes(1)) return
    const error: any = new Error('Forbidden')
    error.statusCode = 403
    error.code = 22002
    throw error
  })

  if (mockRedis) {
    app.decorate('redis', mockRedis)
  }

  await app.register(errorHandlerPlugin)
  await app.register(dashboardPlugin, { prefix: '/api/v1/app/dashboard' })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Dashboard routes', () => {
  it('GET /api/v1/app/dashboard/stats with admin token returns 200', async () => {
    const mockStats = {
      userTotal: 100,
      deptTotal: 20,
      todayLogin: 50,
      online: 5,
    }
    vi.spyOn(DashboardService, 'getStats').mockResolvedValue(mockStats)

    const app = await buildApp(
      { id: 1, username: 'admin', roleIds: [1] },
      { get: vi.fn(), setex: vi.fn() }
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/app/dashboard/stats',
      headers: { Authorization: 'Bearer admin-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockStats)

    await app.close()
  })

  it('GET /api/v1/app/dashboard/stats without token returns 401', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/app/dashboard/stats',
    })

    expect(res.statusCode).toBe(401)

    await app.close()
  })

  it('GET /api/v1/app/dashboard/stats with non-admin token returns 403', async () => {
    vi.spyOn(DashboardService, 'getStats').mockResolvedValue({
      userTotal: 100,
      deptTotal: 20,
      todayLogin: 50,
      online: 5,
    })

    const app = await buildApp(
      { id: 2, username: 'user', roleIds: [] },
      { get: vi.fn(), setex: vi.fn() }
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/app/dashboard/stats',
      headers: { Authorization: 'Bearer user-token' },
    })

    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(22002) // AuthErrorCode.FORBIDDEN

    await app.close()
  })
})
