import Fastify from 'fastify'
import systemPlugin from '../src/core/routes/api/v1/system/index.ts'
import registerSystemSchemas from '../src/core/schemas/system.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import { SystemService } from '../src/core/services/system.service.ts'
import { BusinessError } from '../src/exceptions/business-error.js'
import { SystemManageErrorCode } from '../src/constants/business-codes/system.ts'
import { describe, it, expect, vi, beforeEach } from 'vitest'

async function buildApp() {
  const app = Fastify({ logger: false })
  // 注册全局错误处理，确保 BusinessError 正确被转换为响应
  await app.register(errorHandlerPlugin)
  // 仅注册系统相关的 Schema，满足路由中的 $ref 校验
  registerSystemSchemas(app)
  // 单测无需真实 RBAC/JWT：no-op 装饰器占位。
  app.decorate('authenticate', async (_request: any, _reply: any) => undefined)
  app.decorate('requirePermission', () => async (_request: any, _reply: any) => undefined)
  app.decorate('requireRole', () => async (_request: any, _reply: any) => undefined)
  app.decorate('rateLimit', () => async (_request: any, _reply: any) => undefined)
  // 注册被测路由插件
  await app.register(systemPlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
  // CRON_TOKEN 必须 >= 16 字符（参见 jwt-secret-validator 同款启发式）
  process.env.CRON_TOKEN = 'unit-cron-token-1234567890'
})

describe('System routes', () => {
  it('POST /cleanup-tokens 应在令牌有效时成功清理', async () => {
    const app = await buildApp()
    const mockResult = { deletedCount: 2, revokedCount: 1, message: 'ok' }
    vi.spyOn(SystemService, 'cleanupExpiredTokens').mockResolvedValue(mockResult)

    const res = await app.inject({
      method: 'POST',
      url: '/cleanup-tokens',
      payload: { cron_token: 'unit-cron-token-1234567890', days_to_keep: 30 }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockResult)

    await app.close()
  })

  it('POST /cleanup-tokens 应在令牌无效时返回 401 和业务码', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: '/cleanup-tokens',
      payload: { cron_token: 'bad-token', days_to_keep: 30 }
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(SystemManageErrorCode.INVALID_CRON_TOKEN)

    await app.close()
  })

  it('GET /token-stats 应返回统计信息', async () => {
    const app = await buildApp()
    const stats = { totalTokens: 10, activeTokens: 8, expiredTokens: 2, revokedTokens: 1 }
    vi.spyOn(SystemService, 'getTokenStats').mockResolvedValue(stats)

    const res = await app.inject({ method: 'GET', url: '/token-stats' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(stats)

    await app.close()
  })

  it('GET /token-stats 如果服务抛出 BusinessError 应返回 500 和业务码', async () => {
    const app = await buildApp()
    vi.spyOn(SystemService, 'getTokenStats').mockRejectedValue(
      new BusinessError(SystemManageErrorCode.CRON_JOB_FAILED, 'failed')
    )

    const res = await app.inject({ method: 'GET', url: '/token-stats' })
    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(SystemManageErrorCode.CRON_JOB_FAILED)

    await app.close()
  })
})
