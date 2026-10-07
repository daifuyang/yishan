import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import quotationsRoutes from '../routes/v1/quotations/index.js'
import { QuotationService } from '../services/quotation.service.js'

afterEach(() => vi.restoreAllMocks())

describe('内部报价预览路由', () => {
  it('requires login and quotation permission, serializes only the public document', async () => {
    const user = { id: 7, roleCodes: ['super_admin'], deptIds: [] }
    const preview = vi.spyOn(QuotationService.prototype, 'previewQuote').mockResolvedValue({
      companyName: '客户', quoteTitle: '报价', quoteNumber: 'Q-1', quoteDate: null, validUntil: null,
      customerName: '客户', contactDisplayName: null, items: [], subtotalCents: 7000000,
      discountAmountCents: 400000, publicDiscountDescription: '首期合作优惠', totalAmountCents: 6600000,
      remark: null, salesContactName: '销售', salesContactPhone: null, version: 1,
    })
    const app = Fastify()
    app.decorate('authenticate', async (request, reply) => {
      if (request.headers.authorization !== 'internal') return reply.code(401).send()
      Object.assign(request, { currentUser: user })
    })
    app.decorate('requirePermission', (permission: { code: string }) => async (request: { headers: Record<string, unknown> }, reply: { code: (code: number) => { send: () => void } }) => {
      if (request.headers['x-permission'] !== permission.code) return reply.code(403).send()
    })
    await app.register(quotationsRoutes, { prefix: '/quotations' })
    try {
      expect((await app.inject('/quotations/1/preview?preview=1')).statusCode).toBe(401)
      expect((await app.inject({ url: '/quotations/1/preview', headers: { authorization: 'internal' } })).statusCode).toBe(403)
      expect(preview).not.toHaveBeenCalled()
      const response = await app.inject({ url: '/quotations/1/preview', headers: { authorization: 'internal', 'x-permission': 'crm:quotation:list' } })
      expect(response.statusCode).toBe(200)
      expect(response.headers['cache-control']).toBe('private, no-store')
      expect(response.json().data.publicDiscountDescription).toBe('首期合作优惠')
      expect(response.json().data).not.toHaveProperty('internalDiscountReason')
      expect(preview).toHaveBeenCalledWith(1, user)
    } finally { await app.close() }
  })
})
