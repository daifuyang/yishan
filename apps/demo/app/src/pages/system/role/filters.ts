import type { AdminRoleListQuery } from '@/api/admin/types'

export const ROLE_STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

export const ROLE_SORT_OPTIONS = [
  { key: 'createdDesc', label: '最近创建', field: 'createdAt', order: 'desc' },
  { key: 'createdAsc', label: '最早创建', field: 'createdAt', order: 'asc' },
  { key: 'updated', label: '最近更新', field: 'updatedAt', order: 'desc' },
] as const

export interface RoleFilters {
  status: string
  sort: string
}

export const DEFAULT_ROLE_FILTERS: RoleFilters = {
  status: '',
  sort: 'createdDesc',
}

/** useListPagination 的 filters 是弱类型字典，这里收敛成筛选对象。 */
export function readRoleFilters(filters: Record<string, unknown>): RoleFilters {
  return {
    status: typeof filters.status === 'string' ? filters.status : DEFAULT_ROLE_FILTERS.status,
    sort: typeof filters.sort === 'string' ? filters.sort : DEFAULT_ROLE_FILTERS.sort,
  }
}

export function buildRoleQuery(
  page: number,
  pageSize: number,
  keyword: string,
  filters: RoleFilters,
): AdminRoleListQuery {
  const sort = ROLE_SORT_OPTIONS.find((option) => option.key === filters.sort) ?? ROLE_SORT_OPTIONS[0]
  return {
    page,
    pageSize,
    keyword: keyword || undefined,
    status: ROLE_STATUS_OPTIONS.find((option) => option.key === filters.status)?.key || undefined,
    sortBy: sort.field,
    sortOrder: sort.order,
  }
}
