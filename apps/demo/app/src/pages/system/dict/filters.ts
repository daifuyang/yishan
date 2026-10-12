import type { AdminDictTypeListQuery } from '@/api/admin/types'

export const DICT_STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

/**
 * 字典类型与字典项共用一套筛选：两者默认都按排序号升序（与后端一致），
 * 字典项由 buildDictQuery 的调用方再补上 typeId。
 */
export const DICT_SORT_OPTIONS = [
  { key: 'sortOrder', label: '自定义排序', field: 'sortOrder', order: 'asc' },
  { key: 'createdDesc', label: '最近创建', field: 'createdAt', order: 'desc' },
  { key: 'createdAsc', label: '最早创建', field: 'createdAt', order: 'asc' },
  { key: 'updated', label: '最近更新', field: 'updatedAt', order: 'desc' },
] as const

export interface DictFilters {
  status: string
  sort: string
}

export const DEFAULT_DICT_FILTERS: DictFilters = {
  status: '',
  sort: 'sortOrder',
}

/** useListPagination 的 filters 是弱类型字典，这里收敛成筛选对象。 */
export function readDictFilters(filters: Record<string, unknown>): DictFilters {
  return {
    status: typeof filters.status === 'string' ? filters.status : DEFAULT_DICT_FILTERS.status,
    sort: typeof filters.sort === 'string' ? filters.sort : DEFAULT_DICT_FILTERS.sort,
  }
}

export function buildDictQuery(
  page: number,
  pageSize: number,
  keyword: string,
  filters: DictFilters,
): AdminDictTypeListQuery {
  const sort =
    DICT_SORT_OPTIONS.find((option) => option.key === filters.sort) ?? DICT_SORT_OPTIONS[0]
  // 字典的状态用数字，与用户/角色/部门的字符串状态不同
  const status = DICT_STATUS_OPTIONS.find((option) => option.key === filters.status)?.key
  return {
    page,
    pageSize,
    keyword: keyword || undefined,
    status: status === '1' ? 1 : status === '0' ? 0 : undefined,
    sortBy: sort.field,
    sortOrder: sort.order,
  }
}
