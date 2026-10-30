import { DashboardRepository } from '../repositories/dashboard.repository.js'
import type { DateRange } from '../repositories/dashboard.repository.js'
import { HospitalsRepository } from '../repositories/hospitals.repository.js'
import { crmCustomer, crmCustomerStatus, crmDispatch, crmDispatchStatus, crmHospital } from '../db/schema.js'
import { eq, inArray } from 'drizzle-orm'
import { DATA_SCOPE, type DataScopeCode } from '@/modules/iximei_crm/access-scope'
import { ROLE_IDS } from '@/modules/iximei_crm/role-codes'
import { BusinessError } from '@yishan/core-api/errors'
import { AuthErrorCode } from '@yishan/core-api/business-codes/auth'
import { dateUtils } from '@/modules/iximei_crm/utils/date'

/** 看板查询参数（来自 query string） */
export interface DashboardQuery {
  startDate?: string
  endDate?: string
  hospitalId?: number
  category?: 'oral' | 'plastic' | 'unknown'
  provinceCode?: number | 'missing'
  cityCode?: number | 'missing'
  hospitalScope?: 'period-new'
  status?: number
}

/** 获取客服名下所有客户 ID（用于派单过滤） */
async function ownedCustomerIds(userId: number): Promise<number[]> {
  return DashboardRepository.ownedCustomerIds(userId)
}

/** 获取关联医院所涉客户 ID（用于 hospital_account 客户过滤） */
async function dispatchedCustomerIds(hospitalIds: number[]): Promise<number[]> {
  return DashboardRepository.customerIdsByHospitalIds(hospitalIds)
}

/**
 * 根据角色 + 可选医院筛选生成数据范围过滤函数。
 * - super_admin: 无过滤，除非指定 hospitalId
 * - hospital_account: 只看关联医院的医院/派单/客户
 * - 其他（客服等）: 只看自己名下的客户及其派单
 */
async function dashboardFilters(
  roleIds: ReadonlyArray<number>,
  userId: number,
  hospitalId?: number,
): Promise<{
  customerFilter?: (table: any) => any[]
  dispatchFilter?: (table: any) => any[]
  hospitalFilter?: (table: any) => any[]
}> {
  // super_admin: 看全部，可选按 hospitalId 过滤
  if (roleIds.includes(ROLE_IDS.SUPER_ADMIN)) {
    if (hospitalId) {
      const hf = (t: any) => [eq(t.id, hospitalId)]
      const df = (t: any) => [eq(t.hospitalId, hospitalId)]
      // 客户也需要收敛：仅该医院派单涉及的客户
      const customerIds = await dispatchedCustomerIds([hospitalId])
      const cf = (t: any) =>
        customerIds.length > 0 ? [inArray(t.id, customerIds)] : [eq(t.id, -1)]
      return { hospitalFilter: hf, dispatchFilter: df, customerFilter: cf }
    }
    return {}
  }

  // hospital_account: 只看自己关联的医院
  if (roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) {
    const ids = await HospitalsRepository.accessibleHospitalIds(userId)
    const accessibleIds: number[] = ids.map((x: any) => x.hospitalId)

    // 如果指定了 hospitalId，必须在校验范围内
    if (hospitalId) {
      if (!accessibleIds.includes(hospitalId)) {
        const noop = (t: any) => [eq(t.id, -1)]
        return { customerFilter: noop, dispatchFilter: noop, hospitalFilter: noop }
      }
      const hf = (t: any) => [eq(t.id, hospitalId)]
      const df = (t: any) => [eq(t.hospitalId, hospitalId)]
      return { hospitalFilter: hf, dispatchFilter: df }
    }

    if (!accessibleIds.length) {
      const noop = (t: any) => [eq(t.id, -1)]
      return { customerFilter: noop, dispatchFilter: noop, hospitalFilter: noop }
    }

    // 查询关联医院涉及的客户 ID
    const customerIds = await dispatchedCustomerIds(accessibleIds)

    const hospitalFilter = (t: any) => [inArray(t.id, accessibleIds)]
    const dispatchFilter = (t: any) => [inArray(t.hospitalId, accessibleIds)]
    const customerFilter = (t: any) =>
      customerIds.length > 0 ? [inArray(t.id, customerIds)] : [eq(t.id, -1)]

    return { hospitalFilter, dispatchFilter, customerFilter }
  }

  // 客服/默认 SELF: 只看自己名下的客户及其派单
  const ownedIds = await ownedCustomerIds(userId)

  const customerFilter = (t: any) =>
    ownedIds.length > 0 ? [inArray(t.id, ownedIds)] : [eq(t.id, -1)]

  const dispatchFilter = (t: any) =>
    ownedIds.length > 0
      ? [inArray(t.customerId, ownedIds)]
      : [eq(t.id, -1)]

  // 如果指定了 hospitalId, 叠加医院过滤
  if (hospitalId) {
    const baseDispatchFilter = dispatchFilter
    return {
      customerFilter,
      dispatchFilter: (t: any) => [...baseDispatchFilter(t), eq(t.hospitalId, hospitalId)],
    }
  }

  return { customerFilter, dispatchFilter }
}

/** 校验并构建 DateRange（Asia/Shanghai 时区，半开区间 [start, end+1day)） */
function buildDateRange(startDate?: string, endDate?: string): DateRange | undefined {
  if (!startDate || !endDate) return undefined
  const start = dateUtils.parseShanghaiDate(startDate)
  const end = dateUtils.parseShanghaiDate(endDate)
  if (!start || !end) return undefined
  if (start > end) return undefined
  return { startDate: start, endDate: end }
}

function assertHospitalOverviewAccess(roleIds: ReadonlyArray<number>, scope: DataScopeCode) {
  const isSuperAdmin = roleIds.includes(ROLE_IDS.SUPER_ADMIN)
  if (!isSuperAdmin && roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) {
    throw new BusinessError(AuthErrorCode.FORBIDDEN, 'Hospital accounts cannot access the operations overview')
  }
  if (!isSuperAdmin && scope !== DATA_SCOPE.ALL) {
    throw new BusinessError(AuthErrorCode.FORBIDDEN, 'The current data scope cannot access the operations overview')
  }
}

export class DashboardService {
  static getCapabilities(roleIds: ReadonlyArray<number>, scope: DataScopeCode) {
    return { hospitalOverview: roleIds.includes(ROLE_IDS.SUPER_ADMIN)
      || (!roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT) && scope === DATA_SCOPE.ALL) }
  }

  static async getHospitalOverview(
    _userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
    query: DashboardQuery = {},
  ) {
    assertHospitalOverviewAccess(roleIds, scope)

    const dateRange = buildDateRange(query.startDate, query.endDate)
    const filters = {
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.provinceCode === undefined ? {} : { provinceCode: query.provinceCode }),
      ...(query.cityCode === undefined ? {} : { cityCode: query.cityCode }),
      ...(query.hospitalScope ? { hospitalScope: query.hospitalScope } : {}),
      ...(query.status === undefined ? {} : { status: Number(query.status) }),
    }
    const overview = await DashboardRepository.getHospitalOverview({
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
      category: filters.category,
      provinceCode: filters.provinceCode,
      cityCode: filters.cityCode,
      hospitalScope: filters.hospitalScope,
      status: filters.status,
    })

    return {
      generatedAt: new Date().toISOString(),
      filters,
      ...overview,
    }
  }

  static async getHospitalOverviewDetails(
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
    query: DashboardQuery & { page?: number; pageSize?: number } = {},
  ) {
    void userId
    assertHospitalOverviewAccess(roleIds, scope)
    const dateRange = buildDateRange(query.startDate, query.endDate)
    return DashboardRepository.getHospitalOverviewDetails({
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
      category: query.category,
      provinceCode: query.provinceCode,
      cityCode: query.cityCode,
      hospitalScope: query.hospitalScope,
      status: query.status,
      page: Math.max(1, Number(query.page ?? 1)),
      pageSize: Math.min(100, Math.max(1, Number(query.pageSize ?? 10))),
    })
  }

  static async getStats(
    userId: number,
    roleIds: ReadonlyArray<number>,
    _scope: DataScopeCode,
    query?: DashboardQuery,
  ) {
    const hospitalId = query?.hospitalId ? Number(query.hospitalId) : undefined
    const dateRange = buildDateRange(query?.startDate, query?.endDate)
    const filters = await dashboardFilters(roleIds, userId, hospitalId)

    const [
      hospitalTotal,
      hospitalPeriodNew,
      hospitalWeekNew,
      hospitalActive,
      customerTotal,
      customerPeriodNew,
      customerWeekNew,
      customerDayNew,
      dispatchTotal,
      dispatchPeriodNew,
      dispatchWeekNew,
      dispatchPeriodCompleted,
      customerByStatus,
      dispatchByStatus,
      customerTrend,
      dispatchTrend,
    ] = await Promise.all([
      DashboardRepository.total(crmHospital, filters.hospitalFilter, dateRange),
      DashboardRepository.periodNew(crmHospital, filters.hospitalFilter, dateRange),
      DashboardRepository.weekNew(crmHospital, filters.hospitalFilter, dateRange),
      DashboardRepository.activeHospitals(filters.hospitalFilter, dateRange),
      DashboardRepository.total(crmCustomer, filters.customerFilter, dateRange),
      DashboardRepository.periodNew(crmCustomer, filters.customerFilter, dateRange),
      DashboardRepository.weekNew(crmCustomer, filters.customerFilter, dateRange),
      DashboardRepository.dayNew(crmCustomer, filters.customerFilter, dateRange),
      DashboardRepository.total(crmDispatch, filters.dispatchFilter, dateRange),
      DashboardRepository.periodNew(crmDispatch, filters.dispatchFilter, dateRange),
      DashboardRepository.weekNew(crmDispatch, filters.dispatchFilter, dateRange),
      DashboardRepository.periodCompleted(crmDispatch, filters.dispatchFilter, dateRange),
      DashboardRepository.byStatus(
        crmCustomer, crmCustomerStatus, crmCustomerStatus.name, crmCustomer.statusId,
        filters.customerFilter, dateRange,
      ),
      DashboardRepository.byStatus(
        crmDispatch, crmDispatchStatus, crmDispatchStatus.name, crmDispatch.statusId,
        filters.dispatchFilter, dateRange,
      ),
      DashboardRepository.monthlyTrend(crmCustomer, 12, filters.customerFilter, dateRange),
      DashboardRepository.monthlyTrend(crmDispatch, 12, filters.dispatchFilter, dateRange),
    ])

    const hasDateRange = !!(query?.startDate && query?.endDate)

    return {
      generatedAt: new Date().toISOString(),
      hospitals: {
        total: hospitalTotal,
        periodNew: hospitalPeriodNew,
        activeCount: hospitalActive,
        // 当有日期筛选时，以下字段无意义，设为 0
        monthNew: hasDateRange ? 0 : hospitalPeriodNew,
        weekNew: hasDateRange ? 0 : hospitalWeekNew,
      },
      customers: {
        total: customerTotal,
        periodNew: customerPeriodNew,
        // 当有日期筛选时，weekNew/dayNew 不再填入 period 值
        monthNew: hasDateRange ? 0 : customerPeriodNew,
        weekNew: hasDateRange ? 0 : customerWeekNew,
        dayNew: hasDateRange ? 0 : customerDayNew,
      },
      dispatches: {
        total: dispatchTotal,
        periodNew: dispatchPeriodNew,
        periodCompleted: dispatchPeriodCompleted,
        monthNew: hasDateRange ? 0 : dispatchPeriodNew,
        weekNew: hasDateRange ? 0 : dispatchWeekNew,
        monthCompleted: hasDateRange ? 0 : dispatchPeriodCompleted,
      },
      customerByStatus,
      dispatchByStatus,
      monthlyTrend: {
        customers: customerTrend,
        dispatches: dispatchTrend,
      },
      hospitalRankings: {
        items: await DashboardRepository.getHospitalRankings(10),
        generatedAt: new Date().toISOString(),
      },
      // 医院分布看板（按城市）。super_admin / admin 看全院分布；其他角色
      // 看到的是空数据（前端按角色决定是否渲染卡片）。
      hospitalDistribution: {
        generatedAt: new Date().toISOString(),
        items: roleIds.includes(ROLE_IDS.SUPER_ADMIN) || roleIds.includes(ROLE_IDS.ADMIN)
          ? await DashboardRepository.getHospitalDistributionByCity()
          : [],
      },
    }
  }
}
