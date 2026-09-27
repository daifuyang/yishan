import { and, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { drizzleDb } from '@/db'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { crmAttachment } from '../../../db/schema.js'
import { CustomerService } from '../../../services/customer.service.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'
import { EnvelopeSchema, OkEnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema.js'

const Attachment = Type.Object({ id: Type.Number(), customerId: Type.Number(), entityType: Type.String(), entityId: Type.Number(), attachmentId: Type.Number(), creatorId: Type.Union([Type.Number(), Type.Null()]), createdAt: Type.String({ format: 'date-time' }) })
const CustomerQuery = Type.Object({ customerId: Type.Integer({ minimum: 1 }) })
const CreateBody = Type.Object({ customerId: Type.Integer({ minimum: 1 }), entityType: Type.Union([Type.Literal('customer'), Type.Literal('activity')]), entityId: Type.Integer({ minimum: 1 }), attachmentId: Type.Integer({ minimum: 1 }) })
const IdParams = Type.Object({ id: Type.Integer({ minimum: 1 }) })

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const customers = new CustomerService()
  route.get('/', { access: { permission: PERMS.ATTACHMENT_LIST }, schema: { tags: [ROUTE_TAG], querystring: CustomerQuery, response: { 200: EnvelopeSchema(Type.Array(Attachment)) } } }, async (request: any, reply: any) => {
    await customers.detail(request.query.customerId, request.currentUser)
    return ResponseUtil.success(reply, await drizzleDb.select().from(crmAttachment).where(eq(crmAttachment.customerId, request.query.customerId)))
  })
  route.post('/', { access: { permission: PERMS.ATTACHMENT_MANAGE }, schema: { tags: [ROUTE_TAG], body: CreateBody, response: { 200: EnvelopeSchema(Attachment) } } }, async (request: any, reply: any) => {
    await customers.detail(request.body.customerId, request.currentUser)
    const [inserted] = await drizzleDb.insert(crmAttachment).values({ ...request.body, creatorId: request.currentUser.id }).$returningId()
    const [row] = await drizzleDb.select().from(crmAttachment).where(eq(crmAttachment.id, inserted.id))
    return ResponseUtil.success(reply, row)
  })
  route.delete('/:id', { access: { permission: PERMS.ATTACHMENT_MANAGE }, schema: { tags: [ROUTE_TAG], params: IdParams, response: { 200: OkEnvelopeSchema } } }, async (request: any, reply: any) => {
    const [row] = await drizzleDb.select().from(crmAttachment).where(eq(crmAttachment.id, request.params.id))
    if (row) { await customers.detail(row.customerId, request.currentUser); await drizzleDb.delete(crmAttachment).where(and(eq(crmAttachment.id, row.id), eq(crmAttachment.customerId, row.customerId))) }
    return ResponseUtil.success(reply, null)
  })
}) as FastifyPluginAsync
