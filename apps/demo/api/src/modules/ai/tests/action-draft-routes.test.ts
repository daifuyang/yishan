import Fastify from 'fastify'
import { errorHandlerPlugin } from '@yishan/core-api/plugins'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import aiRoutes from '../routes/v1/index.js'
import draftRoutes from '../routes/v1/drafts.js'
import { ActionDraftSchema, ActionDraftFormDataSchema } from '../schemas/action-draft.schema.js'
import { aiError } from '../ai-chat-error.js'
import { ActionDraftService, type ActionDraft } from '../services/action-draft.service.js'
import { FormatRegistry } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

/** 路由会把 Date 序列化成 ISO 字符串；替身必须提供同样的形状。 */
const draftFor = (overrides: Partial<ActionDraft> = {}): ActionDraft => ({
  ...serializedDraft,
  createdAt: new Date(serializedDraft.createdAt),
  updatedAt: new Date(serializedDraft.updatedAt),
  expiresAt: new Date(serializedDraft.expiresAt),
  ...overrides,
})

async function appFor(status: 200 | 401 | 403 = 200) {
  const app = Fastify()
  await app.register(errorHandlerPlugin, { production: true })
  app.decorate('authenticate', async request => {
    if (status === 401) throw Object.assign(new Error('请登录'), { statusCode: 401 })
    Object.assign(request, { currentUser: { id: 17 } })
  })
  app.decorate('requirePermission', permission => {
    expect(permission.code).toBe('ai:chat:use')
    return async () => { if (status === 403) throw Object.assign(new Error('无权使用'), { statusCode: 403 }) }
  })
  await app.register(aiRoutes)
  await app.register(draftRoutes)
  return app
}

const draftBody = { module: 'system', action: 'user.create', formData: { phone: '13800000000' } }
/** 传输层断言用的完整草稿；值保持「半截手机号」以证明传输层不校验业务格式。 */
const serializedDraft = {
  draftId: 'd1', ownerId: 17, conversationId: 'c1', module: 'system', action: 'user.create',
  schemaVersion: 1, formData: { phone: '13' }, missingFields: [], validationErrors: [],
  draftVersion: 1, status: 'collecting', resultRef: null, failureReason: null,
  createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z', expiresAt: '2026-10-18T00:00:00.000Z',
}

beforeAll(() => {
  // 传输 schema 声明了 date-time 格式；校验器需要显式登记才不做「未知格式」判定。
  FormatRegistry.Set('date-time', () => true)
})

describe('Action draft HTTP transport', () => {
  it('accepts a half-typed field the business rules will later flag', async () => {
    expect(Value.Check(ActionDraftFormDataSchema, { phone: '13', gender: '9', email: 'nope', deptIds: [1], roleIds: [] })).toBe(true)
  })

  it.each([
    [{ password: 'abc12345' }, 'password'],
    [{ nickname: 'x', isAdmin: true }, 'unknown field'],
    [{ phone: 138 }, 'wrong primitive'],
    [{ roleIds: ['1'] }, 'wrong array item'],
  ])('rejects %j at the transport boundary (%s)', formData => {
    expect(Value.Check(ActionDraftFormDataSchema, formData)).toBe(false)
  })

  it('keeps the draft response schema aligned with the service view', async () => {
    expect(Value.Check(ActionDraftSchema, {
      draftId: 'd1', ownerId: 17, conversationId: 'c1', module: 'system', action: 'user.create',
      schemaVersion: 1, formData: { phone: '13' }, missingFields: [], validationErrors: [],
      draftVersion: 1, status: 'collecting', resultRef: null, failureReason: null,
      createdAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z', expiresAt: '2026-10-18T00:00:00.000Z',
    })).toBe(true)
    expect(Value.Check(ActionDraftSchema, { draftId: 'd1', status: 'unknown' })).toBe(false)
  })
})

describe('Action draft routes', () => {
  it.each([401, 403] as const)('rejects every draft endpoint with %s before service access', async status => {
    const app = await appFor(status)
    const create = vi.spyOn(ActionDraftService.prototype, 'create')
    try {
      for (const options of [
        { method: 'POST', url: '/conversations/c1/drafts', payload: draftBody },
        { method: 'GET', url: '/conversations/c1/drafts' },
        { method: 'GET', url: '/drafts/d1' },
        { method: 'PATCH', url: '/drafts/d1', payload: { draftVersion: 1, formData: { phone: '13' } } },
        { method: 'POST', url: '/drafts/d1/cancel', payload: { draftVersion: 1 } },
      ] as const) {
        const response = await app.inject(options)
        expect(response.statusCode, response.body).toBe(status)
      }
      expect(create).not.toHaveBeenCalled()
    } finally { await app.close() }
  })

  it('routes a create with a temporarily invalid phone to the service instead of rejecting it in transport', async () => {
    const app = await appFor()
    const create = vi.spyOn(ActionDraftService.prototype, 'create').mockResolvedValue(draftFor())
    try {
      const response = await app.inject({ method: 'POST', url: '/conversations/c1/drafts', payload: { ...draftBody, formData: { phone: '13' } } })
      expect(response.statusCode, response.body).toBe(200)
      expect(create).toHaveBeenCalledWith(17, 'c1', { module: 'system', action: 'user.create', formData: { phone: '13' } })
    } finally { await app.close() }
  })

  it.each([
    { method: 'POST', url: '/conversations/c1/drafts', payload: { ...draftBody, formData: { password: 'abc12345' } } },
    { method: 'PATCH', url: '/drafts/d1', payload: { draftVersion: 1, formData: { password: 'abc12345' } } },
    { method: 'PATCH', url: '/drafts/d1', payload: { formData: {} } },
    { method: 'POST', url: '/drafts/d1/cancel', payload: {} },
  ] as const)('rejects $method $url with a sensitive or malformed body', async options => {
    const app = await appFor()
    const patch = vi.spyOn(ActionDraftService.prototype, 'patch')
    try {
      const response = await app.inject(options)
      expect(response.statusCode, response.body).toBe(400)
      expect(patch).not.toHaveBeenCalled()
    } finally { await app.close() }
  })

  it('passes the draftVersion and null-clearing patch straight through', async () => {
    const app = await appFor()
    const patch = vi.spyOn(ActionDraftService.prototype, 'patch').mockResolvedValue(draftFor())
    try {
      const response = await app.inject({ method: 'PATCH', url: '/drafts/d1', payload: { draftVersion: 3, formData: { nickname: null, realName: '张三' } } })
      expect(response.statusCode, response.body).toBe(200)
      expect(patch).toHaveBeenCalledWith(17, 'd1', 3, { nickname: null, realName: '张三' })
    } finally { await app.close() }
  })

  it('returns the standard envelope for list and detail', async () => {
    const app = await appFor()
    vi.spyOn(ActionDraftService.prototype, 'list').mockResolvedValue([])
    vi.spyOn(ActionDraftService.prototype, 'get').mockResolvedValue(draftFor())
    try {
      const list = await app.inject({ method: 'GET', url: '/conversations/c1/drafts' })
      expect(list.json()).toMatchObject({ success: true, code: 10000, data: { items: [] } })
      const detail = await app.inject({ method: 'GET', url: '/drafts/d1' })
      expect(detail.json()).toMatchObject({ success: true, data: { draftId: 'd1' } })
    } finally { await app.close() }
  })

  it('preserves the not-found status for another owner’s draft', async () => {
    const app = await appFor()
    // Service 抛的是模块自己的错误类型；路由必须原样保留它的状态码。
    vi.spyOn(ActionDraftService.prototype, 'get').mockRejectedValue(aiError(404, '草稿不存在'))
    try {
      const response = await app.inject({ method: 'GET', url: '/drafts/d1' })
      expect(response.statusCode, response.body).toBe(404)
      expect(response.json()).toMatchObject({ success: false, message: '草稿不存在' })
    } finally { await app.close() }
  })
})
