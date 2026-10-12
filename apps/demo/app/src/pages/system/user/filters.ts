import type { AdminUserListQuery } from '@/api/admin/types'
import { parseDateBoundary } from '@/components/management/dateRange'

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

/** useListPagination 的 filters 是弱类型字典，这里收敛成筛选对象。 */
export function readUserFilters(filters: Record<string, unknown>): UserFilters {
  return {
    status: typeof filters.status === 'string' ? filters.status : DEFAULT_USER_FILTERS.status,
    sort: typeof filters.sort === 'string' ? filters.sort : DEFAULT_USER_FILTERS.sort,
    startDate: typeof filters.startDate === 'string' ? filters.startDate : '',
    endDate: typeof filters.endDate === 'string' ? filters.endDate : '',
  }
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
    startTime: parseDateBoundary(filters.startDate),
    endTime: parseDateBoundary(filters.endDate, true),
  }
}
