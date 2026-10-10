import Fastify from 'fastify'
import { afterEach, expect, it, vi } from '../../../../test/runtime-fixture'
import quotationsRoutes from '../routes/v1/quotations/index.js'
import { QuotationService } from '../services/quotation.service.js'

afterEach(() => vi.restoreAllMocks())
it('revision requires login, create and update permissions before executing the transaction', async () => {
  const revise = vi.spyOn(QuotationService.prototype, 'reviseQuotation').mockRejectedValue(new Error('transaction reached'))
  const app = Fastify()
  app.decorate('authenticate', async (request, reply) => {
    if (request.headers.authorization !== 'internal') return reply.code(401).send()
    Object.assign(request, { currentUser: { id: 1, roleCodes: ['sales'], deptIds: [] } })
  })
  app.decorate('requirePermission', (permission: { code: string }) => async (request: { headers: Record<string, unknown> }, reply: { code: (code: number) => { send: () => void } }) => {
    const permissions = String(request.headers['x-permissions'] ?? '').split(',')
    if (!permissions.includes(permission.code)) return reply.code(403).send()
  })
  await app.register(quotationsRoutes, { prefix: '/quotations' })
  try {
    expect((await app.inject({ method: 'POST', url: '/quotations/1/revise' })).statusCode).toBe(401)
    for (const permission of ['crm:quotation:create', 'crm:quotation:update']) {
      expect((await app.inject({ method: 'POST', url: '/quotations/1/revise', headers: { authorization: 'internal', 'x-permissions': permission } })).statusCode).toBe(403)
    }
    expect(revise).not.toHaveBeenCalled()
    await app.inject({ method: 'POST', url: '/quotations/1/revise', headers: { authorization: 'internal', 'x-permissions': 'crm:quotation:create,crm:quotation:update' } })
    expect(revise).toHaveBeenCalledTimes(1)
    expect(revise).toHaveBeenCalledWith(1, expect.objectContaining({ id: 1 }))
  } finally { await app.close() }
})
