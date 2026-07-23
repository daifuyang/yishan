import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar, type ManagedRouteOptions } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { IdParamsSchema } from '../../schemas/common.schema.js'
import { PERMS } from '../../permissions.js'
import { AttributesService } from '../../services/attributes.service.js'
import { CategoriesService } from '../../services/categories.service.js'
import { OrdersService } from '../../services/orders.service.js'
import { ProductsService } from '../../services/products.service.js'

import { AttributeCreateReqSchema, AttributeListQuerySchema, AttributeListRespSchema, AttributeRespSchema, AttributeUpdateReqSchema, AttributeValueCreateReqSchema, AttributeValueRespSchema } from '../../schemas/attributes.schema.js'
import { CategoryCreateReqSchema, CategoryListQuerySchema, CategoryListRespSchema, CategoryRespSchema, CategoryUpdateReqSchema } from '../../schemas/categories.schema.js'
import { OrderCreateReqSchema, OrderItemRespSchema, OrderListQuerySchema, OrderListRespSchema, OrderRespSchema, OrderUpdateReqSchema } from '../../schemas/orders.schema.js'
import { ProductCreateReqSchema, ProductListQuerySchema, ProductListRespSchema, ProductRespSchema, ProductUpdateReqSchema, SkuCreateReqSchema, SkuRespSchema, SkuUpdateReqSchema } from '../../schemas/products.schema.js'

/**
 * shop 模块 v1 路由。
 *
 * 5 实体 × 标准 CRUD + attribute values 子资源 + product skus 子资源。
 * 路由 prefix 由 ModuleLoader 推导为 `/api/shop/v1`。
 */

const ROUTE_TAG = 'shop'

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

interface RouteDecl {
  method: HttpMethod
  url: string
  perm: typeof PERMS[keyof typeof PERMS]
  schema: ManagedRouteOptions['schema']
  handler: (services: Services, request: any, reply: any) => Promise<unknown>
}

interface Services {
  categories: CategoriesService
  attributes: AttributesService
  products: ProductsService
  orders: OrdersService
}

function getServices(app: any): Services {
  return {
    categories: new CategoriesService(app.drizzleDb),
    attributes: new AttributesService(app.drizzleDb),
    products: new ProductsService(app.drizzleDb),
    orders: new OrdersService(app.drizzleDb),
  }
}

function ok() {
  return { type: 'object', properties: { success: { type: 'boolean' } } }
}

// ───────── Categories ─────────
const categoryRoutes: RouteDecl[] = [
  { method: 'get', url: '/categories', perm: PERMS.CATEGORY_LIST,
    schema: { tags: [ROUTE_TAG], summary: '分类列表', querystring: CategoryListQuerySchema, response: { 200: CategoryListRespSchema } },
    handler: async (s, req) => s.categories.list(req.query) },
  { method: 'get', url: '/categories/:id', perm: PERMS.CATEGORY_LIST,
    schema: { tags: [ROUTE_TAG], summary: '分类详情', params: IdParamsSchema, response: { 200: CategoryRespSchema } },
    handler: async (s, req) => s.categories.findById(req.params.id) },
  { method: 'post', url: '/categories', perm: PERMS.CATEGORY_CREATE,
    schema: { tags: [ROUTE_TAG], summary: '新建分类', body: CategoryCreateReqSchema, response: { 200: CategoryRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.categories.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '分类创建成功')
    } },
  { method: 'patch', url: '/categories/:id', perm: PERMS.CATEGORY_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新分类', params: IdParamsSchema, body: CategoryUpdateReqSchema, response: { 200: CategoryRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.categories.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '分类更新成功')
    } },
  { method: 'delete', url: '/categories/:id', perm: PERMS.CATEGORY_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除分类', params: IdParamsSchema, response: { 200: ok() } },
    handler: async (s, req, reply) => {
      await s.categories.remove(req.params.id)
      return ResponseUtil.success(reply, null, '分类删除成功')
    } },
]

// ───────── Attributes + values ─────────
const attributeRoutes: RouteDecl[] = [
  { method: 'get', url: '/attributes', perm: PERMS.ATTRIBUTE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '属性列表', querystring: AttributeListQuerySchema, response: { 200: AttributeListRespSchema } },
    handler: async (s, req) => s.attributes.list(req.query) },
  { method: 'get', url: '/attributes/:id', perm: PERMS.ATTRIBUTE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '属性详情', params: IdParamsSchema, response: { 200: AttributeRespSchema } },
    handler: async (s, req) => s.attributes.findById(req.params.id) },
  { method: 'post', url: '/attributes', perm: PERMS.ATTRIBUTE_CREATE,
    schema: { tags: [ROUTE_TAG], summary: '新建属性', body: AttributeCreateReqSchema, response: { 200: AttributeRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.attributes.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '属性创建成功')
    } },
  { method: 'patch', url: '/attributes/:id', perm: PERMS.ATTRIBUTE_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新属性', params: IdParamsSchema, body: AttributeUpdateReqSchema, response: { 200: AttributeRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.attributes.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '属性更新成功')
    } },
  { method: 'delete', url: '/attributes/:id', perm: PERMS.ATTRIBUTE_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除属性', params: IdParamsSchema, response: { 200: ok() } },
    handler: async (s, req, reply) => {
      await s.attributes.remove(req.params.id)
      return ResponseUtil.success(reply, null, '属性删除成功')
    } },

  // values sub-resource
  { method: 'get', url: '/attributes/:id/values', perm: PERMS.ATTRIBUTE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '属性值列表', params: IdParamsSchema, response: { 200: Type.Array(AttributeValueRespSchema) } },
    handler: async (s, req) => s.attributes.listValues(req.params.id) },
  { method: 'post', url: '/attributes/:id/values', perm: PERMS.ATTRIBUTE_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '新增属性值', params: IdParamsSchema, body: AttributeValueCreateReqSchema, response: { 200: AttributeValueRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.attributes.createValue({
        attributeId: req.params.id, ...req.body, creatorId: userId, updaterId: userId,
      })
      return ResponseUtil.success(reply, created, '属性值创建成功')
    } },
  { method: 'delete', url: '/attributes/:id/values', perm: PERMS.ATTRIBUTE_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '清空属性值', params: IdParamsSchema, response: { 200: ok() } },
    handler: async (s, req, reply) => {
      await s.attributes.deleteValues(req.params.id)
      return ResponseUtil.success(reply, null, '属性值已清空')
    } },
]

// ───────── Products + SKUs ─────────
const productRoutes: RouteDecl[] = [
  { method: 'get', url: '/products', perm: PERMS.PRODUCT_LIST,
    schema: { tags: [ROUTE_TAG], summary: '商品列表', querystring: ProductListQuerySchema, response: { 200: ProductListRespSchema } },
    handler: async (s, req) => s.products.list(req.query) },
  { method: 'get', url: '/products/:id', perm: PERMS.PRODUCT_LIST,
    schema: { tags: [ROUTE_TAG], summary: '商品详情', params: IdParamsSchema, response: { 200: ProductRespSchema } },
    handler: async (s, req) => s.products.findById(req.params.id) },
  { method: 'post', url: '/products', perm: PERMS.PRODUCT_CREATE,
    schema: { tags: [ROUTE_TAG], summary: '新建商品', body: ProductCreateReqSchema, response: { 200: ProductRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.products.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '商品创建成功')
    } },
  { method: 'patch', url: '/products/:id', perm: PERMS.PRODUCT_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新商品', params: IdParamsSchema, body: ProductUpdateReqSchema, response: { 200: ProductRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.products.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '商品更新成功')
    } },
  { method: 'delete', url: '/products/:id', perm: PERMS.PRODUCT_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除商品', params: IdParamsSchema, response: { 200: ok() } },
    handler: async (s, req, reply) => {
      await s.products.remove(req.params.id)
      return ResponseUtil.success(reply, null, '商品删除成功')
    } },

  // skus sub-resource
  { method: 'get', url: '/products/:id/skus', perm: PERMS.SKU_LIST,
    schema: { tags: [ROUTE_TAG], summary: 'SKU 列表', params: IdParamsSchema, response: { 200: Type.Array(SkuRespSchema) } },
    handler: async (s, req) => s.products.listSkus(req.params.id) },
  { method: 'post', url: '/products/:id/skus', perm: PERMS.SKU_CREATE,
    schema: { tags: [ROUTE_TAG], summary: '新增 SKU', params: IdParamsSchema, body: SkuCreateReqSchema, response: { 200: SkuRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.products.createSku({ productId: req.params.id, ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, 'SKU 创建成功')
    } },
  { method: 'patch', url: '/skus/:id', perm: PERMS.SKU_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新 SKU', params: IdParamsSchema, body: SkuUpdateReqSchema, response: { 200: SkuRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.products.updateSku(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, 'SKU 更新成功')
    } },
  { method: 'delete', url: '/skus/:id', perm: PERMS.SKU_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除 SKU', params: IdParamsSchema, response: { 200: ok() } },
    handler: async (s, req, reply) => {
      await s.products.removeSku(req.params.id)
      return ResponseUtil.success(reply, null, 'SKU 删除成功')
    } },
]

// ───────── Orders ─────────
const orderRoutes: RouteDecl[] = [
  { method: 'get', url: '/orders', perm: PERMS.ORDER_LIST,
    schema: { tags: [ROUTE_TAG], summary: '订单列表', querystring: OrderListQuerySchema, response: { 200: OrderListRespSchema } },
    handler: async (s, req) => s.orders.list(req.query) },
  { method: 'get', url: '/orders/:id', perm: PERMS.ORDER_LIST,
    schema: { tags: [ROUTE_TAG], summary: '订单详情', params: IdParamsSchema, response: { 200: OrderRespSchema } },
    handler: async (s, req) => s.orders.findById(req.params.id) },
  { method: 'get', url: '/orders/:id/items', perm: PERMS.ORDER_LIST,
    schema: { tags: [ROUTE_TAG], summary: '订单明细', params: IdParamsSchema, response: { 200: Type.Array(OrderItemRespSchema) } },
    handler: async (s, req) => s.orders.listItems(req.params.id) },
  { method: 'post', url: '/orders', perm: PERMS.ORDER_CREATE,
    schema: { tags: [ROUTE_TAG], summary: '创建订单', body: OrderCreateReqSchema, response: { 200: OrderRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.orders.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '订单创建成功')
    } },
  { method: 'patch', url: '/orders/:id', perm: PERMS.ORDER_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新订单', params: IdParamsSchema, body: OrderUpdateReqSchema, response: { 200: OrderRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.orders.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '订单更新成功')
    } },
  { method: 'delete', url: '/orders/:id', perm: PERMS.ORDER_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除订单', params: IdParamsSchema, response: { 200: ok() } },
    handler: async (s, req, reply) => {
      await s.orders.remove(req.params.id)
      return ResponseUtil.success(reply, null, '订单删除成功')
    } },
]

const shop: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const services = getServices(app)
  const all = [...categoryRoutes, ...attributeRoutes, ...productRoutes, ...orderRoutes]
  for (const r of all) {
    route[r.method](r.url, { access: { permission: r.perm }, schema: r.schema as ManagedRouteOptions['schema'] }, async (request, reply) => {
      return r.handler(services, request, reply)
    })
  }
}

export default shop
