import type { FastifyPluginAsync } from 'fastify'
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { IdParamsSchema, OkRespSchema } from '../../../schemas/common.schema.js'
import { TemplatesService } from '../../../services/templates.service.js'
import {
  TemplateCreateReqSchema,
  TemplateListQuerySchema,
  TemplateListRespSchema,
  TemplateRespSchema,
  TemplateUpdateReqSchema,
} from '../../../schemas/templates.schema.js'

/**
 * portal 文章模板资源（TemplatesService，type=0）。
 *
 * 目录即 URL：autoload 推导为 `/api/portal/v1/article-templates`，本文件只负责该资源。
 */
const ROUTE_TAG = 'portal'
const TEMPLATE_TYPE = 0

export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  ARTICLE_TEMPLATE_LIST: { code: 'portal:article-template:list', label: '门户-文章模板-查看', group: 'portal' },
  ARTICLE_TEMPLATE_CREATE: { code: 'portal:article-template:create', label: '门户-文章模板-新建', group: 'portal' },
  ARTICLE_TEMPLATE_UPDATE: { code: 'portal:article-template:update', label: '门户-文章模板-编辑', group: 'portal' },
  ARTICLE_TEMPLATE_DELETE: { code: 'portal:article-template:delete', label: '门户-文章模板-删除', group: 'portal' },
})
registerPermissions(...Object.values(PERMS))

const articleTemplates: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const service = new TemplatesService(app.drizzleDb)

  route.get(
    '/',
    {
      access: { permission: PERMS.ARTICLE_TEMPLATE_LIST },
      schema: { tags: [ROUTE_TAG], summary: '文章模板列表', querystring: TemplateListQuerySchema, response: { 200: TemplateListRespSchema } },
    },
    async (req: any) => service.list({ ...req.query, type: TEMPLATE_TYPE }),
  )

  route.get(
    '/:id',
    {
      access: { permission: PERMS.ARTICLE_TEMPLATE_LIST },
      schema: { tags: [ROUTE_TAG], summary: '文章模板详情', params: IdParamsSchema, response: { 200: TemplateRespSchema } },
    },
    async (req: any) => service.findById(req.params.id),
  )

  route.post(
    '/',
    {
      access: { permission: PERMS.ARTICLE_TEMPLATE_CREATE },
      schema: { tags: [ROUTE_TAG], summary: '新建文章模板', body: TemplateCreateReqSchema, response: { 200: TemplateRespSchema } },
    },
    async (req: any, reply: any) => {
      const userId = req.currentUser?.id ?? 1
      const created = await service.create({ ...req.body, type: TEMPLATE_TYPE, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '文章模板创建成功')
    },
  )

  route.patch(
    '/:id',
    {
      access: { permission: PERMS.ARTICLE_TEMPLATE_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '更新文章模板', params: IdParamsSchema, body: TemplateUpdateReqSchema, response: { 200: TemplateRespSchema } },
    },
    async (req: any, reply: any) => {
      const updated = await service.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '文章模板更新成功')
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.ARTICLE_TEMPLATE_DELETE },
      schema: { tags: [ROUTE_TAG], summary: '删除文章模板', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.remove(req.params.id)
      return ResponseUtil.success(reply, null, '文章模板删除成功')
    },
  )
}

export default articleTemplates
