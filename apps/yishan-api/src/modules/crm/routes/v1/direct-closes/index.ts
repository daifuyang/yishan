import { type FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { DirectCloseService } from '../../../services/direct-close.service.js'
import { DirectCloseActionRespSchema, DirectCloseIdParamSchema, DirectCloseRevokeReqSchema } from '../../../schemas/direct-close.schema.js'
import { EnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new DirectCloseService()

  route.post('/:id/revoke', {
    access: { permission: PERMS.DIRECT_CLOSE_MANAGE },
    schema: {
      tags: [ROUTE_TAG],
      summary: '撤销无合同成交确认',
      operationId: 'crmDirectCloseRevoke',
      params: DirectCloseIdParamSchema,
      body: DirectCloseRevokeReqSchema,
      response: { 200: EnvelopeSchema(DirectCloseActionRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const result = await service.revoke(request.params.id, request.body, request.currentUser)
    return ResponseUtil.success(reply, result, '已撤销无合同成交确认')
  })
}) as FastifyPluginAsync
