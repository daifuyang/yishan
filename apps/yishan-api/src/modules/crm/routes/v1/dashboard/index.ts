import { type FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { DashboardService } from '../../../services/dashboard.service.js'
import { DashboardRespSchema } from '../../../schemas/dashboard.schema.js'
import { ROUTE_TAG, EnvelopeSchema } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

/**
 * CRM 工作台。
 */

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new DashboardService()

  route.get(
    '/',
    {
      access: { permission: PERMS.DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'CRM 工作台',
        operationId: 'crmDashboard',
        response: { 200: EnvelopeSchema(DashboardRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const data = await service.get(request.currentUser)
      return ResponseUtil.success(reply, data)
    },
  )
}) as FastifyPluginAsync
