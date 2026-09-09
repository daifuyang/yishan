/**
 * 拜访独立列表。
 *
 * Phase 4 引入：复用 crm_activity(type='visit')，按 planned_at 排序。
 * 与"客户下的活动"路径区分，这里专门服务于"全局拜访日程"。
 */

import { type FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { ActivityService } from '../../../services/activity.service.js'
import { ActivityListRespSchema, VisitListQuerySchema } from '../../../schemas/activity.schema.js'
import { EnvelopeSchema } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new ActivityService()

  route.get('/', {
    access: { permission: PERMS.ACTIVITY_LIST },
    schema: {
      tags: [ROUTE_TAG],
      summary: '拜访独立列表（按 planned_at 排序）',
      operationId: 'crmVisitsList',
      querystring: VisitListQuerySchema,
      response: { 200: EnvelopeSchema(ActivityListRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const result = await service.listVisits(request.query, request.currentUser)
    return ResponseUtil.success(reply, { total: result.total, items: result.items })
  })
}) as FastifyPluginAsync
