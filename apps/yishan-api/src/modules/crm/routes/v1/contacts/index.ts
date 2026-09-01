import { type FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { ContactService } from '../../../services/contact.service.js'
import {
  ContactCreateReqSchema,
  ContactListQuerySchema,
  ContactRespSchema,
  ContactUpdateReqSchema,
} from '../../../schemas/contact.schema.js'
import {
  ROUTE_TAG,
  EnvelopeSchema,
  PaginatedEnvelopeSchema,
  OkEnvelopeSchema,
} from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

/**
 * CRM 联系人资源（独立列表）。
 *
 * 客户详情下的"联系人 Tab"走 `customers/:customerId/contacts`，见 customers 子路由。
 */

const ContactIdParamsSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
})

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const service = new ContactService()

  // 列表（可按客户过滤）
  route.get(
    '/',
    {
      access: { permission: PERMS.CONTACT_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '联系人列表',
        operationId: 'crmContactsList',
        querystring: ContactListQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(ContactRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.list(request.query, request.currentUser)
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )

  // 客户详情 Tab 用的列某客户联系人 / 新建联系人 路由已迁移到 customers/index.ts
  // （autoload 每个 plugin 是独立子上下文，相对路径是 plugin 根 → 不能跨目录 /customers/...）。

  // 详情
  route.get(
    '/:id',
    {
      access: { permission: PERMS.CONTACT_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '联系人详情',
        operationId: 'crmContactsDetail',
        params: ContactIdParamsSchema,
        response: { 200: EnvelopeSchema(ContactRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const row = await service.findById(Number(request.params.id), request.currentUser)
      return ResponseUtil.success(reply, row)
    },
  )

  // 新建
  route.post(
    '/',
    {
      access: { permission: PERMS.CONTACT_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建联系人',
        operationId: 'crmContactsCreate',
        body: ContactCreateReqSchema,
        response: { 200: EnvelopeSchema(ContactRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const created = await service.create(request.body, request.currentUser)
      return ResponseUtil.success(reply, created, '联系人创建成功')
    },
  )

  // 更新
  route.patch(
    '/:id',
    {
      access: { permission: PERMS.CONTACT_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新联系人',
        operationId: 'crmContactsUpdate',
        params: ContactIdParamsSchema,
        body: ContactUpdateReqSchema,
        response: { 200: EnvelopeSchema(ContactRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await service.update(
        Number(request.params.id),
        request.body,
        request.currentUser,
      )
      return ResponseUtil.success(reply, updated, '联系人更新成功')
    },
  )

  // 删除
  route.delete(
    '/:id',
    {
      access: { permission: PERMS.CONTACT_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除联系人',
        operationId: 'crmContactsDelete',
        params: ContactIdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await service.remove(Number(request.params.id), request.currentUser)
      return ResponseUtil.success(reply, null, '联系人删除成功')
    },
  )
}) as FastifyPluginAsync
