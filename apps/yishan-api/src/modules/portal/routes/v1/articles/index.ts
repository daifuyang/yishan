import type { FastifyPluginAsync } from 'fastify'
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { IdParamsSchema, OkRespSchema } from '../../../schemas/common.schema.js'
import { ArticlesService } from '../../../services/articles.service.js'
import {
  ArticleCreateReqSchema,
  ArticleListQuerySchema,
  ArticleListRespSchema,
  ArticleRespSchema,
  ArticleUpdateReqSchema,
} from '../../../schemas/articles.schema.js'

/**
 * portal 文章资源。
 *
 * 目录即 URL：autoload 推导为 `/api/portal/v1/articles`，本文件只负责该资源。
 */
const ROUTE_TAG = 'portal'

export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  ARTICLE_LIST: { code: 'portal:article:list', label: '门户-文章-查看', group: 'portal' },
  ARTICLE_CREATE: { code: 'portal:article:create', label: '门户-文章-新建', group: 'portal' },
  ARTICLE_UPDATE: { code: 'portal:article:update', label: '门户-文章-编辑', group: 'portal' },
  ARTICLE_DELETE: { code: 'portal:article:delete', label: '门户-文章-删除', group: 'portal' },
  ARTICLE_PUBLISH: { code: 'portal:article:publish', label: '门户-文章-发布', group: 'portal' },
})
registerPermissions(...Object.values(PERMS))

const articles: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const service = new ArticlesService(app.drizzleDb)

  route.get(
    '/',
    {
      access: { permission: PERMS.ARTICLE_LIST },
      schema: { tags: [ROUTE_TAG], summary: '文章列表', querystring: ArticleListQuerySchema, response: { 200: ArticleListRespSchema } },
    },
    async (req: any) => service.list(req.query),
  )

  route.get(
    '/:id',
    {
      access: { permission: PERMS.ARTICLE_LIST },
      schema: { tags: [ROUTE_TAG], summary: '文章详情', params: IdParamsSchema, response: { 200: ArticleRespSchema } },
    },
    async (req: any) => service.findById(req.params.id),
  )

  route.post(
    '/',
    {
      access: { permission: PERMS.ARTICLE_CREATE },
      schema: { tags: [ROUTE_TAG], summary: '新建文章', body: ArticleCreateReqSchema, response: { 200: ArticleRespSchema } },
    },
    async (req: any, reply: any) => {
      const userId = req.currentUser?.id ?? 1
      const created = await service.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '文章创建成功')
    },
  )

  route.patch(
    '/:id',
    {
      access: { permission: PERMS.ARTICLE_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '更新文章', params: IdParamsSchema, body: ArticleUpdateReqSchema, response: { 200: ArticleRespSchema } },
    },
    async (req: any, reply: any) => {
      const updated = await service.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '文章更新成功')
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.ARTICLE_DELETE },
      schema: { tags: [ROUTE_TAG], summary: '删除文章', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.remove(req.params.id)
      return ResponseUtil.success(reply, null, '文章删除成功')
    },
  )

  route.post(
    '/:id/publish',
    {
      access: { permission: PERMS.ARTICLE_PUBLISH },
      schema: { tags: [ROUTE_TAG], summary: '发布文章', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.publish(req.params.id, req.currentUser?.id ?? 1)
      return ResponseUtil.success(reply, null, '文章发布成功')
    },
  )
}

export default articles
