import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { IdParamsSchema, OkRespSchema } from '../../../schemas/common.schema.js'
import { OrdersService } from '../../../services/orders.service.js'
import {
  OrderCreateReqSchema,
  OrderItemRespSchema,
  OrderListQuerySchema,
  OrderListRespSchema,
  OrderRespSchema,
  OrderUpdateReqSchema,
} from '../../../schemas/orders.schema.js'

/**
 * shop 订单资源（含 items 子资源）。
 *
 * 目录即 URL：autoload 推导为 `/api/shop/v1/orders`，本文件只负责该资源。
 * 子资源 items 归属本文件。
 */
const ROUTE_TAG = 'shop'

export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  ORDER_LIST: { code: 'shop:order:list', label: '商城-订单-查看', group: 'shop' },
  ORDER_CREATE: { code: 'shop:order:create', label: '商城-订单-新建', group: 'shop' },
  ORDER_UPDATE: { code: 'shop:order:update', label: '商城-订单-编辑', group: 'shop' },
  ORDER_DELETE: { code: 'shop:order:delete', label: '商城-订单-删除', group: 'shop' },
})
registerPermissions(...Object.values(PERMS))

const orders: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const service = new OrdersService(app.drizzleDb)

  route.get(
    '/',
    {
      access: { permission: PERMS.ORDER_LIST },
      schema: { tags: [ROUTE_TAG], summary: '订单列表', querystring: OrderListQuerySchema, response: { 200: OrderListRespSchema } },
    },
    async (req: any) => service.list(req.query),
  )

  route.get(
    '/:id',
    {
      access: { permission: PERMS.ORDER_LIST },
      schema: { tags: [ROUTE_TAG], summary: '订单详情', params: IdParamsSchema, response: { 200: OrderRespSchema } },
    },
    async (req: any) => service.findById(req.params.id),
  )

  route.get(
    '/:id/items',
    {
      access: { permission: PERMS.ORDER_LIST },
      schema: { tags: [ROUTE_TAG], summary: '订单明细', params: IdParamsSchema, response: { 200: Type.Array(OrderItemRespSchema) } },
    },
    async (req: any) => service.listItems(req.params.id),
  )

  route.post(
    '/',
    {
      access: { permission: PERMS.ORDER_CREATE },
      schema: { tags: [ROUTE_TAG], summary: '创建订单', body: OrderCreateReqSchema, response: { 200: OrderRespSchema } },
    },
    async (req: any, reply: any) => {
      const userId = req.currentUser?.id ?? 1
      const created = await service.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '订单创建成功')
    },
  )

  route.patch(
    '/:id',
    {
      access: { permission: PERMS.ORDER_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '更新订单', params: IdParamsSchema, body: OrderUpdateReqSchema, response: { 200: OrderRespSchema } },
    },
    async (req: any, reply: any) => {
      const updated = await service.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '订单更新成功')
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.ORDER_DELETE },
      schema: { tags: [ROUTE_TAG], summary: '删除订单', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.remove(req.params.id)
      return ResponseUtil.success(reply, null, '订单删除成功')
    },
  )
}

export default orders
