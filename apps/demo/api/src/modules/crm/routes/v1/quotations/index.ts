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
import { type FastifyPluginAsync, type FastifyRequest, type FastifyReply } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { QuotationService } from '../../../services/quotation.service.js'
import { ContractService } from '../../../services/contract.service.js'
import {
  QuotationCreateReqSchema,
  QuotationIdParamSchema,
  QuotationListQuerySchema,
  QuoteSeriesSummaryRespSchema,
  QuotationReasonReqSchema,
  QuotationRevokeConfirmationReqSchema,
  type QuotationRevokeConfirmationReq,
  QuotationRespSchema,
  QuotationStatusLogListRespSchema,
  QuotationUpdateReqSchema,
  QuotationShareCreateReqSchema,
  QuotationShareIdParamSchema,
  QuotationSendReqSchema,
  PublicQuoteSchema,
} from '../../../schemas/quotation.schema.js'
import { EnvelopeSchema, PaginatedEnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'
import { ContractCreateReqSchema, ContractRespSchema, type ContractCreateReq } from '../../../schemas/contract.schema.js'

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new QuotationService()
  const contractService = new ContractService()

  route.post(
    '/:id/revise',
    {
      access: { permission: PERMS.QUOTATION_CREATE },
      schema: {
        tags: [ROUTE_TAG], summary: '基于报价创建新版本草稿', operationId: 'crmQuotationsRevise',
        params: QuotationIdParamSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
      preHandler: app.requirePermission(PERMS.QUOTATION_UPDATE),
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const detail = await service.reviseQuotation(request.params.id, request.currentUser)
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items, share: null, versions: detail.versions ?? [], seriesTitle: detail.head.name, currentVersion: detail.versions?.[0]?.version ?? detail.head.version, versionCount: detail.versions?.length ?? 1 }, '新版本草稿已创建')
    },
  )

  route.get(
    '/duplicates',
    {
      access: { permission: PERMS.QUOTATION_LIST },
      schema: {
        tags: [ROUTE_TAG], summary: '查询同商机同名进行中报价系列', operationId: 'crmQuotationsDuplicates',
        querystring: Type.Object({ opportunityId: Type.Integer({ minimum: 1 }), name: Type.String({ minLength: 1, maxLength: 100 }) }),
        response: { 200: Type.Object({ success: Type.Boolean(), code: Type.Number(), message: Type.String(), data: Type.Array(QuoteSeriesSummaryRespSchema) }) },
      },
    },
    async (request: FastifyRequest<{ Querystring: { opportunityId: number; name: string } }>, reply: FastifyReply) =>
      ResponseUtil.success(reply, await service.findDuplicateSeries(request.query.opportunityId, request.query.name, request.currentUser)),
  )

  route.get(
    '/:id/preview',
    {
      access: { permission: PERMS.QUOTATION_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '内部预览报价（不计入客户查看）',
        operationId: 'crmQuotationsPreview',
        params: QuotationIdParamSchema,
        response: { 200: EnvelopeSchema(PublicQuoteSchema) },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'private, no-store')
      reply.header('X-Robots-Tag', 'noindex, nofollow')
      return ResponseUtil.success(reply, await service.previewQuote(request.params.id, request.currentUser))
    },
  )

  route.get(
    '/',
    {
      access: { permission: PERMS.QUOTATION_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '报价单列表',
        operationId: 'crmQuotationsList',
        querystring: QuotationListQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(QuoteSeriesSummaryRespSchema) },
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
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items, share: detail.share ?? null, versions: detail.versions ?? [], seriesTitle: detail.head.name, currentVersion: detail.versions?.[0]?.version ?? detail.head.version, versionCount: detail.versions?.length ?? 1 }, '报价单已创建')
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
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items, share: detail.share ?? null, versions: detail.versions ?? [], seriesTitle: detail.head.name, currentVersion: detail.versions?.[0]?.version ?? detail.head.version, versionCount: detail.versions?.length ?? 1 })
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
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items, share: detail.share ?? null, versions: detail.versions ?? [], seriesTitle: detail.head.name, currentVersion: detail.versions?.[0]?.version ?? detail.head.version, versionCount: detail.versions?.length ?? 1 }, '报价单已更新')
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
        body: QuotationSendReqSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const detail = await service.sendQuotationWithShare(request.params.id, request.body.shareId, request.currentUser)
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items, share: detail.share ?? null, versions: detail.versions ?? [], seriesTitle: detail.head.name, currentVersion: detail.versions?.[0]?.version ?? detail.head.version, versionCount: detail.versions?.length ?? 1 }, '报价单已发送')
    },
  )

  route.post(
    '/:id/shares',
    {
      access: { permission: PERMS.QUOTATION_SEND },
      schema: {
        tags: [ROUTE_TAG],
        summary: '生成报价公开分享链接',
        operationId: 'crmQuotationsCreateShare',
        params: QuotationIdParamSchema,
        body: QuotationShareCreateReqSchema,
        response: { 200: EnvelopeSchema(Type.Object({
          shareId: Type.Number(),
          url: Type.String(),
          expiresAt: Type.String({ format: 'date-time' }),
        })) },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.createShare(request.params.id, request.body ?? {}, request.currentUser)
      return ResponseUtil.success(reply, { shareId: result.share.id, url: result.url, expiresAt: result.share.expiresAt }, '报价链接已生成')
    },
  )

  route.post(
    '/:id/shares/:shareId/revoke',
    {
      access: { permission: PERMS.QUOTATION_SEND },
      schema: {
        tags: [ROUTE_TAG],
        summary: '停用报价公开分享链接',
        operationId: 'crmQuotationsRevokeShare',
        params: QuotationShareIdParamSchema,
        response: { 200: EnvelopeSchema(Type.Object({ id: Type.Number() })) },
      },
    },
    async (request: any, reply: any) => {
      await service.revokeShare(request.params.id, request.params.shareId, request.currentUser)
      return ResponseUtil.success(reply, { id: request.params.shareId }, '分享链接已停用')
    },
  )

  route.post(
    '/:id/accept',
    {
      access: { permission: PERMS.QUOTATION_ACCEPT },
      schema: {
        tags: [ROUTE_TAG],
        summary: '销售确认报价（sent → accepted）',
        operationId: 'crmQuotationsAccept',
        params: QuotationIdParamSchema,
        response: { 200: EnvelopeSchema(QuotationRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const detail = await service.acceptQuotation(request.params.id, request.currentUser)
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items }, '报价已确认')
    },
  )

  route.post('/:id/revoke-confirmation', {
    access: { permission: PERMS.QUOTATION_ACCEPT },
    schema: { tags: [ROUTE_TAG], summary: '撤销报价确认（未生成合同）', operationId: 'crmQuotationsRevokeConfirmation',
      params: QuotationIdParamSchema, body: QuotationRevokeConfirmationReqSchema, response: { 200: EnvelopeSchema(QuotationRespSchema) } },
  }, async (request: FastifyRequest<{ Params: { id: number }; Body: QuotationRevokeConfirmationReq }>, reply: FastifyReply) => {
    const detail = await service.revokeConfirmation(request.params.id, request.body, request.currentUser)
    return ResponseUtil.success(reply, { ...detail.head, items: detail.items }, '报价确认已撤销')
  })

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
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items, versions: detail.versions ?? [], seriesTitle: detail.head.name, currentVersion: detail.versions?.[0]?.version ?? detail.head.version, versionCount: detail.versions?.length ?? 1 }, '报价单已拒绝')
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
      return ResponseUtil.success(reply, { ...detail.head, items: detail.items, versions: detail.versions ?? [], seriesTitle: detail.head.name, currentVersion: detail.versions?.[0]?.version ?? detail.head.version, versionCount: detail.versions?.length ?? 1 }, '报价单已作废')
    },
  )

  route.post(
    '/:id/contract',
    {
      access: { permission: PERMS.CONTRACT_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '提交已确认报价的合同表单',
        operationId: 'crmQuotationsCreateContract',
        params: QuotationIdParamSchema,
        body: ContractCreateReqSchema,
        response: { 200: EnvelopeSchema(ContractRespSchema) },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: ContractCreateReq }>, reply: FastifyReply) => {
      return ResponseUtil.success(
        reply,
        await contractService.createFromQuotation(request.params.id, request.currentUser, {
          ...request.body, opportunityId: request.body.opportunityId ?? null, quotationId: request.params.id, contactId: request.body.contactId ?? null,
          signedAt: request.body.signedAt ? new Date(request.body.signedAt) : null,
          effectiveAt: request.body.effectiveAt ? new Date(request.body.effectiveAt) : null,
          expiresAt: request.body.expiresAt ? new Date(request.body.expiresAt) : null,
          status: request.body.status ?? 'draft', ownerUserId: request.currentUser.id, ownerDepartmentId: request.currentUser.deptIds?.[0] ?? null,
          attachmentIds: null, description: request.body.description ?? null,
        }),
        '合同已创建',
      )
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
