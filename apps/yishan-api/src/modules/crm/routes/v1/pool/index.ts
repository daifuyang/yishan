import { type FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { CustomerService } from '../../../services/customer.service.js'
import { CustomerListQuerySchema, CustomerRespSchema } from '../../../schemas/customer.schema.js'
import { ROUTE_TAG, PaginatedEnvelopeSchema } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

/**
 * CRM 公海资源。
 *
 * 仅返回 poolStatus = 'public' 的客户 —— 业务层强制覆盖（Service.list 在 query 里强制 poolStatus=public）。
 */

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new CustomerService()

  route.get(
    '/',
    {
      access: { permission: PERMS.POOL_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户公海',
        operationId: 'crmPoolList',
        querystring: CustomerListQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(CustomerRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.list({
        query: { ...request.query, poolStatus: 'public' },
        currentUser: request.currentUser,
      })
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )
}) as FastifyPluginAsync
