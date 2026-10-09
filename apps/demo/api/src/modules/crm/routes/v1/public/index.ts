import { type FastifyPluginAsync } from 'fastify'
import type { Static } from '@sinclair/typebox'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { QuotationService } from '../../../services/quotation.service.js'
import { PublicQuoteResponseSchema, PublicQuoteTokenParamSchema } from '../../../schemas/quotation.schema.js'
import { EnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

/** 不挂认证的公开报价读取接口；返回白名单 DTO，并禁止缓存。 */
export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new QuotationService()
  route.get<{ Params: Static<typeof PublicQuoteTokenParamSchema> }>(
    '/quotes/:token',
    {
      access: { permission: PERMS.PUBLIC_QUOTE_VIEW, public: true },
      schema: {
        tags: [ROUTE_TAG],
        summary: '公开报价查看',
        operationId: 'crmPublicQuoteGet',
        params: PublicQuoteTokenParamSchema,
        response: { 200: EnvelopeSchema(PublicQuoteResponseSchema) },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store')
      reply.header('X-Robots-Tag', 'noindex, nofollow')
      return ResponseUtil.success(reply, await service.publicQuote(request.params.token))
    },
  )
}) as FastifyPluginAsync
