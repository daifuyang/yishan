import type { AdminUserListQuery } from '@/api/admin/types'

export const USER_STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
  { key: '2', label: '锁定' },
] as const

export const USER_SORT_OPTIONS = [
  { key: 'createdDesc', label: '最近创建', field: 'createdAt', order: 'desc' },
  { key: 'createdAsc', label: '最早创建', field: 'createdAt', order: 'asc' },
  { key: 'updated', label: '最近更新', field: 'updatedAt', order: 'desc' },
  { key: 'lastLogin', label: '最近登录', field: 'lastLoginTime', order: 'desc' },
  { key: 'loginCount', label: '登录次数最多', field: 'loginCount', order: 'desc' },
] as const

export interface UserFilters {
  status: string
  sort: string
  startDate: string
  endDate: string
}

export const DEFAULT_USER_FILTERS: UserFilters = {
  status: '',
  sort: 'createdDesc',
  startDate: '',
  endDate: '',
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function datePreset(key: string, now = new Date()) {
  if (key === 'all') return { startDate: '', endDate: '' }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (Number(key) - 1))
  return { startDate: localDate(start), endDate: localDate(now) }
}

export function validateDateRange(start: string, end: string) {
  if (!start && !end) return ''
  if (!start || !end) return '请选择开始和结束日期'
  if (start > end) return '结束日期不能早于开始日期'
  return ''
}

function dateBoundary(value: string, end = false) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(
    year,
    month - 1,
    day,
    end ? 23 : 0,
    end ? 59 : 0,
    end ? 59 : 0,
    end ? 999 : 0,
  ).toISOString()
}

export function buildUserQuery(
  page: number,
  pageSize: number,
  keyword: string,
  filters: UserFilters,
): AdminUserListQuery {
  const sort =
    USER_SORT_OPTIONS.find((option) => option.key === filters.sort) ?? USER_SORT_OPTIONS[0]
  return {
    page,
    pageSize,
    keyword: keyword || undefined,
    status: USER_STATUS_OPTIONS.find((option) => option.key === filters.status)?.key || undefined,
    sortBy: sort.field,
    sortOrder: sort.order,
    startTime: filters.startDate ? dateBoundary(filters.startDate) : undefined,
    endTime: filters.endDate ? dateBoundary(filters.endDate, true) : undefined,
  }
}
