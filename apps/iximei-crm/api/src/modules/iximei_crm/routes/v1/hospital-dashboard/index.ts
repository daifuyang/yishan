/**
 * 医院后台数据看板 + 未查看派单数 路由。
 *
 * 端点：
 *   - GET /hospital/dashboard/stats
 *       permission: HOSPITAL_DASHBOARD_VIEW
 *       querystring: { hospitalId?: number; startDate?: string; endDate?: string }
 *         - SUPER_ADMIN 不传 hospitalId → 全院汇总；传则单院
 *         - HOSPITAL_ACCOUNT 不传 → 自己医院；传则必须等于自己医院（否则 403）
 *         - startDate/endDate 可选 (YYYY-MM-DD，闭区间)
 *       返回 6 项看板指标（4 个时间桶 + viewed/unviewed）。
 *   - GET /hospital/dispatches/unviewed-count
 *       permission: DISPATCH_LIST
 *       querystring: { hospitalId?: number }
 *       返回该（些）医院未查看派单数（菜单 Badge 用）。
 *   - GET /hospital/dashboard/trend
 *       permission: HOSPITAL_DASHBOARD_VIEW
 *       querystring: { hospitalId?; startDate?; endDate? }
 *       返回派单趋势 (daily) + viewed/unviewed 状态分布。
 *
 * 路由层只做：身份 / 权限前置校验 + querystring 解析 + 调用 service + 响应封装。
 * 角色门禁 (HOSPITAL_ACCOUNT 越权) 在 service 里 throw BusinessError(FORBIDDEN)。
 */

import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { PERMS } from '../../../permissions.js'
import { HospitalDashboardService } from '../../../services/hospital-dashboard.service.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import {
  CrmHospitalDashboardRecentViewsRespSchema,
  CrmHospitalDashboardRespSchema,
  CrmHospitalDashboardTrendRespSchema,
  CrmHospitalUnviewedCountRespSchema,
} from '../../../schemas/hospital-dashboard.schema.js'

const hospitalDashboard: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)

  // Register once so $ref can resolve via $id in OpenAPI generation.
  app.addSchema(CrmHospitalDashboardRespSchema)
  app.addSchema(CrmHospitalDashboardTrendRespSchema)
  app.addSchema(CrmHospitalUnviewedCountRespSchema)
  app.addSchema(CrmHospitalDashboardRecentViewsRespSchema)

  const uid = (req: any) => req.currentUser.id
  const roleIds = (req: any): number[] => req.currentUser?.roleIds ?? []

  /**
   * querystring shape shared by /stats and /trend:
   * - hospitalId: optional integer (>0); 不传 = "本角色默认范围"
   * - startDate / endDate: optional YYYY-MM-DD
   */
  const statsTrendQuery = Type.Object({
    hospitalId: Type.Optional(Type.Integer({ minimum: 0 })),
    startDate: Type.Optional(Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
    endDate: Type.Optional(Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
  })

  const unviewedQuery = Type.Object({
    hospitalId: Type.Optional(Type.Integer({ minimum: 0 })),
  })

  const myRecentViewsQuery = Type.Object({
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })),
  })

  route.get(
    '/hospital/dashboard/stats',
    {
      access: { permission: PERMS.HOSPITAL_DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院数据看板',
        operationId: 'getCrmHospitalDashboardStats',
        querystring: statsTrendQuery,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: CrmHospitalDashboardRespSchema,
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const { hospitalId, startDate, endDate } = req.query
      const result = await HospitalDashboardService.getStats(uid(req), roleIds(req), {
        hospitalId,
        startDate,
        endDate,
      })
      return ResponseUtil.success(reply, result)
    },
  )

  route.get(
    '/hospital/dispatches/unviewed-count',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院账号未查看派单数量（菜单 Badge 用）',
        operationId: 'getCrmHospitalUnviewedDispatchCount',
        querystring: unviewedQuery,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: CrmHospitalUnviewedCountRespSchema,
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const { hospitalId } = req.query
      const result = await HospitalDashboardService.getUnviewedCount(uid(req), roleIds(req), {
        hospitalId,
      })
      return ResponseUtil.success(reply, result)
    },
  )

  route.get(
    '/hospital/dashboard/trend',
    {
      access: { permission: PERMS.HOSPITAL_DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院数据看板 - 派单趋势 + 状态分布',
        operationId: 'getCrmHospitalDashboardTrend',
        querystring: statsTrendQuery,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: CrmHospitalDashboardTrendRespSchema,
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const { hospitalId, startDate, endDate } = req.query
      const result = await HospitalDashboardService.getTrend(uid(req), roleIds(req), 30, {
        hospitalId,
        startDate,
        endDate,
      })
      return ResponseUtil.success(reply, result)
    },
  )

  /**
   * 我最近查看的派单（医院后台首页足迹卡片，任务 4）。
   *
   * 数据源 crm_dispatch_view_log（hospital_account 首次访问派单详情时写入）。
   * - hospital_account：限本院、限本人 viewer_user_id
   * - super_admin：限全院、限本人 viewer_user_id
   */
  route.get(
    '/hospital/dashboard/my-recent-views',
    {
      access: { permission: PERMS.HOSPITAL_DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院账号：我最近查看的派单（首页足迹卡片）',
        operationId: 'listCrmHospitalDashboardMyRecentViews',
        querystring: myRecentViewsQuery,
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: CrmHospitalDashboardRecentViewsRespSchema,
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const limit = req.query?.limit ?? 10
      const result = await HospitalDashboardService.getMyRecentViews(uid(req), roleIds(req), limit)
      return ResponseUtil.success(reply, result)
    },
  )
}

export default hospitalDashboard