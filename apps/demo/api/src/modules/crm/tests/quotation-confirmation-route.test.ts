import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from '../../../../test/runtime-fixture'
import quotationsRoutes from '../routes/v1/quotations/index.js'
import { QuotationService } from '../services/quotation.service.js'
import { ContractService } from '../services/contract.service.js'

afterEach(() => vi.restoreAllMocks())
describe('quotation confirmation HTTP boundaries', () => {
  it('requires authentication and confirmation permission, and validates the revocation reason', async () => {
    const confirm = vi.spyOn(QuotationService.prototype, 'acceptQuotation').mockRejectedValue(new Error('business boundary'))
    const revoke = vi.spyOn(QuotationService.prototype, 'revokeConfirmation').mockRejectedValue(new Error('business boundary'))
    const contract = vi.spyOn(ContractService.prototype, 'createFromQuotation').mockRejectedValue(new Error('business boundary'))
    const app = Fastify()
    app.decorate('authenticate', async (request, reply) => {
      if (request.headers.authorization !== 'internal') return reply.code(401).send()
      Object.assign(request, { currentUser: { id: 7, roleCodes: ['sales'], deptIds: [] } })
    })
    app.decorate('requirePermission', (permission: { code: string }) => async (request: { headers: Record<string, unknown> }, reply: { code: (code: number) => { send: () => void } }) => {
      if (request.headers['x-permission'] !== permission.code) return reply.code(403).send()
    })
    await app.register(quotationsRoutes, { prefix: '/quotations' })
    const headers = { authorization: 'internal', 'x-permission': 'crm:quotation:accept' }
    try {
      expect((await app.inject({ method: 'POST', url: '/quotations/2/accept' })).statusCode).toBe(401)
      expect((await app.inject({ method: 'POST', url: '/quotations/2/accept', headers: { authorization: 'internal' } })).statusCode).toBe(403)
      expect(confirm).not.toHaveBeenCalled()
      await app.inject({ method: 'POST', url: '/quotations/2/accept', headers })
      expect(confirm).toHaveBeenCalledWith(2, expect.objectContaining({ id: 7 }))
      for (const payload of [{}, { reason: 'renegotiation' }, { reason: 'other', remark: 'x'.repeat(501) }]) {
        expect((await app.inject({ method: 'POST', url: '/quotations/2/revoke-confirmation', headers, payload })).statusCode).toBe(400)
      }
      expect(revoke).not.toHaveBeenCalled()
      expect((await app.inject({ method: 'POST', url: '/quotations/2/revoke-confirmation', headers: { authorization: 'internal' }, payload: { reason: 'mistake' } })).statusCode).toBe(403)
      await app.inject({ method: 'POST', url: '/quotations/2/revoke-confirmation', headers, payload: { reason: 'mistake' } })
      expect(revoke).toHaveBeenCalledWith(2, { reason: 'mistake' }, expect.objectContaining({ id: 7 }))
      expect((await app.inject({ method: 'POST', url: '/quotations/2/contract', headers: { authorization: 'internal', 'x-permission': 'crm:contract:create' } })).statusCode).toBe(400)
      expect(contract).not.toHaveBeenCalled()
    } finally { await app.close() }
  })
})
