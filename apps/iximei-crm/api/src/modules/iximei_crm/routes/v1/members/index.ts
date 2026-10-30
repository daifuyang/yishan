/**
 * 会员顾客资源路由（完整版）。
 *
 * 数据权限：
 *   - SUPER_ADMIN / ADMIN (dataScope=1) → 看全部
 *   - 其他 (dataScope=4 SELF 等) → 只看自己 owner 的（ownerUserId === currentUser.id）
 *   - rbac preHandler 已把 effectiveDataScope 写到 req.currentUser.dataScope
 */

import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { BusinessError } from '@yishan/core-api/errors'
import { ResourceErrorCode } from '@yishan/core-api/business-codes/resource'
import { PERMS } from '../../../permissions.js'
import { MembersService } from '../../../services/members.service.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { Type } from '@sinclair/typebox'
import {
  CrmMemberListQuerySchema,
  CrmMemberFromCustomerReqSchema,
  CrmMemberDirectReqSchema,
  CrmMemberUpdateReqSchema,
  CrmMemberFollowUpReqSchema,
  CrmMemberDispatchReqSchema,
  CrmMemberBatchAssignReqSchema,
  CrmMemberBatchTagReqSchema,
  CrmMemberBatchInvalidateReqSchema,
  CrmMemberRestoreReqSchema,
  CrmMemberTagReqSchema,
  CrmCustomerSelectableQuerySchema,
} from '../../../schemas/members.schema.js'
import { CrmIdParamsSchema } from '../../../schemas/shared.schema.js'
import { currentCrmDataScope, type DataScopeCode } from '@/modules/iximei_crm/access-scope'

const members: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const uid = (req: any) => req.currentUser.id
  const id = (req: any) => Number(req.params.id)
  const scope = async (_req: any): Promise<DataScopeCode> => currentCrmDataScope()

  // ── 概览 ──

  route.get(
    '/members/overview',
    {
      access: { permission: PERMS.MEMBER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员概览统计',
        operationId: 'getCrmMemberOverview',
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.overview(uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 列表 ──

  route.get(
    '/members',
    {
      access: { permission: PERMS.MEMBER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员顾客列表',
        operationId: 'listCrmMembers',
        querystring: CrmMemberListQuerySchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.list(req.query, uid(req), await scope(req))
      return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
    },
  )

  // ── 详情 ──

  route.get(
    '/members/:id',
    {
      access: { permission: PERMS.MEMBER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员详情',
        operationId: 'getCrmMember',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const data = await MembersService.getById(id(req), uid(req), await scope(req), true)
      if (!data) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '会员不存在或无权访问')
      return ResponseUtil.success(reply, data)
    },
  )

  // ── 轻量详情（用于快速查看） ──

  route.get(
    '/members/:id/brief',
    {
      access: { permission: PERMS.MEMBER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员简要信息',
        operationId: 'getCrmMemberBrief',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const data = await MembersService.getBrief(id(req), uid(req), await scope(req))
      if (!data) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '会员不存在或无权访问')
      return ResponseUtil.success(reply, data)
    },
  )

  // ── 从客户转会员 ──

  route.post(
    '/members/from-customer',
    {
      access: { permission: PERMS.MEMBER_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '从客户转会员',
        operationId: 'createCrmMemberFromCustomer',
        body: CrmMemberFromCustomerReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.createFromCustomer(req.body, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 直接新增会员 ──

  route.post(
    '/members/direct',
    {
      access: { permission: PERMS.MEMBER_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '直接新增会员',
        operationId: 'createCrmMemberDirect',
        body: CrmMemberDirectReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.createDirect(req.body, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 更新会员 ──

  route.patch(
    '/members/:id',
    {
      access: { permission: PERMS.MEMBER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新会员',
        operationId: 'updateCrmMember',
        params: CrmIdParamsSchema,
        body: CrmMemberUpdateReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.update(id(req), req.body, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 添加跟进 ──

  route.post(
    '/members/:id/follow-ups',
    {
      access: { permission: PERMS.MEMBER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '添加跟进记录',
        operationId: 'createCrmMemberFollowUp',
        params: CrmIdParamsSchema,
        body: CrmMemberFollowUpReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.addFollowUp(id(req), req.body, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 跟进记录列表 ──

  route.get(
    '/members/:id/follow-ups',
    {
      access: { permission: PERMS.MEMBER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '跟进记录列表',
        operationId: 'listCrmMemberFollowUps',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.listFollowUps(id(req), uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 创建派单 ──

  route.post(
    '/members/:id/dispatches',
    {
      access: { permission: PERMS.CUSTOMER_DISPATCH },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员创建派单',
        operationId: 'createCrmMemberDispatch',
        params: CrmIdParamsSchema,
        body: CrmMemberDispatchReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const member = await MembersService.getById(id(req), uid(req), await scope(req))
      if (!member) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '会员不存在或无权访问')
      if (!member.customerId) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '该会员无关联客户，无法创建派单')

      // Reuse existing customer dispatch flow
      const { CustomersService } = await import('../../../services/customers.service.js')
      const result = await CustomersService.dispatch(
        member.customerId,
        {
          hospitalIds: [req.body.hospitalId],
          statusId: req.body.statusId,
          reply: req.body.content,
        },
        uid(req),
        await scope(req),
      )

      // Update member stage to dispatched
      await MembersService.update(id(req), { memberStage: 'dispatched' }, uid(req), await scope(req))

      return ResponseUtil.success(reply, result)
    },
  )

  // ── 备注 ──

  const CrmMemberRemarkBodySchema = Type.Object({
    content: Type.String({ minLength: 1, maxLength: 2000 }),
  }, { $id: 'crmMemberRemarkBody' })

  route.post(
    '/members/:id/remarks',
    {
      access: { permission: PERMS.MEMBER_REMARK },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员备注',
        operationId: 'createCrmMemberRemark',
        params: CrmIdParamsSchema,
        body: CrmMemberRemarkBodySchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.addFollowUp(id(req), {
        content: req.body.content,
        followUpMethod: 'other',
        result: 'contacted',
      }, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 批量分配 ──

  route.post(
    '/members/batch-assign',
    {
      access: { permission: PERMS.MEMBER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '批量分配客服',
        operationId: 'batchAssignCrmMembers',
        body: CrmMemberBatchAssignReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.batchAssign(
        req.body.memberIds,
        req.body.toUserId,
        req.body.reason,
        uid(req),
        await scope(req),
      )
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 批量打标签 ──

  route.post(
    '/members/batch-tags',
    {
      access: { permission: PERMS.MEMBER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '批量打标签',
        operationId: 'batchTagCrmMembers',
        body: CrmMemberBatchTagReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.batchAddTags(
        req.body.memberIds,
        { tagIds: req.body.tagIds, tagNames: req.body.tagNames, tagsText: req.body.tagsText },
        uid(req),
        await scope(req),
      )
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 批量作废 ──

  route.post(
    '/members/batch-invalidate',
    {
      access: { permission: PERMS.MEMBER_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '批量作废会员',
        operationId: 'batchInvalidateCrmMembers',
        body: CrmMemberBatchInvalidateReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.batchInvalidate(req.body.memberIds, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 单条作废 ──

  route.post(
    '/members/:id/invalidate',
    {
      access: { permission: PERMS.MEMBER_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '作废会员',
        operationId: 'invalidateCrmMember',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.invalidate(id(req), uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 恢复会员 ──

  route.post(
    '/members/:id/restore',
    {
      access: { permission: PERMS.MEMBER_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '恢复会员',
        operationId: 'restoreCrmMember',
        params: CrmIdParamsSchema,
        body: CrmMemberRestoreReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.restore(id(req), req.body, uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 标签列表 ──

  route.get(
    '/member-tags',
    {
      access: { permission: PERMS.MEMBER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员标签列表',
        operationId: 'listCrmMemberTags',
      },
    },
    async (_req: any, reply: any) => {
      const result = await MembersService.listTags()
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 创建标签 ──

  route.post(
    '/member-tags',
    {
      access: { permission: PERMS.MEMBER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '创建会员标签',
        operationId: 'createCrmMemberTag',
        body: CrmMemberTagReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.createTag(req.body, uid(req))
      return ResponseUtil.success(reply, result)
    },
  )

  // ── 删除标签 ──

  route.delete(
    '/member-tags/:id',
    {
      access: { permission: PERMS.MEMBER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除会员标签',
        operationId: 'deleteCrmMemberTag',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      await MembersService.deleteTag(id(req))
      return ResponseUtil.success(reply, { ok: true })
    },
  )

  // ── 可选择客户列表 ──

  route.get(
    '/customers/selectable',
    {
      access: { permission: PERMS.MEMBER_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '可转会员的客户列表',
        operationId: 'listCrmCustomersSelectable',
        querystring: CrmCustomerSelectableQuerySchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.listSelectableCustomers(req.query, uid(req), await scope(req))
      return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
    },
  )

  // ── 软删除（保留向后兼容） ──

  route.delete(
    '/members/:id',
    {
      access: { permission: PERMS.MEMBER_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除会员',
        operationId: 'deleteCrmMember',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await MembersService.invalidate(id(req), uid(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )
}

export default members
