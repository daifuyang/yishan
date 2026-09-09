/**
 * CRM 商机（crm_opportunity）路由。
 *
 * Phase 2 引入。Phase 3 合同可由 accepted 报价创建。
 *
 * 路由：
 *   GET    /api/crm/v1/opportunities              列表（带筛选）
 *   POST   /api/crm/v1/opportunities              新建
 *   GET    /api/crm/v1/opportunities/kanban       管道看板（按 stageCode 分组）
 *   GET    /api/crm/v1/opportunities/:id          详情
 *   PATCH  /api/crm/v1/opportunities/:id          编辑（白名单字段）
 *   DELETE /api/crm/v1/opportunities/:id          软删除
 *   POST   /api/crm/v1/opportunities/:id/advance  推进阶段
 *   POST   /api/crm/v1/opportunities/:id/won      赢单
 *   POST   /api/crm/v1/opportunities/:id/lost     丢单
 *   POST   /api/crm/v1/opportunities/:id/transfer 转移负责人
 */

import { type FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { OpportunityService } from '../../../services/opportunity.service.js'
import {
  OpportunityAdvanceReqSchema,
  OpportunityCreateReqSchema,
  OpportunityIdParamSchema,
  OpportunityKanbanQuerySchema,
  OpportunityKanbanRespSchema,
  OpportunityListQuerySchema,
  OpportunityMarkLostReqSchema,
  OpportunityMarkWonReqSchema,
  OpportunityRespSchema,
  OpportunityTransferReqSchema,
  OpportunityUpdateReqSchema,
} from '../../../schemas/opportunity.schema.js'
import { EnvelopeSchema, PaginatedEnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new OpportunityService()

  route.get('/', {
    access: { permission: PERMS.OPPORTUNITY_LIST },
    schema: {
      tags: [ROUTE_TAG],
      summary: '商机列表',
      operationId: 'crmOpportunitiesList',
      querystring: OpportunityListQuerySchema,
      response: { 200: PaginatedEnvelopeSchema(OpportunityRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const result = await service.list(request.query, request.currentUser)
    return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
  })

  route.post('/', {
    access: { permission: PERMS.OPPORTUNITY_CREATE },
    schema: {
      tags: [ROUTE_TAG],
      summary: '新建商机',
      operationId: 'crmOpportunitiesCreate',
      body: OpportunityCreateReqSchema,
      response: { 200: EnvelopeSchema(OpportunityRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const row = await service.create({ input: request.body, currentUser: request.currentUser })
    return ResponseUtil.success(reply, row, '商机创建成功')
  })

  route.get('/kanban', {
    access: { permission: PERMS.OPPORTUNITY_LIST },
    schema: {
      tags: [ROUTE_TAG],
      summary: '管道看板视图',
      operationId: 'crmOpportunitiesKanban',
      querystring: OpportunityKanbanQuerySchema,
      response: { 200: EnvelopeSchema(OpportunityKanbanRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const result = await service.kanban(request.query.pipelineCode, request.currentUser)
    return ResponseUtil.success(reply, result)
  })

  route.get('/:id', {
    access: { permission: PERMS.OPPORTUNITY_LIST },
    schema: {
      tags: [ROUTE_TAG],
      summary: '商机详情',
      operationId: 'crmOpportunityGet',
      params: OpportunityIdParamSchema,
      response: { 200: EnvelopeSchema(OpportunityRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const row = await service.detail(request.params.id, request.currentUser)
    return ResponseUtil.success(reply, row)
  })

  route.patch('/:id', {
    access: { permission: PERMS.OPPORTUNITY_UPDATE },
    schema: {
      tags: [ROUTE_TAG],
      summary: '编辑商机',
      operationId: 'crmOpportunityUpdate',
      params: OpportunityIdParamSchema,
      body: OpportunityUpdateReqSchema,
      response: { 200: EnvelopeSchema(OpportunityRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const row = await service.update({ id: request.params.id, input: request.body, currentUser: request.currentUser })
    return ResponseUtil.success(reply, row, '商机已更新')
  })

  route.delete('/:id', {
    access: { permission: PERMS.OPPORTUNITY_DELETE },
    schema: {
      tags: [ROUTE_TAG],
      summary: '删除商机（软删）',
      operationId: 'crmOpportunityDelete',
      params: OpportunityIdParamSchema,
      response: { 200: EnvelopeSchema(Type.Object({ id: Type.Number() })) },
    },
  }, async (request: any, reply: any) => {
    await service.delete({ id: request.params.id, currentUser: request.currentUser })
    return ResponseUtil.success(reply, { id: request.params.id }, '商机已删除')
  })

  route.post('/:id/advance', {
    access: { permission: PERMS.OPPORTUNITY_STAGE },
    schema: {
      tags: [ROUTE_TAG],
      summary: '推进商机阶段',
      operationId: 'crmOpportunityAdvance',
      params: OpportunityIdParamSchema,
      body: OpportunityAdvanceReqSchema,
      response: { 200: EnvelopeSchema(OpportunityRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const row = await service.advanceStage({
      id: request.params.id,
      input: request.body,
      currentUser: request.currentUser,
    })
    return ResponseUtil.success(reply, row, '商机阶段已推进')
  })

  route.post('/:id/won', {
    access: { permission: PERMS.OPPORTUNITY_WON },
    schema: {
      tags: [ROUTE_TAG],
      summary: '标记商机为赢单',
      operationId: 'crmOpportunityMarkWon',
      params: OpportunityIdParamSchema,
      body: OpportunityMarkWonReqSchema,
      response: { 200: EnvelopeSchema(OpportunityRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const row = await service.markWon({
      id: request.params.id,
      input: request.body,
      currentUser: request.currentUser,
    })
    return ResponseUtil.success(reply, row, '商机已赢单')
  })

  route.post('/:id/lost', {
    access: { permission: PERMS.OPPORTUNITY_LOST },
    schema: {
      tags: [ROUTE_TAG],
      summary: '标记商机为丢单',
      operationId: 'crmOpportunityMarkLost',
      params: OpportunityIdParamSchema,
      body: OpportunityMarkLostReqSchema,
      response: { 200: EnvelopeSchema(OpportunityRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const row = await service.markLost({
      id: request.params.id,
      input: request.body,
      currentUser: request.currentUser,
    })
    return ResponseUtil.success(reply, row, '商机已丢单')
  })

  route.post('/:id/transfer', {
    access: { permission: PERMS.OPPORTUNITY_TRANSFER },
    schema: {
      tags: [ROUTE_TAG],
      summary: '转移商机负责人',
      operationId: 'crmOpportunityTransfer',
      params: OpportunityIdParamSchema,
      body: OpportunityTransferReqSchema,
      response: { 200: EnvelopeSchema(OpportunityRespSchema) },
    },
  }, async (request: any, reply: any) => {
    const row = await service.transferOwner({
      id: request.params.id,
      input: request.body,
      currentUser: request.currentUser,
    })
    return ResponseUtil.success(reply, row, '商机已转移')
  })
}) as FastifyPluginAsync
