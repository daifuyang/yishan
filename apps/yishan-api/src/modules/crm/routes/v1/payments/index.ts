import { type FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { PaymentService } from '../../../services/payment.service.js'
import { PaymentContractParamSchema, PaymentCreateReqSchema, PaymentIdParamSchema, PaymentRespSchema, PaymentUpdateReqSchema } from '../../../schemas/payment.schema.js'
import { EnvelopeSchema, OkEnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'
export default (async (app) => { const route = createRouteRegistrar(app); const service = new PaymentService()
  route.get('/contracts/:contractId', { access: { permission: PERMS.CONTRACT_PAYMENT_VIEW }, schema: { tags: [ROUTE_TAG], params: PaymentContractParamSchema } }, async (request: any, reply: any) => ResponseUtil.success(reply, await service.listByContract(request.params.contractId, request.currentUser)))
  route.post('/contracts/:contractId', { access: { permission: PERMS.CONTRACT_PAYMENT_MANAGE }, schema: { tags: [ROUTE_TAG], params: PaymentContractParamSchema, body: PaymentCreateReqSchema, response: { 200: EnvelopeSchema(PaymentRespSchema) } } }, async (request: any, reply: any) => ResponseUtil.success(reply, await service.create(request.params.contractId, request.body, request.currentUser)))
  route.patch('/:id', { access: { permission: PERMS.CONTRACT_PAYMENT_MANAGE }, schema: { tags: [ROUTE_TAG], params: PaymentIdParamSchema, body: PaymentUpdateReqSchema, response: { 200: EnvelopeSchema(PaymentRespSchema) } } }, async (request: any, reply: any) => ResponseUtil.success(reply, await service.update(request.params.id, request.body, request.currentUser)))
  route.delete('/:id', { access: { permission: PERMS.CONTRACT_PAYMENT_MANAGE }, schema: { tags: [ROUTE_TAG], params: PaymentIdParamSchema, response: { 200: OkEnvelopeSchema } } }, async (request: any, reply: any) => { await service.remove(request.params.id, request.currentUser); return ResponseUtil.success(reply, null) })
}) as FastifyPluginAsync
