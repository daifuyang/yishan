import type { AdminPositionListQuery } from '@/api/admin/position'

export const POSITION_STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

/**
 * 岗位默认按自定义排序号升序（与后端一致）：排序号是岗位显式维护的业务顺序，
 * 时间排序只作为临时查看手段，所以排在选项首位的仍是默认项。
 */
export const POSITION_SORT_OPTIONS = [
  { key: 'sortOrder', label: '自定义排序', field: 'sortOrder', order: 'asc' },
  { key: 'createdDesc', label: '最近创建', field: 'createdAt', order: 'desc' },
  { key: 'createdAsc', label: '最早创建', field: 'createdAt', order: 'asc' },
  { key: 'updated', label: '最近更新', field: 'updatedAt', order: 'desc' },
] as const

export interface PositionFilters {
  status: string
  sort: string
}

export const DEFAULT_POSITION_FILTERS: PositionFilters = {
  status: '',
  sort: 'sortOrder',
}

/** useListPagination 的 filters 是弱类型字典，这里收敛成筛选对象。 */
export function readPositionFilters(filters: Record<string, unknown>): PositionFilters {
  return {
    status:
      typeof filters.status === 'string' ? filters.status : DEFAULT_POSITION_FILTERS.status,
    sort: typeof filters.sort === 'string' ? filters.sort : DEFAULT_POSITION_FILTERS.sort,
  }
}

export function buildPositionQuery(
  page: number,
  pageSize: number,
  keyword: string,
  filters: PositionFilters,
): AdminPositionListQuery {
  const sort =
    POSITION_SORT_OPTIONS.find((option) => option.key === filters.sort) ??
    POSITION_SORT_OPTIONS[0]
  return {
    page,
    pageSize,
    keyword: keyword || undefined,
    status: POSITION_STATUS_OPTIONS.find((option) => option.key === filters.status)?.key || undefined,
    sortBy: sort.field,
    sortOrder: sort.order,
  }
}
