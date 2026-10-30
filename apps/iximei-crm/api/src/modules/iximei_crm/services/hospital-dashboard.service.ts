/**
 * 医院后台数据看板 service。
 *
 * 访问矩阵（perms 在 route 层强制为 HOSPITAL_DASHBOARD_VIEW）：
 * - SUPER_ADMIN：可看全院汇总（默认）/单医院（?hospitalId=xx）。
 *   不强制必须有 hospitalId，空=全院、非空=单院。
 * - HOSPITAL_ACCOUNT：固定看自己绑定的那家医院。
 *   传 ?hospitalId= 必须等于自己医院，否则 403。
 *   不传 hospitalId（query 字段缺省）→ 自动取自己的医院。
 * - ADMIN/CUSTOMER_SERVICE 等：访问被 route 层 HOSPITAL_DASHBOARD_VIEW perm 拦住，
 *   不到 service 层。这里不再做硬性 assertHospitalAccount 守门。
 *
 * hospitalId 解析顺序：
 *   1. query.hospitalId 显式指定
 *   2. 否则登录账号绑定 (HospitalsRepository.accessibleHospitalIds(userId))
 *   3. 再否则全院 ids（只对 super_admin 走这条；其他角色返回 empty）
 *
 * 这里和访问矩阵强耦合，所以 service 层一并做权限校验（route 层管 perm、service 层管 data scope）。
 */

import { BusinessError } from '@yishan/core-api/errors'
import { AuthErrorCode } from '@yishan/core-api/business-codes/auth'
import { ROLE_IDS } from '@/modules/iximei_crm/role-codes'
import { dateUtils } from '@/modules/iximei_crm/utils/date'
import { HospitalDashboardRepository } from '../repositories/hospital-dashboard.repository.js'
import { HospitalsRepository } from '../repositories/hospitals.repository.js'

/** 全空响应：用户没绑定医院或 SUPER_ADMIN 但系统无医院时返回，避免 SQL 报错。 */
const EMPTY_STATS = {
  todayCount: 0,
  monthCount: 0,
  yearCount: 0,
  totalCount: 0,
  viewedCount: 0,
  unviewedCount: 0,
}

/** 用户没绑定医院时返回的占位 daily：days 个全 0 的日期序列（从最早到今天）。 */
function emptyDaily(days: number) {
  const out: Array<{ date: string; count: number }> = []
  const today = dateUtils.shanghaiDayStart()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    out.push({ date: dateUtils.formatShanghaiYmd(d), count: 0 })
  }
  return out
}

function isSuperAdmin(roleIds: ReadonlyArray<number>): boolean {
  return roleIds.includes(ROLE_IDS.SUPER_ADMIN)
}

function isHospitalAccount(roleIds: ReadonlyArray<number>): boolean {
  return roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)
}

/**
 * Resolve hospitalIds + data scope based on role + query.
 *
 * Returns: { hospitalIds: number[], scope: 'single'|'summary' }
 *
 * Hospital_account 越权时抛 403。
 */
async function resolveHospitalScope(
  userId: number,
  roleIds: ReadonlyArray<number>,
  requestedHospitalId: number | undefined,
  action: 'stats' | 'unviewed-count' | 'trend',
): Promise<{ hospitalIds: number[]; scope: 'single' | 'summary' }> {
  // super_admin：可传?hospitalId=xx,也可不传(全院)
  if (isSuperAdmin(roleIds)) {
    if (requestedHospitalId !== undefined && requestedHospitalId > 0) {
      return { hospitalIds: [requestedHospitalId], scope: 'single' }
    }
    // 不传 / 传 0 / 负数 → 全院 ids
    const all = await HospitalsRepository.allActiveHospitalIds()
    return { hospitalIds: all.map((x) => x.id), scope: 'summary' }
  }

  // hospital_account：看自己那家
  if (isHospitalAccount(roleIds)) {
    const rows = await HospitalsRepository.accessibleHospitalIds(userId)
    const own = rows.map((x: any) => x.hospitalId as number)
    if (own.length === 0) return { hospitalIds: [], scope: 'single' }
    if (requestedHospitalId === undefined || requestedHospitalId <= 0) {
      // 不传 -> 自动用自己的医院(单院)
      return { hospitalIds: [own[0]], scope: 'single' }
    }
    // 传了 -> 必须等于自己医院
    if (!own.includes(requestedHospitalId)) {
      const msg =
        action === 'stats'
          ? '访问其他医院的看板数据'
          : action === 'unviewed-count'
            ? '查看其他医院未查看派单数'
            : '查看其他医院趋势'
      throw new BusinessError(AuthErrorCode.FORBIDDEN, `医院账号只能${msg}`)
    }
    return { hospitalIds: [requestedHospitalId], scope: 'single' }
  }

  // 其它角色理论上被 route 层 perm 拦住,这里兜底 throw
  throw new BusinessError(AuthErrorCode.FORBIDDEN, '当前角色无访问医院看板的权限')
}

export class HospitalDashboardService {
  /**
   * 看板统计 — 6 项指标。
   * role=hospital_account → 自动看本院、不接受跨院。
   * role=super_admin → query.hospitalId 传则单院；不传则全院汇总。
   */
  static async getStats(
    userId: number,
    roleIds: ReadonlyArray<number>,
    query: { hospitalId?: number; startDate?: string; endDate?: string } = {},
  ) {
    const { hospitalIds } = await resolveHospitalScope(userId, roleIds, query.hospitalId, 'stats')
    if (hospitalIds.length === 0) return { ...EMPTY_STATS }
    return HospitalDashboardRepository.getStats(
      hospitalIds,
      query.startDate,
      query.endDate,
    )
  }

  /**
   * 当前登录医院账号的未查看派单数（菜单 Badge 用）。
   * super_admin 默认全院汇总；可传 ?hospitalId= 单院。
   * hospital_account：本院。
   */
  static async getUnviewedCount(
    userId: number,
    roleIds: ReadonlyArray<number>,
    query: { hospitalId?: number } = {},
  ) {
    const { hospitalIds } = await resolveHospitalScope(userId, roleIds, query.hospitalId, 'unviewed-count')
    if (hospitalIds.length === 0) return { count: 0 }
    return { count: await HospitalDashboardRepository.getUnviewedCount(hospitalIds) }
  }

  /**
   * 派单趋势 + statusBreakdown。
   * super_admin 默认全院；hospital_account 只能本院。
   *
   * startDate/endDate 给定时优先于 days(date 序列范围更直观)。
   */
  static async getTrend(
    userId: number,
    roleIds: ReadonlyArray<number>,
    days = 30,
    query: { hospitalId?: number; startDate?: string; endDate?: string } = {},
  ) {
    const { hospitalIds } = await resolveHospitalScope(userId, roleIds, query.hospitalId, 'trend')
    if (hospitalIds.length === 0) {
      return { daily: emptyDaily(days), statusBreakdown: { viewed: 0, unviewed: 0 } }
    }
    return HospitalDashboardRepository.getTrend(
      hospitalIds,
      days,
      query.startDate,
      query.endDate,
    )
  }

  /**
   * 「我最近查看的派单」足迹卡片（首页右下角，任务 4）。
   *
   * - hospital_account：本账号访问过的、本院派单（与现有 scope 一致）
   * - super_admin：本账号访问过的、全院派单
   *
   * 数据来源 crm_dispatch_view_log（每个 (dispatch_id, hospital_id, viewer_user_id) 唯一），
   * 因 site 永远有 unique 约束，view_log.created_at 即"首次查看时间"，无需再聚合。
   *
   * limit 透传给 repo，1 ≤ limit ≤ 50。
   */
  static async getMyRecentViews(
    userId: number,
    roleIds: ReadonlyArray<number>,
    limit: number,
  ): Promise<{
    generatedAt: string
    items: Array<{
      dispatchId: number
      customerName: string
      hospitalName: string
      firstViewedAt: string
    }>
  }> {
    const { hospitalIds } = await resolveHospitalScope(userId, roleIds, undefined, 'stats')
    if (hospitalIds.length === 0) {
      return { generatedAt: new Date().toISOString(), items: [] }
    }
    const rows = await HospitalDashboardRepository.getMyRecentViews(hospitalIds, userId, limit)
    return {
      generatedAt: new Date().toISOString(),
      items: rows.map((r) => ({
        dispatchId: r.dispatchId,
        customerName: r.customerName,
        hospitalName: r.hospitalName,
        firstViewedAt:
          r.firstViewedAt instanceof Date
            ? r.firstViewedAt.toISOString()
            : new Date(r.firstViewedAt).toISOString(),
      })),
    }
  }
}