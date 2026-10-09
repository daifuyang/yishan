import type { FastifyPluginAsync } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { CrmAttachmentService } from '../../../services/attachment.service'
import { CrmPermissions as PERMS } from '../../../schemas/permissions'
import { EnvelopeSchema, OkEnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema'

const Attachment = Type.Object({ id: Type.Number(), customerId: Type.Number(), entityType: Type.String(), entityId: Type.Number(), attachmentId: Type.Number(), creatorId: Type.Union([Type.Number(), Type.Null()]), createdAt: Type.String({ format: 'date-time' }) })
const CustomerQuery = Type.Object({ customerId: Type.Integer({ minimum: 1 }) })
const CreateBody = Type.Object({ customerId: Type.Integer({ minimum: 1 }), entityType: Type.Union([Type.Literal('customer'), Type.Literal('activity')]), entityId: Type.Integer({ minimum: 1 }), attachmentId: Type.Integer({ minimum: 1 }) })
const IdParams = Type.Object({ id: Type.Integer({ minimum: 1 }) })

const routes: FastifyPluginAsync = async app => {
  const route = createRouteRegistrar(app)
  const attachments = new CrmAttachmentService()
  route.get<{ Querystring: Static<typeof CustomerQuery> }>('/', { access: { permission: PERMS.ATTACHMENT_LIST }, schema: { tags: [ROUTE_TAG], querystring: CustomerQuery, response: { 200: EnvelopeSchema(Type.Array(Attachment)) } } }, async (request, reply) => {
    return ResponseUtil.success(reply, await attachments.list(request.query.customerId, request.currentUser))
  })
  route.post<{ Body: Static<typeof CreateBody> }>('/', { access: { permission: PERMS.ATTACHMENT_MANAGE }, schema: { tags: [ROUTE_TAG], body: CreateBody, response: { 200: EnvelopeSchema(Attachment) } } }, async (request, reply) => {
    return ResponseUtil.success(reply, await attachments.create(request.body, request.currentUser))
  })
  route.delete<{ Params: Static<typeof IdParams> }>('/:id', { access: { permission: PERMS.ATTACHMENT_MANAGE }, schema: { tags: [ROUTE_TAG], params: IdParams, response: { 200: OkEnvelopeSchema } } }, async (request, reply) => {
    await attachments.remove(request.params.id, request.currentUser)
    return ResponseUtil.success(reply, null)
  })
}
export default routes
