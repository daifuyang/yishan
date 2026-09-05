import { type FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { CustomerService } from '../../../services/customer.service.js'
import { ActivityService } from '../../../services/activity.service.js'
import { ContactService } from '../../../services/contact.service.js'
import { CustomerFlowService } from '../../../actions/customer-flow.js'
import { TransferRepository } from '../../../repositories/transfer.repository.js'
import {
  CustomerCreateReqSchema,
  CustomerCreateRespSchema,
  CustomerDetailRespSchema,
  CustomerListQuerySchema,
  CustomerMemberAddReqSchema,
  CustomerMemberListRespSchema,
  CustomerReleaseReqSchema,
  CustomerRespSchema,
  CustomerListItemRespSchema,
  CustomerTransferReqSchema,
  CustomerUpdateReqSchema,
} from '../../../schemas/customer.schema.js'
import {
  ActivityCreateReqSchema,
  ActivityListRespSchema,
  ActivityRespSchema,
} from '../../../schemas/activity.schema.js'
import {
  ContactCreateReqSchema,
  ContactRespSchema,
} from '../../../schemas/contact.schema.js'
import { CrmCustomerIdParamsSchema } from '../../../schemas/common.schema.js'
import { ROUTE_TAG, EnvelopeSchema, PaginatedEnvelopeSchema, OkEnvelopeSchema } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

/**
 * CRM 客户资源（含 claim/release/transfer action；客户下的联系人 / 跟进）。
 *
 * 目录即 URL：autoload 推导为 `/api/crm/v1/customers`，本文件只负责该资源。
 */

const CustomerIdParamsSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
})

const TransferLogRespSchema = Type.Object({
  id: Type.Number(),
  customerId: Type.Number(),
  type: Type.String(),
  fromUserId: Type.Union([Type.Number(), Type.Null()]),
  toUserId: Type.Union([Type.Number(), Type.Null()]),
  operatorUserId: Type.Number(),
  reason: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  fromUserName: Type.Union([Type.String(), Type.Null()]),
  toUserName: Type.Union([Type.String(), Type.Null()]),
  operatorUserName: Type.Union([Type.String(), Type.Null()]),
})

const MemberUserIdParamsSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
  userId: Type.Integer({ minimum: 1 }),
})

/** 无效日期不静默变成 Invalid Date（它会让 SQL 比较全部失真），直接当没传。 */
function toDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/**
 * querystring（全是字符串 / 字符串数组）→ service 的 CustomerListQuery。
 * 这是协议层的活，所以留在 route 里；service 只接受已经规整好的类型。
 */
function normalizeListQuery(q: Record<string, unknown>) {
  return {
    ...q,
    tagIds: Array.isArray(q.tagIds)
      ? (q.tagIds as unknown[]).map(Number).filter((n) => Number.isInteger(n))
      : undefined,
    createdFrom: toDate(q.createdFrom),
    createdTo: toDate(q.createdTo),
    lastFollowUpFrom: toDate(q.lastFollowUpFrom),
    lastFollowUpTo: toDate(q.lastFollowUpTo),
    nextFollowUpFrom: toDate(q.nextFollowUpFrom),
    nextFollowUpTo: toDate(q.nextFollowUpTo),
  }
}

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new CustomerService()
  const flow = new CustomerFlowService()
  const activityService = new ActivityService()
  const contactService = new ContactService()

  route.get('/options', {
    access: { permission: PERMS.CUSTOMER_LIST },
    schema: {
      tags: [ROUTE_TAG],
      summary: '私域客户列表筛选能力及可见负责人',
      operationId: 'crmCustomersOptions',
      response: { 200: EnvelopeSchema(Type.Object({
        canFilterOwners: Type.Boolean(),
        owners: Type.Array(Type.Object({ id: Type.Number(), name: Type.String() })),
      })) },
    },
  }, async (request, reply) => ResponseUtil.success(reply, await service.listOptions(request.currentUser)))

  // 列表
  route.get(
    '/',
    {
      access: { permission: PERMS.CUSTOMER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户列表',
        operationId: 'crmCustomersList',
        querystring: CustomerListQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(CustomerListItemRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.list({
        query: normalizeListQuery(request.query) as any,
        currentUser: request.currentUser,
      })
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )

  // 回收站列表。注册在 `/:id` 之前，且 `/trash` 是静态段，radix 路由优先匹配静态段，
  // 不会被 `/:id` 抢走。
  route.get(
    '/trash',
    {
      access: { permission: PERMS.CUSTOMER_TRASH },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户回收站列表',
        operationId: 'crmCustomersTrashList',
        querystring: CustomerListQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(CustomerListItemRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.listTrash({
        query: normalizeListQuery(request.query) as any,
        currentUser: request.currentUser,
      })
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )

  // 详情
  route.get(
    '/:id',
    {
      access: { permission: PERMS.CUSTOMER_DETAIL },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户详情',
        operationId: 'crmCustomersDetail',
        params: CustomerIdParamsSchema,
        response: { 200: EnvelopeSchema(CustomerDetailRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const row = await service.detail(Number(request.params.id), request.currentUser)
      return ResponseUtil.success(reply, row)
    },
  )

  // 新建
  route.post(
    '/',
    {
      access: { permission: PERMS.CUSTOMER_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建客户',
        operationId: 'crmCustomersCreate',
        body: CustomerCreateReqSchema,
        response: { 200: EnvelopeSchema(CustomerCreateRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.create({
        input: request.body,
        currentUser: request.currentUser,
      })
      return ResponseUtil.success(reply, result, '客户创建成功')
    },
  )

  // 更新
  route.patch(
    '/:id',
    {
      access: { permission: PERMS.CUSTOMER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新客户',
        operationId: 'crmCustomersUpdate',
        params: CustomerIdParamsSchema,
        body: CustomerUpdateReqSchema,
        response: { 200: EnvelopeSchema(CustomerRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await service.update({
        id: Number(request.params.id),
        input: request.body,
        currentUser: request.currentUser,
      })
      return ResponseUtil.success(reply, updated, '客户更新成功')
    },
  )

  // 删除
  route.delete(
    '/:id',
    {
      access: { permission: PERMS.CUSTOMER_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除客户',
        operationId: 'crmCustomersDelete',
        params: CustomerIdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await service.remove(Number(request.params.id), request.currentUser)
      return ResponseUtil.success(reply, null, '客户删除成功')
    },
  )

  // ─── Action：认领 ───
  route.post(
    '/:id/claim',
    {
      access: { permission: PERMS.CUSTOMER_CLAIM },
      schema: {
        tags: [ROUTE_TAG],
        summary: '认领公海客户',
        operationId: 'crmCustomersClaim',
        params: CustomerIdParamsSchema,
        response: { 200: EnvelopeSchema(CustomerRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await flow.claim({
        customerId: Number(request.params.id),
        currentUser: {
          ...request.currentUser,
          deptId: (request.currentUser.deptIds ?? [])[0] ?? null,
        },
      })
      return ResponseUtil.success(reply, updated, '客户认领成功')
    },
  )

  // ─── Action：释放 ───
  route.post(
    '/:id/release',
    {
      access: { permission: PERMS.CUSTOMER_RELEASE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '释放客户到公海',
        operationId: 'crmCustomersRelease',
        params: CustomerIdParamsSchema,
        body: CustomerReleaseReqSchema,
        response: { 200: EnvelopeSchema(CustomerRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await flow.release({
        customerId: Number(request.params.id),
        reason: request.body?.reason ?? null,
        currentUser: request.currentUser,
      })
      return ResponseUtil.success(reply, updated, '客户已释放到公海')
    },
  )

  // 客户流转日志（详情页 Tab 用）
  route.get(
    '/:id/transfers',
    {
      access: { permission: PERMS.CUSTOMER_DETAIL },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户流转日志',
        operationId: 'crmCustomersTransfers',
        params: CustomerIdParamsSchema,
        response: { 200: EnvelopeSchema(Type.Array(TransferLogRespSchema)) },
      },
    },
    async (request: any, reply: any) => {
      const items = await TransferRepository.listByCustomerId(Number(request.params.id))
      return ResponseUtil.success(reply, items)
    },
  )

  // ─── Action：转交 ───
  route.post(
    '/:id/transfer',
    {
      access: { permission: PERMS.CUSTOMER_TRANSFER },
      schema: {
        tags: [ROUTE_TAG],
        summary: '转交客户',
        operationId: 'crmCustomersTransfer',
        params: CustomerIdParamsSchema,
        body: CustomerTransferReqSchema,
        response: { 200: EnvelopeSchema(CustomerRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await flow.transfer({
        customerId: Number(request.params.id),
        targetUserId: Number(request.body.targetUserId),
        reason: request.body?.reason ?? null,
        currentUser: request.currentUser,
      })
      return ResponseUtil.success(reply, updated, '客户转交成功')
    },
  )

  // ─── 回收站 Action：恢复 / 永久删除 ───────────────────────
  route.post(
    '/:id/restore',
    {
      access: { permission: PERMS.CUSTOMER_RESTORE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '从回收站恢复客户',
        operationId: 'crmCustomersRestore',
        params: CustomerIdParamsSchema,
        response: { 200: EnvelopeSchema(CustomerRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const restored = await service.restore(Number(request.params.id), request.currentUser)
      return ResponseUtil.success(reply, restored, '客户已恢复')
    },
  )

  route.delete(
    '/:id/purge',
    {
      access: { permission: PERMS.CUSTOMER_PURGE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '永久删除客户（仅回收站内）',
        operationId: 'crmCustomersPurge',
        params: CustomerIdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await service.purge(Number(request.params.id), request.currentUser)
      return ResponseUtil.success(reply, null, '客户已永久删除')
    },
  )

  // ─── 协同人 ─────────────────────────────────────────────
  route.get(
    '/:id/members',
    {
      access: { permission: PERMS.CUSTOMER_DETAIL },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户协同人列表',
        operationId: 'crmCustomerMembersList',
        params: CustomerIdParamsSchema,
        response: { 200: EnvelopeSchema(CustomerMemberListRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const items = await service.listMembers(Number(request.params.id), request.currentUser)
      return ResponseUtil.success(reply, { items })
    },
  )

  route.post(
    '/:id/members',
    {
      access: { permission: PERMS.CUSTOMER_MEMBER_MANAGE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '添加客户协同人',
        operationId: 'crmCustomerMembersAdd',
        params: CustomerIdParamsSchema,
        body: CustomerMemberAddReqSchema,
        response: { 200: EnvelopeSchema(CustomerMemberListRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const items = await service.addMember(
        Number(request.params.id),
        Number(request.body.userId),
        request.currentUser,
      )
      return ResponseUtil.success(reply, { items }, '协同人已添加')
    },
  )

  route.delete(
    '/:id/members/:userId',
    {
      access: { permission: PERMS.CUSTOMER_MEMBER_MANAGE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '移除客户协同人',
        operationId: 'crmCustomerMembersRemove',
        params: MemberUserIdParamsSchema,
        response: { 200: EnvelopeSchema(CustomerMemberListRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const items = await service.removeMember(
        Number(request.params.id),
        Number(request.params.userId),
        request.currentUser,
      )
      return ResponseUtil.success(reply, { items }, '协同人已移除')
    },
  )

  // ─── 客户跟进（嵌套在 customer 下） ─────────────────────────
  // 列表
  route.get(
    '/:customerId/activities',
    {
      access: { permission: PERMS.ACTIVITY_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户跟进记录',
        operationId: 'crmCustomerActivitiesList',
        params: CrmCustomerIdParamsSchema,
        response: { 200: EnvelopeSchema(ActivityListRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await activityService.listByCustomerId(
        Number(request.params.customerId),
        request.currentUser,
      )
      return ResponseUtil.success(reply, result)
    },
  )

  // 新建
  route.post(
    '/:customerId/activities',
    {
      access: { permission: PERMS.ACTIVITY_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建跟进记录',
        operationId: 'crmCustomerActivitiesCreate',
        params: CrmCustomerIdParamsSchema,
        body: ActivityCreateReqSchema,
        response: { 200: EnvelopeSchema(ActivityRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const created = await activityService.create(
        Number(request.params.customerId),
        request.body,
        request.currentUser,
      )
      return ResponseUtil.success(reply, created, '跟进记录已创建')
    },
  )

  // ─── 客户联系人（嵌套在 customer 下） ─────────────────────────
  // 列表
  route.get(
    '/:customerId/contacts',
    {
      access: { permission: PERMS.CONTACT_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户下的联系人',
        operationId: 'crmCustomerContactsList',
        params: CrmCustomerIdParamsSchema,
        response: { 200: EnvelopeSchema(Type.Array(ContactRespSchema)) },
      },
    },
    async (request: any, reply: any) => {
      const items = await contactService.listByCustomerId(
        Number(request.params.customerId),
        request.currentUser,
      )
      return ResponseUtil.success(reply, items)
    },
  )

  // 新建
  route.post(
    '/:customerId/contacts',
    {
      access: { permission: PERMS.CONTACT_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户下新建联系人',
        operationId: 'crmCustomerContactsCreate',
        params: CrmCustomerIdParamsSchema,
        body: Type.Omit(ContactCreateReqSchema, ['customerId']),
        response: { 200: EnvelopeSchema(ContactRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const created = await contactService.create(
        { ...request.body, customerId: Number(request.params.customerId) },
        request.currentUser,
      )
      return ResponseUtil.success(reply, created, '联系人创建成功')
    },
  )
}) as FastifyPluginAsync
