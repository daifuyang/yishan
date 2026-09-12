/**
 * CRM 报价单（Phase 2 Quotation）路由。
 *
 * 全部挂在 /api/crm/v1/quotations 下（来自 module meta.id = 'crm' + autoload 的 v1 路径）。
 *
 * 路由策略：
 *   - 列表 / 详情 / 编辑 / 删除 / 状态机迁移全部按 PERMS.QUOTATION_* 授权；
 *   - 状态机迁移路径（send / accept / reject / void）走 POST /:id/<action>；
 *   - 编辑请求只接受 items + 几个白名单字段；ownerUserId/status/version 在 schema 层就拒。
 */
import { type FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { QuotationService } from '../../../services/quotation.service.js'
import {
  QuotationCreateReqSchema,
  QuotationIdParamSchema,
  QuotationListQuerySchema,
  QuotationReasonReqSchema,
  QuotationRespSchema,
  QuotationStatusLogListRespSchema,
  QuotationUpdateReqSchema,
} from '../../../schemas/quotation.schema.js'
import { EnvelopeSchema, PaginatedEnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new QuotationService()

  route.get(
    '/',
    {
      access: { permission: PERMS.QUOTATION_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '报价单列表',
        operationId: 'crmQuotationsList',
        querystring: QuotationListQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.list(request.query, request.currentUser)
      return ResponseUtil.paginated(
        reply,
        result.items,
        result.page,
        result.pageSize,
        result.total,
      )
    },
  )

  route.post(
    '/',
    {
      access: { permission: PERMS.QUOTATION_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建报价单（draft）',
        operationId: 'crmQuotationsCreate',
        body: QuotationCreateReqSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const detail = await service.createDraft(request.body, request.currentUser)
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items }, '报价单已创建')
    },
  )

  route.get(
    '/:id',
    {
      access: { permission: PERMS.QUOTATION_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '报价单详情',
        operationId: 'crmQuotationsGet',
        params: QuotationIdParamSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const detail = await service.findDetailById(request.params.id, request.currentUser)
      // QuotationRespSchema 期望扁平 items；这里把 head.items 合并回主表
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items })
    },
  )

  route.patch(
    '/:id',
    {
      access: { permission: PERMS.QUOTATION_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '编辑报价单（仅 draft 阶段生效）',
        operationId: 'crmQuotationsUpdate',
        params: QuotationIdParamSchema,
        body: QuotationUpdateReqSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const detail = await service.updateDraft(request.params.id, request.body, request.currentUser)
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items }, '报价单已更新')
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.QUOTATION_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '软删除报价单（仅 draft 阶段生效）',
        operationId: 'crmQuotationsDelete',
        params: QuotationIdParamSchema,
        response: { 200: EnvelopeSchema(Type.Object({ id: Type.Number() })) },
      },
    },
    async (request: any, reply: any) => {
      await service.softDelete(request.params.id, request.currentUser)
      return ResponseUtil.success(reply, { id: request.params.id }, '报价单已删除')
    },
  )

  route.post(
    '/:id/send',
    {
      access: { permission: PERMS.QUOTATION_SEND },
      schema: {
        tags: [ROUTE_TAG],
        summary: '发送报价单（draft → sent）',
        operationId: 'crmQuotationsSend',
        params: QuotationIdParamSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const detail = await service.sendQuotation(request.params.id, request.currentUser)
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items }, '报价单已发送')
    },
  )

  route.post(
    '/:id/accept',
    {
      access: { permission: PERMS.QUOTATION_ACCEPT },
      schema: {
        tags: [ROUTE_TAG],
        summary: '接受报价单（sent → accepted；同 opportunity 旧版自动 superseded）',
        operationId: 'crmQuotationsAccept',
        params: QuotationIdParamSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const detail = await service.acceptQuotation(request.params.id, request.currentUser)
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items }, '报价单已接受')
    },
  )

  route.post(
    '/:id/reject',
    {
      access: { permission: PERMS.QUOTATION_REJECT },
      schema: {
        tags: [ROUTE_TAG],
        summary: '拒绝报价单（sent → rejected）',
        operationId: 'crmQuotationsReject',
        params: QuotationIdParamSchema,
        body: QuotationReasonReqSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const detail = await service.rejectQuotation(request.params.id, request.body?.reason, request.currentUser)
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items }, '报价单已拒绝')
    },
  )

  route.post(
    '/:id/void',
    {
      access: { permission: PERMS.QUOTATION_VOID },
      schema: {
        tags: [ROUTE_TAG],
        summary: '作废报价单（draft/sent → voided）',
        operationId: 'crmQuotationsVoid',
        params: QuotationIdParamSchema,
        body: QuotationReasonReqSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const detail = await service.voidQuotation(request.params.id, request.body?.reason, request.currentUser)
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items }, '报价单已作废')
    },
  )

  route.get(
    '/:id/status-logs',
    {
      access: { permission: PERMS.QUOTATION_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '报价单状态变更审计',
        operationId: 'crmQuotationsStatusLogs',
        params: QuotationIdParamSchema,
        response: { 200: EnvelopeSchema(QuotationStatusLogListRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.listStatusLogs(request.params.id, request.currentUser)
      return ResponseUtil.success(reply, result)
    },
  )
}) as FastifyPluginAsync