/**
 * 枚举中心 (sys_enum) 路由。
 *
 * URL prefix: /api/v1/admin/enums (由 core/routes AutoLoad 自动挂载)
 *
 * 责任：
 *   - GET  /                  分页 + 按 type 过滤 + 关键字搜索（管理后台）
 *   - GET  /by-type?type=xxx   启用项的精简列表（dropdown 用，60s 缓存）
 *   - GET  /by-types?types=a,b 批量拉取多个 type（首屏 SSR 用）
 *   - GET  /types             列出所有出现的 type（去重）
 *   - POST /                  新建
 *   - PUT  /:id               更新（白名单字段）
 *   - DELETE /:id             软删除
 *
 * 权限：枚举中心仅"系统字典管理员"可见，避免普通销售接触 type/code 字典。
 *   - LIST   → system:enum:list
 *   - CREATE → system:enum:create
 *   - UPDATE → system:enum:update
 *   - DELETE → system:enum:delete
 */
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsync } from 'fastify'
import { ResponseUtil } from '../../../../../../utils/response.js'
import { registerPermissions, type PermissionRef } from '../../../../../permissions/catalog.js'
import { createRouteRegistrar } from '../../../../../routes/route-registrar.js'
import { EnumService } from '../../../../../services/enum.service.js'
import {
  SysEnumCodeNameListRespSchema,
  SysEnumCreateReqSchema,
  SysEnumIdParamSchema,
  SysEnumItemRespSchema,
  SysEnumListQuerySchema,
  SysEnumUpdateReqSchema,
} from '../../../../../schemas/enum.schema.js'

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  LIST:   { code: 'system:enum:list',   label: '枚举中心-列表',   group: 'system' },
  CREATE: { code: 'system:enum:create', label: '枚举中心-创建',   group: 'system' },
  UPDATE: { code: 'system:enum:update', label: '枚举中心-更新',   group: 'system' },
  DELETE: { code: 'system:enum:delete', label: '枚举中心-删除',   group: 'system' },
})
registerPermissions(...Object.values(PERMS))

const PaginatedItemEnvelope = Type.Object({
  success: Type.Boolean(),
  code: Type.Number(),
  message: Type.String(),
  data: Type.Object({
    items: Type.Array(SysEnumItemRespSchema),
    total: Type.Number(),
    page: Type.Number(),
    pageSize: Type.Number(),
  }),
  timestamp: Type.String({ format: 'date-time' }),
})

const SingleItemEnvelope = Type.Object({
  success: Type.Boolean(),
  code: Type.Number(),
  message: Type.String(),
  data: SysEnumItemRespSchema,
  timestamp: Type.String({ format: 'date-time' }),
})

const ByTypeEnvelope = Type.Object({
  success: Type.Boolean(),
  code: Type.Number(),
  message: Type.String(),
  data: SysEnumCodeNameListRespSchema,
  timestamp: Type.String({ format: 'date-time' }),
})

const ByTypesEnvelope = Type.Object({
  success: Type.Boolean(),
  code: Type.Number(),
  message: Type.String(),
  data: Type.Object({
    items: Type.Record(Type.String(), Type.Array(Type.Object({
      code: Type.String(),
      name: Type.String(),
      sort: Type.Number(),
    }))),
  }),
  timestamp: Type.String({ format: 'date-time' }),
})

const TypesListEnvelope = Type.Object({
  success: Type.Boolean(),
  code: Type.Number(),
  message: Type.String(),
  data: Type.Array(Type.String()),
  timestamp: Type.String({ format: 'date-time' }),
})

const DeleteEnvelope = Type.Object({
  success: Type.Boolean(),
  code: Type.Number(),
  message: Type.String(),
  data: Type.Object({ id: Type.Number(), affected: Type.Number() }),
  timestamp: Type.String({ format: 'date-time' }),
})

const adminEnums: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  const route = createRouteRegistrar(fastify)
  const service = new EnumService()

  route.get(
    '/',
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: '枚举分页列表',
        tags: ['sysEnum'],
        operationId: 'sysEnumList',
        querystring: SysEnumListQuerySchema,
        response: { 200: PaginatedItemEnvelope },
      },
    },
    async (request: any, reply: any) => {
      // service.list() 返回 { items, total, page, pageSize }，必须整对象放进 data，
      // 否则 PaginatedItemEnvelope 校验会抛 "items" is required。
      const result = await service.list(request.query)
      return ResponseUtil.success(reply, result)
    },
  )

  route.get(
    '/by-type',
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: '按 type 拉启用项（dropdown 用，60s 缓存）',
        tags: ['sysEnum'],
        operationId: 'sysEnumByType',
        querystring: Type.Object({ type: Type.String({ minLength: 1, maxLength: 64 }) }),
        response: { 200: ByTypeEnvelope },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.listByType(request.query.type)
      return ResponseUtil.success(reply, result)
    },
  )

  route.get(
    '/by-types',
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: '批量拉多个 type 的启用项（首屏 SSR 用）',
        tags: ['sysEnum'],
        operationId: 'sysEnumByTypes',
        querystring: Type.Object({
          types: Type.String({ minLength: 1, maxLength: 1024, description: '逗号分隔的 type 列表' }),
        }),
        response: { 200: ByTypesEnvelope },
      },
    },
    async (request: any, reply: any) => {
      const types = request.query.types.split(',').map((t: string) => t.trim()).filter(Boolean)
      const items = await service.listByTypes(types)
      return ResponseUtil.success(reply, { items })
    },
  )

  route.get(
    '/types',
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: '列出所有出现的 type（distinct）',
        tags: ['sysEnum'],
        operationId: 'sysEnumTypes',
        response: { 200: TypesListEnvelope },
      },
    },
    async (_request: any, reply: any) => {
      const result = await service.listTypes()
      return ResponseUtil.success(reply, result)
    },
  )

  route.post(
    '/',
    {
      access: { permission: PERMS.CREATE },
      schema: {
        summary: '新建枚举',
        tags: ['sysEnum'],
        operationId: 'sysEnumCreate',
        body: SysEnumCreateReqSchema,
        response: { 200: SingleItemEnvelope },
      },
    },
    async (request: any, reply: any) => {
      const created = await service.create(request.body, request.currentUser)
      return ResponseUtil.success(reply, created, '枚举创建成功')
    },
  )

  route.put(
    '/:id',
    {
      access: { permission: PERMS.UPDATE },
      schema: {
        summary: '更新枚举',
        tags: ['sysEnum'],
        operationId: 'sysEnumUpdate',
        params: SysEnumIdParamSchema,
        body: SysEnumUpdateReqSchema,
        response: { 200: SingleItemEnvelope },
      },
    },
    async (request: any, reply: any) => {
      const updated = await service.update(request.params.id, request.body, request.currentUser)
      if (!updated) {
        return reply.code(404).send({
          success: false,
          code: 40400,
          message: '枚举不存在',
          data: null,
          timestamp: new Date().toISOString(),
        })
      }
      return ResponseUtil.success(reply, updated, '枚举已更新')
    },
  )

  route.delete(
    '/:id',
    {
      access: { permission: PERMS.DELETE },
      schema: {
        summary: '软删除枚举',
        tags: ['sysEnum'],
        operationId: 'sysEnumDelete',
        params: SysEnumIdParamSchema,
        response: { 200: DeleteEnvelope },
      },
    },
    async (request: any, reply: any) => {
      const result = await service.softDelete(request.params.id, request.currentUser)
      return ResponseUtil.success(reply, result, result.affected > 0 ? '枚举已删除' : '枚举不存在')
    },
  )
}

export default adminEnums
