import { type FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { QuotationService } from '../../../services/quotation.service.js'
import { PublicQuoteResponseSchema, PublicQuoteTokenParamSchema } from '../../../schemas/quotation.schema.js'
import { EnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

/** 不挂认证的公开报价读取接口；返回白名单 DTO，并禁止缓存。 */
export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new QuotationService()
  route.get(
    '/quotes/:token',
    {
      access: { permission: PERMS.PUBLIC_QUOTE_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: '公开报价查看',
        operationId: 'crmPublicQuoteGet',
        params: PublicQuoteTokenParamSchema,
        response: { 200: EnvelopeSchema(PublicQuoteResponseSchema) },
      },
    },
    async (request: any, reply: any) => {
      reply.header('Cache-Control', 'private, no-store')
      reply.header('X-Robots-Tag', 'noindex, nofollow')
      return ResponseUtil.success(reply, await service.publicQuote(request.params.token))
    },
  )
}) as FastifyPluginAsync
