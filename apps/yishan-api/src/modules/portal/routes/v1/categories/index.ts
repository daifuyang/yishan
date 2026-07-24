import type { FastifyPluginAsync } from 'fastify'
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { IdParamsSchema, OkRespSchema } from '../../../schemas/common.schema.js'
import { CategoriesService } from '../../../services/categories.service.js'
import {
  CategoryCreateReqSchema,
  CategoryListQuerySchema,
  CategoryListRespSchema,
  CategoryRespSchema,
  CategoryUpdateReqSchema,
} from '../../../schemas/categories.schema.js'

/**
 * portal 分类资源。
 *
 * 目录即 URL：autoload 推导为 `/api/portal/v1/categories`，本文件只负责该资源。
 */
const ROUTE_TAG = 'portal'

export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  CATEGORY_LIST: { code: 'portal:category:list', label: '门户-分类-查看', group: 'portal' },
  CATEGORY_CREATE: { code: 'portal:category:create', label: '门户-分类-新建', group: 'portal' },
  CATEGORY_UPDATE: { code: 'portal:category:update', label: '门户-分类-编辑', group: 'portal' },
  CATEGORY_DELETE: { code: 'portal:category:delete', label: '门户-分类-删除', group: 'portal' },
})
registerPermissions(...Object.values(PERMS))

const categories: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const service = new CategoriesService(app.drizzleDb)

  route.get(
    '/',
    {
      access: { permission: PERMS.CATEGORY_LIST },
      schema: { tags: [ROUTE_TAG], summary: '分类列表', querystring: CategoryListQuerySchema, response: { 200: CategoryListRespSchema } },
    },
    async (req: any) => service.list(req.query),
  )

  route.get(
    '/:id',
    {
      access: { permission: PERMS.CATEGORY_LIST },
      schema: { tags: [ROUTE_TAG], summary: '分类详情', params: IdParamsSchema, response: { 200: CategoryRespSchema } },
    },
    async (req: any) => service.findById(req.params.id),
  )

  route.post(
    '/',
    {
      access: { permission: PERMS.CATEGORY_CREATE },
      schema: { tags: [ROUTE_TAG], summary: '新建分类', body: CategoryCreateReqSchema, response: { 200: CategoryRespSchema } },
    },
    async (req: any, reply: any) => {
      const userId = req.currentUser?.id ?? 1
      const created = await service.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '分类创建成功')
    },
  )

  route.patch(
    '/:id',
    {
      access: { permission: PERMS.CATEGORY_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '更新分类', params: IdParamsSchema, body: CategoryUpdateReqSchema, response: { 200: CategoryRespSchema } },
    },
    async (req: any, reply: any) => {
      const updated = await service.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '分类更新成功')
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.CATEGORY_DELETE },
      schema: { tags: [ROUTE_TAG], summary: '删除分类', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.remove(req.params.id)
      return ResponseUtil.success(reply, null, '分类删除成功')
    },
  )
}

export default categories
