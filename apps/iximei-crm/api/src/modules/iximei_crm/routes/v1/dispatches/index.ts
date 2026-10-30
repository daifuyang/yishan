/**
 * 派单资源路由。
 *
 * 单一职责:派单列表/详情/状态字典 + 回复 + 跟进。
 *
 * 数据权限(apps/yishan-api/docs/data-scope.md):
 *   - SUPER_ADMIN (lift ALL) → 看全部派单
 *   - HOSPITAL_ACCOUNT (dataScope=4/5 SELF) → 关联自己医院的派单
 *   - 客服/默认 SELF → 自己添加的客户的派单
 *   - rbac preHandler 已写 effectiveDataScope 到 req.currentUser.dataScope
 */

import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { PERMS } from '../../../permissions.js'
import { DispatchesService } from '../../../services/dispatches.service.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import {
  CrmDispatchListQuerySchema,
  CrmDispatchLogReqSchema,
  CrmDispatchReplyReqSchema,
  CrmDispatchUpdateSchema,
} from '../../../schemas/dispatches.schema.js'
import { CrmIdParamsSchema } from '../../../schemas/shared.schema.js'
import { currentCrmDataScope, type DataScopeCode } from '@/modules/iximei_crm/access-scope'

const dispatches: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const uid = (req: any) => req.currentUser.id
  const id = (req: any) => Number(req.params.id)
  const roleIds = (req: any): number[] => req.currentUser?.roleIds ?? []
  const scope = async (_req: any): Promise<DataScopeCode> => currentCrmDataScope()

  route.get(
    '/dispatches/statuses',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单状态字典',
        operationId: 'listCrmDispatchStatuses',
      },
    },
    async (_req: any, reply: any) => {
      const result = await DispatchesService.listStatuses()
      return ResponseUtil.success(reply, result)
    },
  )

  route.get(
    '/dispatches',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单列表',
        operationId: 'listCrmDispatches',
        querystring: CrmDispatchListQuerySchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await DispatchesService.list(req.query, uid(req), roleIds(req), await scope(req))
      return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
    },
  )

  route.get(
    '/dispatches/:id',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单详情',
        operationId: 'getCrmDispatch',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const d = await DispatchesService.getById(id(req), uid(req), roleIds(req), await scope(req), req)
      if (!d) return ResponseUtil.error(reply, 40401, '派单不存在或无权访问')
      return ResponseUtil.success(reply, d)
    },
  )

  route.patch(
    '/dispatches/:id',
    {
      access: { permission: PERMS.DISPATCH_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新派单',
        operationId: 'updateCrmDispatch',
        params: CrmIdParamsSchema,
        body: CrmDispatchUpdateSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await DispatchesService.update(id(req), req.body, uid(req), roleIds(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.post(
    '/dispatches/:id/reply',
    {
      access: { permission: PERMS.DISPATCH_REPLY },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单回复',
        operationId: 'createCrmDispatchReply',
        params: CrmIdParamsSchema,
        body: CrmDispatchReplyReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await DispatchesService.addReply(id(req), req.body, uid(req), roleIds(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.post(
    '/dispatches/:id/logs',
    {
      access: { permission: PERMS.DISPATCH_LOG },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单跟进',
        operationId: 'createCrmDispatchLog',
        params: CrmIdParamsSchema,
        body: CrmDispatchLogReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await DispatchesService.addLog(id(req), req.body.content, uid(req), roleIds(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.delete(
    '/dispatches/:id',
    {
      access: { permission: PERMS.DISPATCH_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除派单',
        operationId: 'deleteCrmDispatch',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await DispatchesService.delete(id(req), uid(req), roleIds(req), await scope(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.get(
    '/admin/dispatches/export',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '导出派单 CSV',
        operationId: 'exportCrmDispatches',
        querystring: CrmDispatchListQuerySchema,
      },
    },
    async (req: any, reply: any) => {
      const data = await DispatchesService.exportAll(req.query, uid(req), roleIds(req), await scope(req))
      const csvHeader = 'ID,客户姓名,客户手机,医院名称,状态,接收QQ,接收微信,创建时间,完成时间\n'
      const csvRows = data.map((d: any) =>
        [
          d.id,
          `"${(d.customerName ?? '').replace(/"/g, '""')}"`,
          d.customerMobile,
          `"${(d.hospitalName ?? '').replace(/"/g, '""')}"`,
          d.statusName,
          d.receiveQq,
          d.receiveWechat,
          d.createdAt,
          d.finishedAt,
        ].join(','),
      ).join('\n')
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', 'attachment; filename="dispatches.csv"')
      return csvHeader + csvRows
    },
  )

  // ── 医院账号：查看派单客户手机号明文（写日志） ──
  // 不设 response schema：ResponseUtil.success 会用 { success, code, message, data, timestamp }
  // 信封包裹返回，直接断言内层 mobile 会触发 Fastify 5 的 envelope 校验。其它路由（getCrmDispatch
  // 等）也未设 response schema，保持一致。

  route.post(
    '/dispatches/:id/view-mobile',
    {
      access: { permission: PERMS.DISPATCH_VIEW_MOBILE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '查看派单客户手机号（医院账号触发，写入审计日志）',
        operationId: 'viewCrmDispatchMobile',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const user: any = req.currentUser
      const hospitalName: string | null =
        user?.hospitalName ?? user?.hospital?.hospitalName ?? null
      const ip: string | null =
        req.ip ?? (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? null
      const result = await DispatchesService.viewDispatchMobile(
        id(req),
        uid(req),
        user?.username ?? '',
        roleIds(req),
        await scope(req),
        { ip, hospitalName },
      )
      return ResponseUtil.success(reply, result)
    },
  )

  // ── super_admin：列出某派单的全部手机号查看记录 ──

  route.get(
    '/dispatches/:id/mobile-view-logs',
    {
      access: { permission: PERMS.DISPATCH_VIEW_MOBILE_LOGS },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单手机号查看日志（仅 super_admin）',
        operationId: 'listCrmDispatchMobileViewLogs',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await DispatchesService.listDispatchMobileViews(
        id(req),
        uid(req),
        roleIds(req),
        await scope(req),
      )
      return ResponseUtil.success(reply, result)
    },
  )

  // ── super_admin / admin：列出某派单的全部医院查看记录 ──

  route.get(
    '/dispatches/:id/hospital-view-logs',
    {
      access: { permission: PERMS.DISPATCH_VIEW_HOSPITAL_LOG },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单医院查看日志（仅 super_admin / admin）',
        operationId: 'listCrmDispatchHospitalViewLogs',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await DispatchesService.listDispatchHospitalViewLogs(
        id(req),
        uid(req),
        roleIds(req),
        await scope(req),
      )
      return ResponseUtil.success(reply, result)
    },
  )
}

export default dispatches
