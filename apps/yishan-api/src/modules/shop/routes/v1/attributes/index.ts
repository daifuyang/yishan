import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { IdParamsSchema, OkRespSchema } from '../../../schemas/common.schema.js'
import { AttributesService } from '../../../services/attributes.service.js'
import {
  AttributeCreateReqSchema,
  AttributeListQuerySchema,
  AttributeListRespSchema,
  AttributeRespSchema,
  AttributeUpdateReqSchema,
  AttributeValueCreateReqSchema,
  AttributeValueRespSchema,
} from '../../../schemas/attributes.schema.js'

/**
 * shop 属性资源（含 values 子资源）。
 *
 * 目录即 URL：autoload 推导为 `/api/shop/v1/attributes`，本文件只负责该资源。
 * 子资源 values 同样归属本文件，因为 URL 段已包含在 attributes 之下。
 */
const ROUTE_TAG = 'shop'

export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  ATTRIBUTE_LIST: { code: 'shop:attribute:list', label: '商城-属性-查看', group: 'shop' },
  ATTRIBUTE_CREATE: { code: 'shop:attribute:create', label: '商城-属性-新建', group: 'shop' },
  ATTRIBUTE_UPDATE: { code: 'shop:attribute:update', label: '商城-属性-编辑', group: 'shop' },
  ATTRIBUTE_DELETE: { code: 'shop:attribute:delete', label: '商城-属性-删除', group: 'shop' },
})
registerPermissions(...Object.values(PERMS))

const attributes: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const service = new AttributesService(app.drizzleDb)

  route.get(
    '/',
    {
      access: { permission: PERMS.ATTRIBUTE_LIST },
      schema: { tags: [ROUTE_TAG], summary: '属性列表', querystring: AttributeListQuerySchema, response: { 200: AttributeListRespSchema } },
    },
    async (req: any) => service.list(req.query),
  )

  route.get(
    '/:id',
    {
      access: { permission: PERMS.ATTRIBUTE_LIST },
      schema: { tags: [ROUTE_TAG], summary: '属性详情', params: IdParamsSchema, response: { 200: AttributeRespSchema } },
    },
    async (req: any) => service.findById(req.params.id),
  )

  route.post(
    '/',
    {
      access: { permission: PERMS.ATTRIBUTE_CREATE },
      schema: { tags: [ROUTE_TAG], summary: '新建属性', body: AttributeCreateReqSchema, response: { 200: AttributeRespSchema } },
    },
    async (req: any, reply: any) => {
      const userId = req.currentUser?.id ?? 1
      const created = await service.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '属性创建成功')
    },
  )

  route.patch(
    '/:id',
    {
      access: { permission: PERMS.ATTRIBUTE_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '更新属性', params: IdParamsSchema, body: AttributeUpdateReqSchema, response: { 200: AttributeRespSchema } },
    },
    async (req: any, reply: any) => {
      const updated = await service.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '属性更新成功')
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.ATTRIBUTE_DELETE },
      schema: { tags: [ROUTE_TAG], summary: '删除属性', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.remove(req.params.id)
      return ResponseUtil.success(reply, null, '属性删除成功')
    },
  )

  // ── values 子资源 ──

  route.get(
    '/:id/values',
    {
      access: { permission: PERMS.ATTRIBUTE_LIST },
      schema: { tags: [ROUTE_TAG], summary: '属性值列表', params: IdParamsSchema, response: { 200: Type.Array(AttributeValueRespSchema) } },
    },
    async (req: any) => service.listValues(req.params.id),
  )

  route.post(
    '/:id/values',
    {
      access: { permission: PERMS.ATTRIBUTE_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '新增属性值', params: IdParamsSchema, body: AttributeValueCreateReqSchema, response: { 200: AttributeValueRespSchema } },
    },
    async (req: any, reply: any) => {
      const userId = req.currentUser?.id ?? 1
      const created = await service.createValue({
        attributeId: req.params.id, ...req.body, creatorId: userId, updaterId: userId,
      })
      return ResponseUtil.success(reply, created, '属性值创建成功')
    },
  )

  route.delete(
    '/:id/values',
    {
      access: { permission: PERMS.ATTRIBUTE_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '清空属性值', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.deleteValues(req.params.id)
      return ResponseUtil.success(reply, null, '属性值已清空')
    },
  )
}

export default attributes
