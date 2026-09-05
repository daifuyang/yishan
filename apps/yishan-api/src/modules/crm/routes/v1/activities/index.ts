/**
 * CRM 跟进记录：按 id 操作（GET / PATCH / DELETE）。
 *
 * "客户下的跟进列表 / 新建" 仍然在 customers/index.ts 里以 `/:customerId/activities`
 * 注册 —— 因为它们的主语是"客户"，URL 形态上挂在客户之下更直观。
 * 这里的 /:id 形态服务于"已存在跟进记录的编辑 / 删除"两个动作，单独放一个文件。
 */

import { type FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { ActivityService } from '../../../services/activity.service.js'
import {
  ActivityRespSchema,
  ActivityUpdateReqSchema,
} from '../../../schemas/activity.schema.js'
import { CrmCustomerIdParamsSchema } from '../../../schemas/common.schema.js'
import { EnvelopeSchema, OkEnvelopeSchema } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'

const ActivityIdParamsSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
})

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new ActivityService()

  route.get(
    '/:id',
    {
      access: { permission: PERMS.ACTIVITY_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '按 id 获取跟进记录',
        operationId: 'crmActivityGet',
        params: ActivityIdParamsSchema,
        response: { 200: EnvelopeSchema(ActivityRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const row = await service.findById(Number(request.params.id), request.currentUser)
      return ResponseUtil.success(reply, row)
    },
  )

  route.patch(
    '/:id',
    {
      access: { permission: PERMS.ACTIVITY_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '编辑跟进记录',
        operationId: 'crmActivityUpdate',
        params: ActivityIdParamsSchema,
        body: ActivityUpdateReqSchema,
        response: { 200: EnvelopeSchema(ActivityRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await service.update(Number(request.params.id), request.body, request.currentUser)
      return ResponseUtil.success(reply, updated, '跟进记录已更新')
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.ACTIVITY_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除跟进记录（软删）',
        operationId: 'crmActivityDelete',
        params: ActivityIdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await service.remove(Number(request.params.id), request.currentUser)
      return ResponseUtil.success(reply, null, '跟进记录已删除')
    },
  )

  // 触发 CrmCustomerIdParamsSchema 的导入以保留共享类型；同时也避免无副作用的 import 被 tree-shake
  void CrmCustomerIdParamsSchema
}) as FastifyPluginAsync
