import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { IdParamsSchema, OkRespSchema } from '../../../schemas/common.schema.js'
import { ProductsService } from '../../../services/products.service.js'
import {
  ProductCreateReqSchema,
  ProductListQuerySchema,
  ProductListRespSchema,
  ProductRespSchema,
  ProductUpdateReqSchema,
  SkuCreateReqSchema,
  SkuRespSchema,
  SkuUpdateReqSchema,
} from '../../../schemas/products.schema.js'

/**
 * shop 商品资源（含 SKUs 子资源）。
 *
 * 目录即 URL：autoload 推导为 `/api/shop/v1/products`，本文件只负责该资源。
 * 子资源 SKUs 同样归属本文件。注意 SKU 详情/更新/删除走 `/skus/:id`（与 products
 * 平级 URL 段），与列表/创建 `/products/:id/skus` 不对称 —— 由原路由约定保留。
 */
const ROUTE_TAG = 'shop'

export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  PRODUCT_LIST: { code: 'shop:product:list', label: '商城-商品-查看', group: 'shop' },
  PRODUCT_CREATE: { code: 'shop:product:create', label: '商城-商品-新建', group: 'shop' },
  PRODUCT_UPDATE: { code: 'shop:product:update', label: '商城-商品-编辑', group: 'shop' },
  PRODUCT_DELETE: { code: 'shop:product:delete', label: '商城-商品-删除', group: 'shop' },
  SKU_LIST: { code: 'shop:sku:list', label: '商城-SKU-查看', group: 'shop' },
  SKU_CREATE: { code: 'shop:sku:create', label: '商城-SKU-新建', group: 'shop' },
  SKU_UPDATE: { code: 'shop:sku:update', label: '商城-SKU-编辑', group: 'shop' },
  SKU_DELETE: { code: 'shop:sku:delete', label: '商城-SKU-删除', group: 'shop' },
})
registerPermissions(...Object.values(PERMS))

const products: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const service = new ProductsService(app.drizzleDb)

  route.get(
    '/',
    {
      access: { permission: PERMS.PRODUCT_LIST },
      schema: { tags: [ROUTE_TAG], summary: '商品列表', querystring: ProductListQuerySchema, response: { 200: ProductListRespSchema } },
    },
    async (req: any) => service.list(req.query),
  )

  route.get(
    '/:id',
    {
      access: { permission: PERMS.PRODUCT_LIST },
      schema: { tags: [ROUTE_TAG], summary: '商品详情', params: IdParamsSchema, response: { 200: ProductRespSchema } },
    },
    async (req: any) => service.findById(req.params.id),
  )

  route.post(
    '/',
    {
      access: { permission: PERMS.PRODUCT_CREATE },
      schema: { tags: [ROUTE_TAG], summary: '新建商品', body: ProductCreateReqSchema, response: { 200: ProductRespSchema } },
    },
    async (req: any, reply: any) => {
      const userId = req.currentUser?.id ?? 1
      const created = await service.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '商品创建成功')
    },
  )

  route.patch(
    '/:id',
    {
      access: { permission: PERMS.PRODUCT_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '更新商品', params: IdParamsSchema, body: ProductUpdateReqSchema, response: { 200: ProductRespSchema } },
    },
    async (req: any, reply: any) => {
      const updated = await service.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '商品更新成功')
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.PRODUCT_DELETE },
      schema: { tags: [ROUTE_TAG], summary: '删除商品', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.remove(req.params.id)
      return ResponseUtil.success(reply, null, '商品删除成功')
    },
  )

  // ── SKUs 子资源 ──

  route.get(
    '/:id/skus',
    {
      access: { permission: PERMS.SKU_LIST },
      schema: { tags: [ROUTE_TAG], summary: 'SKU 列表', params: IdParamsSchema, response: { 200: Type.Array(SkuRespSchema) } },
    },
    async (req: any) => service.listSkus(req.params.id),
  )

  route.post(
    '/:id/skus',
    {
      access: { permission: PERMS.SKU_CREATE },
      schema: { tags: [ROUTE_TAG], summary: '新增 SKU', params: IdParamsSchema, body: SkuCreateReqSchema, response: { 200: SkuRespSchema } },
    },
    async (req: any, reply: any) => {
      const userId = req.currentUser?.id ?? 1
      const created = await service.createSku({ productId: req.params.id, ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, 'SKU 创建成功')
    },
  )

  route.patch(
    '/skus/:id',
    {
      access: { permission: PERMS.SKU_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '更新 SKU', params: IdParamsSchema, body: SkuUpdateReqSchema, response: { 200: SkuRespSchema } },
    },
    async (req: any, reply: any) => {
      const updated = await service.updateSku(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, 'SKU 更新成功')
    },
  )

  route.delete(
    '/skus/:id',
    {
      access: { permission: PERMS.SKU_DELETE },
      schema: { tags: [ROUTE_TAG], summary: '删除 SKU', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.removeSku(req.params.id)
      return ResponseUtil.success(reply, null, 'SKU 删除成功')
    },
  )
}

export default products
