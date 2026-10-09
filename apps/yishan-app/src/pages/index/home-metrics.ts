/**
 * 首页指标定义（轻量适配层，仅首页使用）。
 * 指标均来自后端真实接口；新增指标时在此登记来源、权限与取值方式即可。
 */
import type { DashboardStats } from '@/api/types'

import type { HomeIconName } from './home-icons'

/** 数据来源：目前仅有 `/api/v1/app/dashboard/stats`（与 PC 仪表盘同源） */
export type MetricSource = 'dashboardStats'

export interface MetricSourceData {
  dashboardStats: DashboardStats
}

export interface HomeMetricDef {
  key: string
  label: string
  unit?: string
  icon: HomeIconName
  source: MetricSource
  /** 访问来源接口所需权限，缺失则不展示 */
  permission: string
  pick: (data: MetricSourceData) => unknown
  /** 明细入口对应的移动端模块；模块未授权或未实现时卡片不可点击 */
  detailModuleId?: string
}

export const MAX_HOME_METRICS = 4

export const HOME_METRICS: readonly HomeMetricDef[] = [
  {
    key: 'userTotal',
    label: '组织成员',
    unit: '人',
    icon: 'users',
    source: 'dashboardStats',
    permission: 'system:dashboard:read',
    pick: (data) => data.dashboardStats.userTotal,
    detailModuleId: 'system-user',
  },
  {
    key: 'deptTotal',
    label: '部门数量',
    unit: '个',
    icon: 'network',
    source: 'dashboardStats',
    permission: 'system:dashboard:read',
    pick: (data) => data.dashboardStats.deptTotal,
    detailModuleId: 'system-dept',
  },
  {
    key: 'todayLogin',
    label: '今日登录',
    unit: '次',
    icon: 'logIn',
    source: 'dashboardStats',
    permission: 'system:dashboard:read',
    pick: (data) => data.dashboardStats.todayLogin,
    detailModuleId: 'system-login-log',
  },
  {
    key: 'online',
    label: '在线用户',
    unit: '人',
    icon: 'activity',
    source: 'dashboardStats',
    permission: 'system:dashboard:read',
    pick: (data) => data.dashboardStats.online,
  },
]

export function getVisibleMetrics(
  permissions?: readonly string[],
  defs: readonly HomeMetricDef[] = HOME_METRICS,
): HomeMetricDef[] {
  if (!permissions) return []
  return defs.filter((def) => permissions.includes(def.permission)).slice(0, MAX_HOME_METRICS)
}

function trimZero(value: string): string {
  return value.replace(/\.0$/, '')
}

/** 真实的 0 显示为 0；非数值（字段缺失等）返回 null，由调用方显示占位符而非 0 */
export function formatMetricValue(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${trimZero((value / 1e8).toFixed(1))}亿`
  if (abs >= 1e4) return `${trimZero((value / 1e4).toFixed(1))}万`
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
