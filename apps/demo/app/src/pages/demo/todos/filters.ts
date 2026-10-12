import type { DemoTodoListQuery } from '@/api/demo'

/** 选项 key 即后端状态码；空串表示不按状态筛选。 */
export const TODO_STATUS_OPTIONS = [
  { key: '', label: '全部' },
  { key: '0', label: '待办' },
  { key: '1', label: '进行中' },
  { key: '2', label: '已完成' },
] as const

export interface TodoFilters {
  status: string
}

export const DEFAULT_TODO_FILTERS: TodoFilters = {
  status: '',
}

/** useListPagination 的 filters 是弱类型字典，这里收敛成筛选对象。 */
export function readTodoFilters(filters: Record<string, unknown>): TodoFilters {
  return {
    status: typeof filters.status === 'string' ? filters.status : DEFAULT_TODO_FILTERS.status,
  }
}

export function buildTodoQuery(
  page: number,
  pageSize: number,
  keyword: string,
  filters: TodoFilters,
): DemoTodoListQuery {
  const status = TODO_STATUS_OPTIONS.find((option) => option.key === filters.status)?.key
  return {
    page,
    pageSize,
    keyword: keyword || undefined,
    status: status ? (Number(status) as 0 | 1 | 2) : undefined,
  }
}
