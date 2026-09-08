import { type FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { LeadService } from '../../../services/lead.service.js'
import { LeadActivityService } from '../../../services/lead-activity.service.js'
import { LeadConversionService } from '../../../services/lead-conversion.service.js'
import {
  LeadActivityCreateReqSchema,
  LeadActivityCreateRespSchema,
  LeadActivityListRespSchema,
  LeadAssignReqSchema,
  LeadConvertReqSchema,
  LeadConversionPreviewSchema,
  LeadConversionResultSchema,
  LeadCreateReqSchema,
  LeadDisqualifyReqSchema,
  LeadIdParamSchema,
  LeadListQuerySchema,
  LeadQualificationReqSchema,
  LeadReactivateReqSchema,
  LeadRespSchema,
  LeadUpdateReqSchema,
} from '../../../schemas/lead.schema.js'
import { ROUTE_TAG, EnvelopeSchema, PaginatedEnvelopeSchema } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new LeadService()
  const activityService = new LeadActivityService()
  route.get('/', { access: { permission: PERMS.LEAD_LIST }, schema: { tags: [ROUTE_TAG], summary: '线索列表', operationId: 'crmLeadsList', querystring: LeadListQuerySchema, response: { 200: PaginatedEnvelopeSchema(LeadRespSchema) } } }, async (request: any, reply: any) => {
    const result = await service.list(request.query, request.currentUser)
    return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
  })
  route.post('/', { access: { permission: PERMS.LEAD_CREATE }, schema: { tags: [ROUTE_TAG], summary: '新建线索', operationId: 'crmLeadsCreate', body: LeadCreateReqSchema, response: { 200: EnvelopeSchema(LeadRespSchema) } } }, async (request: any, reply: any) => {
    const row = await service.create({ input: request.body, currentUser: request.currentUser })
    return ResponseUtil.success(reply, row, '线索创建成功')
  })
  /**
   * 编辑线索普通资料：仅白名单字段生效。
   * ownerUserId/status/convertedCustomerId 等业务字段被接口层拒绝。
   */
  route.patch('/:id', { access: { permission: PERMS.LEAD_UPDATE }, schema: { tags: [ROUTE_TAG], summary: '编辑线索资料', operationId: 'crmLeadsUpdate', params: LeadIdParamSchema, body: LeadUpdateReqSchema, response: { 200: EnvelopeSchema(LeadRespSchema) } } }, async (request: any, reply: any) => {
    const row = await service.update({ leadId: request.params.id, input: request.body, currentUser: request.currentUser })
    return ResponseUtil.success(reply, row, '线索已更新')
  })
  route.delete('/:id', { access: { permission: PERMS.LEAD_DELETE }, schema: { tags: [ROUTE_TAG], summary: '删除线索', operationId: 'crmLeadsDelete', params: LeadIdParamSchema, response: { 200: EnvelopeSchema(Type.Object({ id: Type.Number() })) } } }, async (request: any, reply: any) => {
    await service.delete({ leadId: request.params.id, currentUser: request.currentUser })
    return ResponseUtil.success(reply, { id: request.params.id }, '线索已删除')
  })
  route.get('/:id/activities', { access: { permission: PERMS.LEAD_LIST }, schema: { tags: [ROUTE_TAG], summary: '线索跟进记录', operationId: 'crmLeadActivitiesList', params: LeadIdParamSchema, response: { 200: EnvelopeSchema(LeadActivityListRespSchema) } } }, async (request: any, reply: any) => {
    const result = await activityService.listByLeadId(request.params.id, request.currentUser)
    return ResponseUtil.success(reply, result)
  })
  route.post('/:id/activities', { access: { permission: PERMS.LEAD_CREATE }, schema: { tags: [ROUTE_TAG], summary: '新增线索跟进', operationId: 'crmLeadActivitiesCreate', params: LeadIdParamSchema, body: LeadActivityCreateReqSchema, response: { 200: EnvelopeSchema(LeadActivityCreateRespSchema) } } }, async (request: any, reply: any) => {
    const result = await activityService.create(request.params.id, request.body, request.currentUser)
    return ResponseUtil.success(reply, result, '跟进记录已保存')
  })
  route.post('/:id/assign', { access: { permission: PERMS.LEAD_ASSIGN }, schema: { tags: [ROUTE_TAG], summary: '转移线索', operationId: 'crmLeadsAssign', params: LeadIdParamSchema, body: LeadAssignReqSchema, response: { 200: EnvelopeSchema(LeadRespSchema) } } }, async (request: any, reply: any) => {
    const row = await service.assign({ leadId: request.params.id, targetUserId: request.body.targetUserId, currentUser: request.currentUser })
    return ResponseUtil.success(reply, row, '线索已转移')
  })
  route.post('/:id/claim', { access: { permission: PERMS.LEAD_CLAIM }, schema: { tags: [ROUTE_TAG], summary: '领取线索', operationId: 'crmLeadsClaim', params: LeadIdParamSchema, response: { 200: EnvelopeSchema(LeadRespSchema) } } }, async (request: any, reply: any) => {
    const row = await service.claim({ leadId: request.params.id, currentUser: request.currentUser })
    return ResponseUtil.success(reply, row, '线索领取成功')
  })
  route.post('/:id/qualify', { access: { permission: PERMS.LEAD_QUALIFY }, schema: { tags: [ROUTE_TAG], summary: '判为有效', operationId: 'crmLeadsQualify', params: LeadIdParamSchema, body: LeadQualificationReqSchema, response: { 200: EnvelopeSchema(LeadRespSchema) } } }, async (request: any, reply: any) => {
    const row = await service.qualify({ leadId: request.params.id, evidence: request.body.evidence, nextAction: request.body.nextAction, currentUser: request.currentUser })
    return ResponseUtil.success(reply, row, '线索已判为有效')
  })
  route.post('/:id/disqualify', { access: { permission: PERMS.LEAD_DISQUALIFY }, schema: { tags: [ROUTE_TAG], summary: '作废线索', operationId: 'crmLeadsDisqualify', params: LeadIdParamSchema, body: LeadDisqualifyReqSchema, response: { 200: EnvelopeSchema(LeadRespSchema) } } }, async (request: any, reply: any) => {
    const row = await service.disqualify({ leadId: request.params.id, code: request.body.code, reason: request.body.reason, currentUser: request.currentUser })
    return ResponseUtil.success(reply, row, '线索已作废')
  })
  route.post('/:id/reactivate', { access: { permission: PERMS.LEAD_REACTIVATE }, schema: { tags: [ROUTE_TAG], summary: '重新激活线索', operationId: 'crmLeadsReactivate', params: LeadIdParamSchema, body: LeadReactivateReqSchema, response: { 200: EnvelopeSchema(LeadRespSchema) } } }, async (request: any, reply: any) => {
    const row = await service.reactivate({ leadId: request.params.id, reason: request.body.reason, currentUser: request.currentUser })
    return ResponseUtil.success(reply, row, '线索已重新激活')
  })
  const conversionService = new LeadConversionService()
  route.get('/:id/conversion-preview', { access: { permission: PERMS.LEAD_CONVERT }, schema: { tags: [ROUTE_TAG], summary: '线索转化预览', operationId: 'crmLeadsConversionPreview', params: LeadIdParamSchema, response: { 200: EnvelopeSchema(LeadConversionPreviewSchema) } } }, async (request: any, reply: any) => {
    const preview = await conversionService.preview(request.params.id, request.currentUser)
    return ResponseUtil.success(reply, preview, '获取转化预览成功')
  })
  route.post('/:id/convert', { access: { permission: PERMS.LEAD_CONVERT }, schema: { tags: [ROUTE_TAG], summary: '转为客户', operationId: 'crmLeadsConvert', params: LeadIdParamSchema, body: LeadConvertReqSchema, response: { 200: EnvelopeSchema(LeadConversionResultSchema) } } }, async (request: any, reply: any) => {
    const result = await conversionService.convert(request.params.id, request.body, request.currentUser)
    return ResponseUtil.success(reply, result, '线索已转为客户')
  })
}) as FastifyPluginAsync
