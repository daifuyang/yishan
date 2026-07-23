import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar, type ManagedRouteOptions } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { IdParamsSchema } from '../../schemas/common.schema.js'
import { PERMS } from '../../permissions.js'
import { ArticlesService } from '../../services/articles.service.js'
import { CategoriesService } from '../../services/categories.service.js'
import { PagesService } from '../../services/pages.service.js'
import { TemplatesService } from '../../services/templates.service.js'

import { ArticleCreateReqSchema, ArticleListQuerySchema, ArticleListRespSchema, ArticleRespSchema, ArticleUpdateReqSchema } from '../../schemas/articles.schema.js'
import { CategoryCreateReqSchema, CategoryListQuerySchema, CategoryListRespSchema, CategoryRespSchema, CategoryUpdateReqSchema } from '../../schemas/categories.schema.js'
import { PageCreateReqSchema, PageListQuerySchema, PageListRespSchema, PageRespSchema, PageUpdateReqSchema } from '../../schemas/pages.schema.js'
import { TemplateCreateReqSchema, TemplateListQuerySchema, TemplateListRespSchema, TemplateRespSchema, TemplateUpdateReqSchema } from '../../schemas/templates.schema.js'

/**
 * portal 模块 v1 路由。
 *
 * 4 个实体 × 5 个标准动作（list / detail / create / update / remove），article 额外加 publish。
 * 用数组驱动：每个实体一组 declaration，外层循环统一注册。
 *
 * 路由 prefix 由 ModuleLoader 推导为 `/api/portal/v1`，本文件不声明。
 */

const ROUTE_TAG = 'portal'

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
  articles: ArticlesService
  pages: PagesService
  templates: TemplatesService
}

function getServices(app: any): Services {
  return {
    categories: new CategoriesService(app.drizzleDb),
    articles: new ArticlesService(app.drizzleDb),
    pages: new PagesService(app.drizzleDb),
    templates: new TemplatesService(app.drizzleDb),
  }
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
      const created = await s.categories.create({ ...req.body, creatorId: req.currentUser?.id ?? 1, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, created, '分类创建成功')
    } },
  { method: 'patch', url: '/categories/:id', perm: PERMS.CATEGORY_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新分类', params: IdParamsSchema, body: CategoryUpdateReqSchema, response: { 200: CategoryRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.categories.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '分类更新成功')
    } },
  { method: 'delete', url: '/categories/:id', perm: PERMS.CATEGORY_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除分类', params: IdParamsSchema, response: { 200: TypeAnyOk() } },
    handler: async (s, req, reply) => {
      await s.categories.remove(req.params.id)
      return ResponseUtil.success(reply, null, '分类删除成功')
    } },
]

// ───────── Articles ─────────
const articleRoutes: RouteDecl[] = [
  { method: 'get', url: '/articles', perm: PERMS.ARTICLE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '文章列表', querystring: ArticleListQuerySchema, response: { 200: ArticleListRespSchema } },
    handler: async (s, req) => s.articles.list(req.query) },
  { method: 'get', url: '/articles/:id', perm: PERMS.ARTICLE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '文章详情', params: IdParamsSchema, response: { 200: ArticleRespSchema } },
    handler: async (s, req) => s.articles.findById(req.params.id) },
  { method: 'post', url: '/articles', perm: PERMS.ARTICLE_CREATE,
    schema: { tags: [ROUTE_TAG], summary: '新建文章', body: ArticleCreateReqSchema, response: { 200: ArticleRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.articles.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '文章创建成功')
    } },
  { method: 'patch', url: '/articles/:id', perm: PERMS.ARTICLE_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新文章', params: IdParamsSchema, body: ArticleUpdateReqSchema, response: { 200: ArticleRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.articles.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '文章更新成功')
    } },
  { method: 'delete', url: '/articles/:id', perm: PERMS.ARTICLE_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除文章', params: IdParamsSchema, response: { 200: TypeAnyOk() } },
    handler: async (s, req, reply) => {
      await s.articles.remove(req.params.id)
      return ResponseUtil.success(reply, null, '文章删除成功')
    } },
  { method: 'post', url: '/articles/:id/publish', perm: PERMS.ARTICLE_PUBLISH,
    schema: { tags: [ROUTE_TAG], summary: '发布文章', params: IdParamsSchema, response: { 200: TypeAnyOk() } },
    handler: async (s, req, reply) => {
      await s.articles.publish(req.params.id, req.currentUser?.id ?? 1)
      return ResponseUtil.success(reply, null, '文章发布成功')
    } },
]

// ───────── Pages ─────────
const pageRoutes: RouteDecl[] = [
  { method: 'get', url: '/pages', perm: PERMS.PAGE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '页面列表', querystring: PageListQuerySchema, response: { 200: PageListRespSchema } },
    handler: async (s, req) => s.pages.list(req.query) },
  { method: 'get', url: '/pages/:id', perm: PERMS.PAGE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '页面详情', params: IdParamsSchema, response: { 200: PageRespSchema } },
    handler: async (s, req) => s.pages.findById(req.params.id) },
  { method: 'post', url: '/pages', perm: PERMS.PAGE_CREATE,
    schema: { tags: [ROUTE_TAG], summary: '新建页面', body: PageCreateReqSchema, response: { 200: PageRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.pages.create({ ...req.body, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '页面创建成功')
    } },
  { method: 'patch', url: '/pages/:id', perm: PERMS.PAGE_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新页面', params: IdParamsSchema, body: PageUpdateReqSchema, response: { 200: PageRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.pages.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '页面更新成功')
    } },
  { method: 'delete', url: '/pages/:id', perm: PERMS.PAGE_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除页面', params: IdParamsSchema, response: { 200: TypeAnyOk() } },
    handler: async (s, req, reply) => {
      await s.pages.remove(req.params.id)
      return ResponseUtil.success(reply, null, '页面删除成功')
    } },
]

// ───────── Templates ─────────
const templateRoutes: RouteDecl[] = [
  { method: 'get', url: '/article-templates', perm: PERMS.ARTICLE_TEMPLATE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '文章模板列表', querystring: TemplateListQuerySchema, response: { 200: TemplateListRespSchema } },
    handler: async (s, req) => s.templates.list({ ...req.query, type: 0 }) },
  { method: 'get', url: '/article-templates/:id', perm: PERMS.ARTICLE_TEMPLATE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '文章模板详情', params: IdParamsSchema, response: { 200: TemplateRespSchema } },
    handler: async (s, req) => s.templates.findById(req.params.id) },
  { method: 'post', url: '/article-templates', perm: PERMS.ARTICLE_TEMPLATE_CREATE,
    schema: { tags: [ROUTE_TAG], summary: '新建文章模板', body: TemplateCreateReqSchema, response: { 200: TemplateRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.templates.create({ ...req.body, type: 0, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '文章模板创建成功')
    } },
  { method: 'patch', url: '/article-templates/:id', perm: PERMS.ARTICLE_TEMPLATE_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新文章模板', params: IdParamsSchema, body: TemplateUpdateReqSchema, response: { 200: TemplateRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.templates.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '文章模板更新成功')
    } },
  { method: 'delete', url: '/article-templates/:id', perm: PERMS.ARTICLE_TEMPLATE_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除文章模板', params: IdParamsSchema, response: { 200: TypeAnyOk() } },
    handler: async (s, req, reply) => {
      await s.templates.remove(req.params.id)
      return ResponseUtil.success(reply, null, '文章模板删除成功')
    } },

  { method: 'get', url: '/page-templates', perm: PERMS.PAGE_TEMPLATE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '页面模板列表', querystring: TemplateListQuerySchema, response: { 200: TemplateListRespSchema } },
    handler: async (s, req) => s.templates.list({ ...req.query, type: 1 }) },
  { method: 'get', url: '/page-templates/:id', perm: PERMS.PAGE_TEMPLATE_LIST,
    schema: { tags: [ROUTE_TAG], summary: '页面模板详情', params: IdParamsSchema, response: { 200: TemplateRespSchema } },
    handler: async (s, req) => s.templates.findById(req.params.id) },
  { method: 'post', url: '/page-templates', perm: PERMS.PAGE_TEMPLATE_CREATE,
    schema: { tags: [ROUTE_TAG], summary: '新建页面模板', body: TemplateCreateReqSchema, response: { 200: TemplateRespSchema } },
    handler: async (s, req, reply) => {
      const userId = req.currentUser?.id ?? 1
      const created = await s.templates.create({ ...req.body, type: 1, creatorId: userId, updaterId: userId })
      return ResponseUtil.success(reply, created, '页面模板创建成功')
    } },
  { method: 'patch', url: '/page-templates/:id', perm: PERMS.PAGE_TEMPLATE_UPDATE,
    schema: { tags: [ROUTE_TAG], summary: '更新页面模板', params: IdParamsSchema, body: TemplateUpdateReqSchema, response: { 200: TemplateRespSchema } },
    handler: async (s, req, reply) => {
      const updated = await s.templates.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 })
      return ResponseUtil.success(reply, updated, '页面模板更新成功')
    } },
  { method: 'delete', url: '/page-templates/:id', perm: PERMS.PAGE_TEMPLATE_DELETE,
    schema: { tags: [ROUTE_TAG], summary: '删除页面模板', params: IdParamsSchema, response: { 200: TypeAnyOk() } },
    handler: async (s, req, reply) => {
      await s.templates.remove(req.params.id)
      return ResponseUtil.success(reply, null, '页面模板删除成功')
    } },
]

// 简化的"成功响应" schema —— 通用的 success envelope
function TypeAnyOk() {
  return { type: 'object', properties: { success: { type: 'boolean' } } }
}

const portal: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const services = getServices(app)
  const allRoutes = [...categoryRoutes, ...articleRoutes, ...pageRoutes, ...templateRoutes]
  for (const r of allRoutes) {
    route[r.method](r.url, { access: { permission: r.perm }, schema: r.schema as ManagedRouteOptions['schema'] }, async (request, reply) => {
      return r.handler(services, request, reply)
    })
  }
}

export default portal
