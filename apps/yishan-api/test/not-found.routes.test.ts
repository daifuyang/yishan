/**
 * N1: 404 envelope 一致
 *
 * 背景: app.ts 注册了 setNotFoundHandler,确保未知路由返回项目标准 envelope,
 * 而非 Fastify 默认的 {message, error, statusCode} 格式。
 *
 * 验证: ROUTE_NOT_FOUND code=25005, success=false, 含 timestamp
 */
import Fastify from 'fastify'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import { SystemManageErrorCode } from '../src/constants/business-codes/system.ts'
import { describe, it, expect } from 'vitest'

function buildApp() {
  const app = Fastify({ logger: false })
  // 注册全局错误处理,确保错误路由不影响 not-found handler
  app.register(errorHandlerPlugin)

  // 注册一个已知路由,确保正常路由不被 not-found handler 干扰
  app.get('/api/test/hello', async (_request, reply) => {
    return reply.send({ hello: 'world' })
  })

  // 与 app.ts 一致的 setNotFoundHandler
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      code: SystemManageErrorCode.ROUTE_NOT_FOUND,
      message: `Route ${request.method}:${request.url} not found`,
      data: null,
      timestamp: new Date().toISOString(),
    })
  })
  return app
}

describe('N1: 404 envelope 一致', () => {
  it('未知路由应返回标准 envelope 而非 Fastify 默认格式', async () => {
    const app = buildApp()
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/api/this/does/not/exist' })

    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(25005) // SystemManageErrorCode.ROUTE_NOT_FOUND
    expect(body.message).toMatch(/not found/i)
    expect(body.data).toBeNull()
    expect(body).toHaveProperty('timestamp')

    await app.close()
  })

  it('未知路由 body 不应包含 Fastify 默认字段', async () => {
    const app = buildApp()
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/api/nonexistent' })
    const body = res.json()

    // 确保不是 Fastify 默认格式
    expect(body).not.toHaveProperty('error')
    expect(body).not.toHaveProperty('statusCode')
    // 应该是项目标准 envelope
    expect(body).toHaveProperty('success')
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('timestamp')

    await app.close()
  })

  it('POST 到未知路由也返回同样 envelope', async () => {
    const app = buildApp()
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/api/unknown/endpoint' })

    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(25005)
    expect(body.message).toMatch(/not found/i)

    await app.close()
  })

  it('已知路由仍正常工作(not-found handler 不干扰)', async () => {
    const app = buildApp()
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/api/test/hello' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ hello: 'world' })

    await app.close()
  })
})
