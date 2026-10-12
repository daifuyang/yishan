import type { AdminDeptListQuery } from '@/api/admin/types'

export const DEPT_STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

/**
 * 部门默认按排序号升序（与后端一致）：层级顺序由排序号维护，
 * 时间排序只作为临时查看手段，所以默认项仍是自定义排序。
 */
export const DEPT_SORT_OPTIONS = [
  { key: 'sortOrder', label: '自定义排序', field: 'sortOrder', order: 'asc' },
  { key: 'createdDesc', label: '最近创建', field: 'createdAt', order: 'desc' },
  { key: 'createdAsc', label: '最早创建', field: 'createdAt', order: 'asc' },
  { key: 'updated', label: '最近更新', field: 'updatedAt', order: 'desc' },
] as const

export interface DeptFilters {
  status: string
  sort: string
}

export const DEFAULT_DEPT_FILTERS: DeptFilters = {
  status: '',
  sort: 'sortOrder',
}

/** useListPagination 的 filters 是弱类型字典，这里收敛成筛选对象。 */
export function readDeptFilters(filters: Record<string, unknown>): DeptFilters {
  return {
    status: typeof filters.status === 'string' ? filters.status : DEFAULT_DEPT_FILTERS.status,
    sort: typeof filters.sort === 'string' ? filters.sort : DEFAULT_DEPT_FILTERS.sort,
  }
}

export function buildDeptQuery(
  page: number,
  pageSize: number,
  keyword: string,
  filters: DeptFilters,
): AdminDeptListQuery {
  const sort =
    DEPT_SORT_OPTIONS.find((option) => option.key === filters.sort) ?? DEPT_SORT_OPTIONS[0]
  return {
    page,
    pageSize,
    keyword: keyword || undefined,
    status: DEPT_STATUS_OPTIONS.find((option) => option.key === filters.status)?.key || undefined,
    sortBy: sort.field,
    sortOrder: sort.order,
  }
}
