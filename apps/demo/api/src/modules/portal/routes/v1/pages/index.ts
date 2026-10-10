import type { FastifyPluginAsync } from 'fastify'
import { type PermissionRef } from '@yishan/core-api/permissions/catalog'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { IdParamsSchema, OkRespSchema } from '../../../schemas/common.schema.js'
import { PagesService } from '../../../services/pages.service.js'
import {
  PageCreateReqSchema,
  PageListQuerySchema,
  PageListRespSchema,
  PageRespSchema,
  PageUpdateReqSchema,
} from '../../../schemas/pages.schema.js'

/**
 * portal 页面资源。
 *
 * 目录即 URL：autoload 推导为 `/api/portal/v1/pages`，本文件只负责该资源。
 */
const ROUTE_TAG = 'portal'

export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  PAGE_LIST: { code: 'portal:page:list', label: '门户-页面-查看', group: 'portal' },
  PAGE_CREATE: { code: 'portal:page:create', label: '门户-页面-新建', group: 'portal' },
  PAGE_UPDATE: { code: 'portal:page:update', label: '门户-页面-编辑', group: 'portal' },
  PAGE_DELETE: { code: 'portal:page:delete', label: '门户-页面-删除', group: 'portal' },
})

const pages: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const service = new PagesService(app.drizzleDb)

  route.get(
    '/',
    {
      access: { permission: PERMS.PAGE_LIST },
      schema: { tags: [ROUTE_TAG], summary: '页面列表', querystring: PageListQuerySchema, response: { 200: PageListRespSchema } },
    },
    async (req: any) => service.list(req.query),
  )

  route.get(
    '/:id',
    {
      access: { permission: PERMS.PAGE_LIST },
      schema: { tags: [ROUTE_TAG], summary: '页面详情', params: IdParamsSchema, response: { 200: PageRespSchema } },
    },
    async (req: any) => service.findById(req.params.id),
  )

  route.post(
    '/',
    {
      access: { permission: PERMS.PAGE_CREATE },
      schema: { tags: [ROUTE_TAG], summary: '新建页面', body: PageCreateReqSchema, response: { 200: PageRespSchema } },
    },
    async (req: any) => {
      const userId = req.currentUser?.id ?? 1
      const created = await service.create({ ...req.body, creatorId: userId, updaterId: userId })
      return created
    },
  )

  route.patch(
    '/:id',
    {
      access: { permission: PERMS.PAGE_UPDATE },
      schema: { tags: [ROUTE_TAG], summary: '更新页面', params: IdParamsSchema, body: PageUpdateReqSchema, response: { 200: PageRespSchema } },
    },
    async (req: any) => {
      const updated = await service.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return updated
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.PAGE_DELETE },
      schema: { tags: [ROUTE_TAG], summary: '删除页面', params: IdParamsSchema, response: { 200: OkRespSchema } },
    },
    async (req: any, reply: any) => {
      await service.remove(req.params.id)
      return ResponseUtil.success(reply, null, '页面删除成功')
    },
  )
}

export default pages
