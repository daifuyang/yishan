/**
 * N2: dict not-found 用新码(32501 而非 21001)
 * N3: 分页边界 — page=1e10 / pageSize=999 应被拦截
 */
import Fastify from 'fastify'
import adminDictsPlugin from '../src/core/routes/api/v1/admin/dicts/index.ts'
import registerDictSchemas from '../src/core/schemas/dict.ts'
import registerCommonSchemas from '../src/core/schemas/common.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import { DictService } from '../src/core/services/dict.service.ts'
import { DictErrorCode } from '../src/constants/business-codes/dict.ts'
import { ValidationErrorCode } from '../src/constants/business-codes/validation.ts'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const PREFIX = '/api/v1/admin/dicts'

async function buildApp() {
  const app = Fastify({ logger: false })
  // 注册全局错误处理
  await app.register(errorHandlerPlugin)
  // no-op 装饰器
  app.decorate('authenticate', async (_request: any, _reply: any) => {
    _request.currentUser = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      realName: 'Admin',
      gender: 1,
      genderName: '男',
      status: 1,
      statusName: '启用',
      loginCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginTime: new Date().toISOString(),
    }
  })
  app.decorate('requirePermission', () => async (_request: any, _reply: any) => undefined)
  app.decorate('requireRole', () => async (_request: any, _reply: any) => undefined)
  app.decorate('rateLimit', () => async (_request: any, _reply: any) => undefined)
  // 注册 schema
  registerCommonSchemas(app)
  registerDictSchemas(app)
  // 注册路由
  await app.register(adminDictsPlugin, { prefix: PREFIX })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('N2: 字典 not-found 业务错误码', () => {
  it('GET /types/:id 不存在的字典类型应返回 32501(DICT_TYPE_NOT_FOUND) 非 21001', async () => {
    const app = await buildApp()
    // Mock service 返回 null → 路由抛出 BusinessError(DICT_TYPE_NOT_FOUND)
    vi.spyOn(DictService, 'getDictTypeById').mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/types/99999`,
      headers: { Authorization: 'Bearer test-token' },
    })

    // DictErrorCode 32xxx → HTTP 200
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    // 关键断言:用专有码,非校验码
    expect(body.code).toBe(32501) // DictErrorCode.DICT_TYPE_NOT_FOUND
    expect(body.code).not.toBe(21001) // 不再用校验码
    expect(body.message).toMatch(/字典类型不存在/)

    await app.close()
  })

  it('GET /data/:id 不存在的字典数据应返回 32511(DICT_DATA_NOT_FOUND)', async () => {
    const app = await buildApp()
    vi.spyOn(DictService, 'getDictDataById').mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/data/99999`,
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(32511) // DictErrorCode.DICT_DATA_NOT_FOUND
    expect(body.code).not.toBe(21001)

    await app.close()
  })
})

describe('N3: 分页边界校验', () => {
  it('?page=1e10 应被 schema 拦截(超过 maximum)', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/types?page=1e10&pageSize=2`,
      headers: { Authorization: 'Bearer test-token' },
    })

    // schema 校验失败 → HTTP 400
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(21001) // ValidationErrorCode.INVALID_PARAMETER
    expect(body.message).toMatch(/100000/)

    await app.close()
  })

  it('?pageSize=999 应被 schema 拦截(超过 maximum)', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/types?page=1&pageSize=999`,
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(21001)
    expect(body.message).toMatch(/100/)

    await app.close()
  })

  it('?page=1&pageSize=10 正常值应通过校验', async () => {
    const app = await buildApp()
    // 不 mock,用默认 mock DB(返回空列表)
    // DictService.getDictTypeList 会调用 DictRepository(DB mock 返回 [])

    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/types?page=1&pageSize=10`,
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.code).toBe(10000)
    expect(Array.isArray(body.data)).toBe(true)

    await app.close()
  })

  it('?page=0 应被 schema 拦截(低于 minimum)', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/types?page=0&pageSize=10`,
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(21001)

    await app.close()
  })
})
