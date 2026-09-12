/**
 * 产品目录（Phase 2）路由。
 *
 * 路径：/api/crm/v1/products/*
 *
 * 子资源：
 *   /products                  产品主表
 *   /products/categories       产品分类
 *   /products/units            计量单位
 *
 * 注意：路由顺序很重要。
 *   - 静态段（/categories、/units）必须先于 /:id，否则会被 :id 抢走。
 *   - 子资源内部再走相同的"静态在前、动态在后"模式。
 */
import { type FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import {
  ProductCategoryService,
  ProductService,
  UnitService,
} from '../../../services/product.service.js'
import {
  ProductCategoryCreateReqSchema,
  ProductCategoryIdParamsSchema,
  ProductCategoryListQuerySchema,
  ProductCategoryListRespSchema,
  ProductCategoryRespSchema,
  ProductCategoryUpdateReqSchema,
  ProductCreateReqSchema,
  ProductIdParamsSchema,
  ProductListQuerySchema,
  ProductRespSchema,
  ProductUpdateReqSchema,
  UnitCreateReqSchema,
  UnitIdParamsSchema,
  UnitListQuerySchema,
  UnitListRespSchema,
  UnitRespSchema,
  UnitUpdateReqSchema,
} from '../../../schemas/product.schema.js'
import {
  ROUTE_TAG,
  EnvelopeSchema,
  PaginatedEnvelopeSchema,
  OkEnvelopeSchema,
} from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const productService = new ProductService()
  const categoryService = new ProductCategoryService()
  const unitService = new UnitService()

  /* ─── Product ───────────────────────────────── */

  // GET /products/categories —— 必须在 /products/:id 之前注册
  route.get(
    '/categories',
    {
      access: { permission: PERMS.PRODUCT_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '产品分类列表',
        operationId: 'crmProductCategoriesList',
        querystring: ProductCategoryListQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(ProductCategoryRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await categoryService.list(request.query)
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )

  route.get(
    '/categories/options',
    {
      access: { permission: PERMS.PRODUCT_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '产品分类下拉（仅启用）',
        operationId: 'crmProductCategoriesOptions',
        response: { 200: EnvelopeSchema(ProductCategoryListRespSchema) },
      },
    },
    async (_request: any, reply: any) => {
      const items = await categoryService.listEnabled()
      return ResponseUtil.success(reply, { total: items.length, page: 1, pageSize: items.length, items })
    },
  )

  route.post(
    '/categories',
    {
      access: { permission: PERMS.PRODUCT_CATEGORY_MANAGE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建产品分类',
        operationId: 'crmProductCategoriesCreate',
        body: ProductCategoryCreateReqSchema,
        response: { 200: EnvelopeSchema(ProductCategoryRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const created = await categoryService.create({ input: request.body, currentUser: request.currentUser })
      return ResponseUtil.success(reply, created, '产品分类已创建')
    },
  )

  route.patch(
    '/categories/:id',
    {
      access: { permission: PERMS.PRODUCT_CATEGORY_MANAGE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新产品分类',
        operationId: 'crmProductCategoriesUpdate',
        params: ProductCategoryIdParamsSchema,
        body: ProductCategoryUpdateReqSchema,
        response: { 200: EnvelopeSchema(ProductCategoryRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await categoryService.update({
        id: Number(request.params.id),
        input: request.body,
        currentUser: request.currentUser,
      })
      return ResponseUtil.success(reply, updated, '产品分类已更新')
    },
  )

  route.delete(
    '/categories/:id',
    {
      access: { permission: PERMS.PRODUCT_CATEGORY_MANAGE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '软删除产品分类',
        operationId: 'crmProductCategoriesDelete',
        params: ProductCategoryIdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await categoryService.softDelete({ id: Number(request.params.id) })
      return ResponseUtil.success(reply, null, '产品分类已删除')
    },
  )

  // GET /products/units —— 静态段，必须在 /:id 之前
  route.get(
    '/units',
    {
      access: { permission: PERMS.PRODUCT_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '计量单位列表',
        operationId: 'crmProductUnitsList',
        querystring: UnitListQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(UnitRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await unitService.list(request.query)
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )

  route.get(
    '/units/options',
    {
      access: { permission: PERMS.PRODUCT_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '计量单位下拉（仅启用）',
        operationId: 'crmProductUnitsOptions',
        response: { 200: EnvelopeSchema(UnitListRespSchema) },
      },
    },
    async (_request: any, reply: any) => {
      const items = await unitService.listEnabled()
      return ResponseUtil.success(reply, { total: items.length, page: 1, pageSize: items.length, items })
    },
  )

  route.post(
    '/units',
    {
      access: { permission: PERMS.PRODUCT_UNIT_MANAGE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建计量单位',
        operationId: 'crmProductUnitsCreate',
        body: UnitCreateReqSchema,
        response: { 200: EnvelopeSchema(UnitRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const created = await unitService.create({ input: request.body, currentUser: request.currentUser })
      return ResponseUtil.success(reply, created, '计量单位已创建')
    },
  )

  route.patch(
    '/units/:id',
    {
      access: { permission: PERMS.PRODUCT_UNIT_MANAGE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新计量单位',
        operationId: 'crmProductUnitsUpdate',
        params: UnitIdParamsSchema,
        body: UnitUpdateReqSchema,
        response: { 200: EnvelopeSchema(UnitRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await unitService.update({
        id: Number(request.params.id),
        input: request.body,
        currentUser: request.currentUser,
      })
      return ResponseUtil.success(reply, updated, '计量单位已更新')
    },
  )

  route.delete(
    '/units/:id',
    {
      access: { permission: PERMS.PRODUCT_UNIT_MANAGE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '软删除计量单位',
        operationId: 'crmProductUnitsDelete',
        params: UnitIdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await unitService.softDelete({ id: Number(request.params.id) })
      return ResponseUtil.success(reply, null, '计量单位已删除')
    },
  )

  // GET /products —— 列表
  route.get(
    '/',
    {
      access: { permission: PERMS.PRODUCT_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '产品列表',
        operationId: 'crmProductsList',
        querystring: ProductListQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(ProductRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await productService.list(request.query)
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )

  // POST /products —— 创建
  route.post(
    '/',
    {
      access: { permission: PERMS.PRODUCT_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建产品',
        operationId: 'crmProductsCreate',
        body: ProductCreateReqSchema,
        response: { 200: EnvelopeSchema(ProductRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const created = await productService.create({ input: request.body, currentUser: request.currentUser })
      return ResponseUtil.success(reply, created, '产品已创建')
    },
  )

  // GET /products/:id —— 详情
  route.get(
    '/:id',
    {
      access: { permission: PERMS.PRODUCT_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '产品详情',
        operationId: 'crmProductsDetail',
        params: ProductIdParamsSchema,
        response: { 200: EnvelopeSchema(ProductRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const row = await productService.findById(Number(request.params.id))
      if (!row) {
        return ResponseUtil.success(reply, null, '产品不存在或已删除')
      }
      return ResponseUtil.success(reply, row, '获取产品成功')
    },
  )

  // PATCH /products/:id —— 更新
  route.patch(
    '/:id',
    {
      access: { permission: PERMS.PRODUCT_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新产品',
        operationId: 'crmProductsUpdate',
        params: ProductIdParamsSchema,
        body: ProductUpdateReqSchema,
        response: { 200: EnvelopeSchema(ProductRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await productService.update({
        id: Number(request.params.id),
        input: request.body,
        currentUser: request.currentUser,
      })
      return ResponseUtil.success(reply, updated, '产品已更新')
    },
  )

  // DELETE /products/:id —— 软删除
  route.delete(
    '/:id',
    {
      access: { permission: PERMS.PRODUCT_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '软删除产品',
        operationId: 'crmProductsDelete',
        params: ProductIdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await productService.softDelete({ id: Number(request.params.id), currentUser: request.currentUser })
      return ResponseUtil.success(reply, null, '产品已删除')
    },
  )

  // POST /products/:id/enable —— 启用
  route.post(
    '/:id/enable',
    {
      access: { permission: PERMS.PRODUCT_ENABLE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '启用产品',
        operationId: 'crmProductsEnable',
        params: ProductIdParamsSchema,
        response: { 200: EnvelopeSchema(ProductRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await productService.enable({
        id: Number(request.params.id),
        currentUser: request.currentUser,
      })
      return ResponseUtil.success(reply, updated, '产品已启用')
    },
  )

  // POST /products/:id/disable —— 停用
  route.post(
    '/:id/disable',
    {
      access: { permission: PERMS.PRODUCT_ENABLE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '停用产品',
        operationId: 'crmProductsDisable',
        params: ProductIdParamsSchema,
        response: { 200: EnvelopeSchema(ProductRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await productService.disable({
        id: Number(request.params.id),
        currentUser: request.currentUser,
      })
      return ResponseUtil.success(reply, updated, '产品已停用')
    },
  )
}) as FastifyPluginAsync