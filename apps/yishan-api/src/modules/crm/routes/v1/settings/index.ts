import { type FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import {
  SourceService,
  StatusService,
  TagService,
} from '../../../services/settings.service.js'
import {
  SourceCreateReqSchema,
  SourceRespSchema,
  SourceUpdateReqSchema,
} from '../../../schemas/settings.schema.js'
import {
  StatusCreateReqSchema,
  StatusRespSchema,
  StatusUpdateReqSchema,
} from '../../../schemas/settings.schema.js'
import {
  TagCreateReqSchema,
  TagRespSchema,
  TagUpdateReqSchema,
} from '../../../schemas/settings.schema.js'
import { IdParamsSchema, PaginationQuerySchema } from '../../../schemas/common.schema.js'
import {
  ROUTE_TAG,
  EnvelopeSchema,
  PaginatedEnvelopeSchema,
  OkEnvelopeSchema,
} from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'

/**
 * CRM 设置（标签 / 状态 / 来源）路由。
 *
 * 三个独立资源分别走：
 *   /api/crm/v1/settings/tags
 *   /api/crm/v1/settings/statuses
 *   /api/crm/v1/settings/sources
 */

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const tagService = new TagService()
  const statusService = new StatusService()
  const sourceService = new SourceService()

  /* ─── Tag ─────────────────────────── */

  route.get(
    '/tags',
    {
      access: { permission: PERMS.SETTINGS_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'CRM 标签列表',
        operationId: 'crmSettingsTagsList',
        querystring: PaginationQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(TagRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await tagService.list(request.query)
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )

  route.post(
    '/tags',
    {
      access: { permission: PERMS.SETTINGS_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建 CRM 标签',
        operationId: 'crmSettingsTagsCreate',
        body: TagCreateReqSchema,
        response: { 200: EnvelopeSchema(TagRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const created = await tagService.create(request.body)
      return ResponseUtil.success(reply, created, '标签已创建')
    },
  )

  route.patch(
    '/tags/:id',
    {
      access: { permission: PERMS.SETTINGS_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新 CRM 标签',
        operationId: 'crmSettingsTagsUpdate',
        params: IdParamsSchema,
        body: TagUpdateReqSchema,
        response: { 200: EnvelopeSchema(TagRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await tagService.update(Number(request.params.id), request.body)
      return ResponseUtil.success(reply, updated, '标签已更新')
    },
  )

  route.delete(
    '/tags/:id',
    {
      access: { permission: PERMS.SETTINGS_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除 CRM 标签',
        operationId: 'crmSettingsTagsDelete',
        params: IdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await tagService.remove(Number(request.params.id))
      return ResponseUtil.success(reply, null, '标签已删除')
    },
  )

  /* ─── Status ──────────────────────── */

  route.get(
    '/statuses',
    {
      access: { permission: PERMS.SETTINGS_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'CRM 客户状态列表',
        operationId: 'crmSettingsStatusesList',
        querystring: PaginationQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(StatusRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await statusService.list(request.query)
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )

  route.post(
    '/statuses',
    {
      access: { permission: PERMS.SETTINGS_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建 CRM 客户状态',
        operationId: 'crmSettingsStatusesCreate',
        body: StatusCreateReqSchema,
        response: { 200: EnvelopeSchema(StatusRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const created = await statusService.create(request.body)
      return ResponseUtil.success(reply, created, '状态已创建')
    },
  )

  route.patch(
    '/statuses/:id',
    {
      access: { permission: PERMS.SETTINGS_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新 CRM 客户状态',
        operationId: 'crmSettingsStatusesUpdate',
        params: IdParamsSchema,
        body: StatusUpdateReqSchema,
        response: { 200: EnvelopeSchema(StatusRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await statusService.update(Number(request.params.id), request.body)
      return ResponseUtil.success(reply, updated, '状态已更新')
    },
  )

  route.delete(
    '/statuses/:id',
    {
      access: { permission: PERMS.SETTINGS_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除 CRM 客户状态',
        operationId: 'crmSettingsStatusesDelete',
        params: IdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await statusService.remove(Number(request.params.id))
      return ResponseUtil.success(reply, null, '状态已删除')
    },
  )

  /* ─── Source ──────────────────────── */

  route.get(
    '/sources',
    {
      access: { permission: PERMS.SETTINGS_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'CRM 客户来源列表',
        operationId: 'crmSettingsSourcesList',
        querystring: PaginationQuerySchema,
        response: { 200: PaginatedEnvelopeSchema(SourceRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const result = await sourceService.list(request.query)
      return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total)
    },
  )

  route.post(
    '/sources',
    {
      access: { permission: PERMS.SETTINGS_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建 CRM 客户来源',
        operationId: 'crmSettingsSourcesCreate',
        body: SourceCreateReqSchema,
        response: { 200: EnvelopeSchema(SourceRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const created = await sourceService.create(request.body)
      return ResponseUtil.success(reply, created, '来源已创建')
    },
  )

  route.patch(
    '/sources/:id',
    {
      access: { permission: PERMS.SETTINGS_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新 CRM 客户来源',
        operationId: 'crmSettingsSourcesUpdate',
        params: IdParamsSchema,
        body: SourceUpdateReqSchema,
        response: { 200: EnvelopeSchema(SourceRespSchema) },
      },
    },
    async (request: any, reply: any) => {
      const updated = await sourceService.update(Number(request.params.id), request.body)
      return ResponseUtil.success(reply, updated, '来源已更新')
    },
  )

  route.delete(
    '/sources/:id',
    {
      access: { permission: PERMS.SETTINGS_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除 CRM 客户来源',
        operationId: 'crmSettingsSourcesDelete',
        params: IdParamsSchema,
        response: { 200: OkEnvelopeSchema },
      },
    },
    async (request: any, reply: any) => {
      await sourceService.remove(Number(request.params.id))
      return ResponseUtil.success(reply, null, '来源已删除')
    },
  )
}) as FastifyPluginAsync
