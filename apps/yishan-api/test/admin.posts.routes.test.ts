import Fastify from 'fastify'
import adminPositionsPlugin from '../src/core/routes/api/v1/admin/positions/index.ts'
import registerPositionSchemas from '../src/core/schemas/position.ts'
import registerCommonSchemas from '../src/core/schemas/common.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import { PositionService } from '../src/core/services/position.service.ts'
import { ValidationErrorCode } from '../src/constants/business-codes/validation.ts'
import { PositionErrorCode } from '../src/constants/business-codes/position.ts'
import { BusinessError } from '../src/exceptions/business-error.ts'
import { describe, it, expect, vi, beforeEach } from 'vitest'

async function buildApp() {
  const app = Fastify({ logger: false });
    // 单测不需要真实 RBAC 校验：no-op 占位。
    app.decorate('requirePermission', () => async (_request: any, _reply: any) => undefined)
    app.decorate('requireRole', () => async (_request: any, _reply: any) => undefined)
    app.decorate('authenticate', async () => undefined)
  await app.register(errorHandlerPlugin)
  // 先注册通用Schema（包含paginationResponse），否则响应schema校验会失败
  registerCommonSchemas(app)
  registerPositionSchemas(app)
  await app.register(adminPositionsPlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Admin Positions routes', () => {
  it('GET / 应返回分页的岗位列表', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const list = [
      {
        id: 1,
        name: '开发工程师',
        code: 'DEV',
        status: 1,
        sort_order: 1,
        description: '负责开发工作',
        creatorId: 1,
        creatorName: 'system',
        createdAt: now,
        updaterId: 1,
        updaterName: 'system',
        updatedAt: now,
      }
    ] as any

    vi.spyOn(PositionService, 'getPositionList').mockResolvedValue({ list, total: 1, page: 2, pageSize: 5 })

    const res = await app.inject({ method: 'GET', url: '/?page=2&pageSize=5&keyword=dev&status=1&sortBy=createdAt&sortOrder=desc' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(1)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.pageSize).toBe(5)
    expect(body.pagination.total).toBe(1)

    await app.close()
  })

  it('POST / 成功创建岗位', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const created = {
      id: 100,
      name: '产品经理',
      code: 'PM',
      status: 1,
      sort_order: 0,
      description: '负责产品规划',
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now,
    } as any

    vi.spyOn(PositionService, 'createPosition').mockResolvedValue(created)

    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: '产品经理', code: 'PM', status: 1 }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 100, name: '产品经理' })

    await app.close()
  })

  it('POST / 当岗位已存在返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(PositionService, 'createPosition').mockRejectedValue(
      new BusinessError(PositionErrorCode.POSITION_ALREADY_EXISTS, '岗位已存在')
    )

    const res = await app.inject({ method: 'POST', url: '/', payload: { name: '开发工程师', code: 'DEV' } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(PositionErrorCode.POSITION_ALREADY_EXISTS)

    await app.close()
  })

  it('PUT /:id 成功更新岗位返回 200', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const updated = {
      id: 5,
      name: '资深开发工程师',
      code: 'SENIOR_DEV',
      status: 1,
      sort_order: 2,
      description: '负责关键模块开发',
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now,
    } as any

    vi.spyOn(PositionService, 'updatePosition').mockResolvedValue(updated)

    const res = await app.inject({ method: 'PUT', url: '/5', payload: { name: '资深开发工程师' } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 5, name: '资深开发工程师' })

    await app.close()
  })

  it('PUT /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'PUT', url: '/abc', payload: { name: 'any' } })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('PUT /:id 岗位不存在返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(PositionService, 'updatePosition').mockRejectedValue(
      new BusinessError(PositionErrorCode.POSITION_NOT_FOUND, '岗位不存在')
    )

    const res = await app.inject({ method: 'PUT', url: '/99', payload: { name: 'x' } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(PositionErrorCode.POSITION_NOT_FOUND)

    await app.close()
  })

  it('DELETE /:id 删除岗位返回成功', async () => {
    const app = await buildApp()

    vi.spyOn(PositionService, 'deletePosition').mockResolvedValue({ id: 7 })

    const res = await app.inject({ method: 'DELETE', url: '/7' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 7 })

    await app.close()
  })

  it('GET /:id 成功获取岗位详情', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const positionDetail = {
      id: 11,
      name: '测试工程师',
      code: 'QA',
      status: 1,
      sort_order: 3,
      description: '负责测试工作',
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 2,
      updaterName: 'ops',
      updatedAt: now,
    } as any

    vi.spyOn(PositionService, 'getPositionById').mockResolvedValue(positionDetail)

    const res = await app.inject({ method: 'GET', url: '/11' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 11, name: '测试工程师' })

    await app.close()
  })

  it('GET /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'GET', url: '/abc' })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('GET /:id 岗位不存在返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(PositionService, 'getPositionById').mockRejectedValue(
      new BusinessError(PositionErrorCode.POSITION_NOT_FOUND, '岗位不存在')
    )

    const res = await app.inject({ method: 'GET', url: '/999' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(PositionErrorCode.POSITION_NOT_FOUND)

    await app.close()
  })

  it('POST / 参数不合法应返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'POST', url: '/', payload: { code: 'NO_NAME' } })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('DELETE /:id 岗位删除被禁止返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(PositionService, 'deletePosition').mockRejectedValue(
      new BusinessError(PositionErrorCode.POSITION_DELETE_FORBIDDEN, '岗位删除被禁止')
    )

    const res = await app.inject({ method: 'DELETE', url: '/10' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(PositionErrorCode.POSITION_DELETE_FORBIDDEN)

    await app.close()
  })
})
