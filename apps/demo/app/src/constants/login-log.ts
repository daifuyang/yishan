/**
 * 登录日志列表的状态 / 排序词表。
 *
 * system 列表（服务端筛选）和 profile 列表（客户端筛选）共用同一份枚举与文案：
 * 两页的筛选实现语义不同，但「登录成功/登录失败」「最近/最早登录」这套词必须是同一份，
 * 各写一份会悄悄漂移（加一个状态要改两处）。
 */

export interface LoginLogOption {
  key: string
  label: string
}

/** 状态筛选项：key 为后端状态码（''=全部）。 */
export const LOGIN_LOG_STATUS: LoginLogOption[] = [
  { key: '', label: '全部状态' },
  { key: '1', label: '登录成功' },
  { key: '0', label: '登录失败' },
]

/** 排序筛选项：key 为 sortOrder。 */
export const LOGIN_LOG_SORT: LoginLogOption[] = [
  { key: 'desc', label: '最近登录' },
  { key: 'asc', label: '最早登录' },
]

/** 状态码 → 展示文案；未知状态回退到「全部状态」（空 key 项）。 */
export function loginLogStatusLabel(status: string): string {
  return LOGIN_LOG_STATUS.find((item) => item.key === status)?.label ?? '全部状态'
}

/** sortOrder → 展示文案；未知值回退到默认排序「最近登录」。 */
export function loginLogSortLabel(sort: string): string {
  return LOGIN_LOG_SORT.find((item) => item.key === sort)?.label ?? '最近登录'
}
