import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import leadRoutes from '../routes/v1/leads/index.js'
import { LeadActivityService } from '../services/lead-activity.service.js'
import type { LeadRow } from '../repositories/lead.repository.js'

const activity = {
  id: 1, leadId: 12, type: 'phone', content: '已联系',
  occurredAt: new Date('2026-09-07T00:00:00.000Z'), nextFollowUpAt: null,
  operatorUserId: 7, operatorUserName: null,
  createdAt: new Date('2026-09-07T00:00:00.000Z'), updatedAt: new Date('2026-09-07T00:00:00.000Z'),
}
const lead: LeadRow = {
  id: 12, name: '李伟', companyName: null, mobile: null, phone: null, email: null, wechat: null, qq: null,
  sourceId: null, sourceName: null, intention: null, status: 'contact_valid', ownerUserId: 7, ownerUserName: '王伟', ownerDepartmentId: 10,
  createdBy: 7, createdByUserName: '王伟', lastFollowUpAt: null, nextFollowUpAt: null, disqualifyReason: null, disqualifyCode: null,
  convertedCustomerId: null, convertedContactId: null, convertedAt: null,
  createdAt: new Date('2026-09-07T00:00:00.000Z'), updatedAt: new Date('2026-09-07T00:00:00.000Z'),
}

afterEach(() => vi.restoreAllMocks())

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(leadRoutes)
  await app.ready()
  return app
}

describe('POST /:id/activities follow-up status contract', () => {
  it('passes an accepted selected status to the activity service and rejects omitted or legacy values', async () => {
    const create = vi.spyOn(LeadActivityService.prototype, 'create').mockResolvedValue({ activity, lead })
    const app = await buildApp()

    const accepted = await app.inject({
      method: 'POST', url: '/12/activities',
      payload: { type: 'phone', content: '已联系', followUpStatus: 'contact_valid' },
    })
    const omitted = await app.inject({
      method: 'POST', url: '/12/activities',
      payload: { type: 'phone', content: '已联系' },
    })
    const legacy = await app.inject({
      method: 'POST', url: '/12/activities',
      payload: { type: 'phone', content: '已联系', followUpStatus: 'processing' },
    })

    expect(accepted.statusCode).toBe(200)
    expect(create).toHaveBeenCalledWith(12, expect.objectContaining({ followUpStatus: 'contact_valid' }), undefined)
    expect(omitted.statusCode).toBe(400)
    expect(legacy.statusCode).toBe(400)
    expect(create).toHaveBeenCalledTimes(1)
    await app.close()
  })
})
