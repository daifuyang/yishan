import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { PERMS } from '../../../permissions.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { DashboardService } from '../../../services/dashboard.service.js'
import { CrmHospitalOverviewDetailSchema, CrmHospitalOverviewSchema, DashboardStatsSchema } from '../../../schemas/dashboard.schema.js'
import { ROLE_IDS } from '@/modules/iximei_crm/role-codes'
import { currentCrmDataScope } from '@/modules/iximei_crm/access-scope'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isCalendarDate(date: string) {
  if (!DATE_REGEX.test(date)) return false
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

const dashboard: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)

  // Register schema once so $ref can resolve via $id.
  // NOTE: Do NOT addSchema CrmHospitalRankingsRespSchema / CrmHospitalRankingsItemSchema
  // separately — DashboardStatsSchema already embeds them, and Ajv rejects duplicate $id.
  app.addSchema(DashboardStatsSchema)
  app.addSchema(CrmHospitalOverviewSchema)

  route.get('/dashboard/capabilities', {
    access: { permission: PERMS.DASHBOARD_VIEW },
    schema: {
      tags: [ROUTE_TAG], summary: '当前用户可用的 CRM 看板', operationId: 'getCrmDashboardCapabilities',
      response: { 200: Type.Object({ success: Type.Boolean(), code: Type.Integer(), message: Type.String(),
        data: Type.Object({ hospitalOverview: Type.Boolean() }) }) },
    },
  }, async (req: any, reply: any) => ResponseUtil.success(reply,
    DashboardService.getCapabilities(req.currentUser.roleIds ?? [], await currentCrmDataScope())))

  route.get(
    '/dashboard/hospital-overview',
    {
      access: { permission: PERMS.DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'CRM 医院资源与经营总览',
        operationId: 'getCrmHospitalOverview',
        querystring: Type.Object({
          startDate: Type.Optional(Type.String()),
          endDate: Type.Optional(Type.String()),
          category: Type.Optional(Type.Union([
            Type.Literal('oral'),
            Type.Literal('plastic'),
            Type.Literal('unknown'),
          ])),
          provinceCode: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('missing')])),
          cityCode: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('missing')])),
          hospitalScope: Type.Optional(Type.Literal('period-new')),
          status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: CrmHospitalOverviewSchema,
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const query = req.query as {
        startDate?: string
        endDate?: string
        category?: 'oral' | 'plastic' | 'unknown'
        provinceCode?: number | 'missing'
        cityCode?: number | 'missing'
        hospitalScope?: 'period-new'
        status?: number
      }
      if ((query.startDate && !query.endDate) || (!query.startDate && query.endDate)) {
        return reply.status(400).send({
          success: false,
          message: 'startDate 和 endDate 必须同时传递或同时省略',
        })
      }
      if (query.startDate && query.endDate) {
        if (!isCalendarDate(query.startDate) || !isCalendarDate(query.endDate)) {
          return reply.status(400).send({
            success: false,
            message: '日期格式无效，必须为 YYYY-MM-DD',
          })
        }
        if (query.startDate > query.endDate) {
          return reply.status(400).send({
            success: false,
            message: 'startDate 不能晚于 endDate',
          })
        }
      }

      const data = await DashboardService.getHospitalOverview(
        req.currentUser.id,
        req.currentUser.roleIds ?? [],
        await currentCrmDataScope(),
        query,
      )
      return ResponseUtil.success(reply, data)
    },
  )

  route.get(
    '/dashboard/hospital-overview/details',
    {
      access: { permission: PERMS.DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'CRM hospital overview drilldown details',
        operationId: 'listCrmHospitalOverviewDetails',
        querystring: Type.Object({
          page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
          pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
          startDate: Type.Optional(Type.String()),
          endDate: Type.Optional(Type.String()),
          category: Type.Optional(Type.Union([
            Type.Literal('oral'),
            Type.Literal('plastic'),
            Type.Literal('unknown'),
          ])),
          provinceCode: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('missing')])),
          cityCode: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Literal('missing')])),
          hospitalScope: Type.Optional(Type.Literal('period-new')),
          status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: Type.Array(CrmHospitalOverviewDetailSchema),
            pagination: Type.Object({
              page: Type.Integer(),
              pageSize: Type.Integer(),
              total: Type.Integer(),
              totalPages: Type.Integer(),
            }),
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const query = req.query as any
      if ((query.startDate && !query.endDate) || (!query.startDate && query.endDate)) {
        return reply.status(400).send({ success: false, message: 'startDate and endDate must be provided together' })
      }
      if (query.startDate && query.endDate && (
        !isCalendarDate(query.startDate) || !isCalendarDate(query.endDate) || query.startDate > query.endDate
      )) {
        return reply.status(400).send({ success: false, message: 'invalid date range' })
      }
      const result = await DashboardService.getHospitalOverviewDetails(
        req.currentUser.id,
        req.currentUser.roleIds ?? [],
        await currentCrmDataScope(),
        query,
      )
      return ResponseUtil.paginated(reply, result.list, Number(query.page ?? 1), Number(query.pageSize ?? 10), result.total)
    },
  )

  route.get(
    '/dashboard/stats',
    {
      access: { permission: PERMS.DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'CRM 数据看板统计',
        operationId: 'getCrmDashboardStats',
        querystring: Type.Object({
          startDate: Type.Optional(Type.String()),
          endDate: Type.Optional(Type.String()),
          hospitalId: Type.Optional(Type.Integer({ minimum: 1 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: DashboardStatsSchema,
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const { startDate, endDate, hospitalId } = req.query as { startDate?: string; endDate?: string; hospitalId?: number }

      // 参数校验：startDate/endDate 必须同时传递或同时省略
      if ((startDate && !endDate) || (!startDate && endDate)) {
        return reply.status(400).send({
          success: false,
          message: 'startDate 和 endDate 必须同时传递或同时省略',
        })
      }

      // 参数校验：日期格式必须为 YYYY-MM-DD
      if (startDate && endDate) {
        if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) {
          return reply.status(400).send({
            success: false,
            message: '日期格式无效，必须为 YYYY-MM-DD',
          })
        }

        // 校验 startDate <= endDate
        if (startDate > endDate) {
          return reply.status(400).send({
            success: false,
            message: 'startDate 不能晚于 endDate',
          })
        }
      }

      // 客服角色不接收 hospitalId 参数
      const roleIds: number[] = req.currentUser?.roleIds ?? []
      const finalQuery = roleIds.includes(ROLE_IDS.CUSTOMER_SERVICE)
        ? { startDate, endDate }
        : { startDate, endDate, hospitalId }

      const data = await DashboardService.getStats(
        req.currentUser.id,
        roleIds,
        await currentCrmDataScope(),
        finalQuery,
      )
      return ResponseUtil.success(reply, data)
    },
  )
}

export default dashboard
