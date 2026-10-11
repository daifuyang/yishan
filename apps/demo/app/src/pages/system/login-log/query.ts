import { parseDateBoundary, validateDateRange } from '@/components/management/dateRange'

/** 登录日志允许只填一端；非法或反向区间在此抛错，由调用方转成提示。 */
export function loginLogTimeRange(start: string, end: string) {
  const error = validateDateRange(start, end, true);
  if (error) throw new Error(error);
  return { startTime: parseDateBoundary(start), endTime: parseDateBoundary(end, true) };
}

import type { AdminLoginLogListQuery } from '@/api/admin/types'

export function buildLoginLogQuery(page: number, pageSize: number, keyword: string, filters: Record<string, unknown>): AdminLoginLogListQuery {
  return {
    page, pageSize, keyword: keyword || undefined,
    status: filters.status === '0' || filters.status === '1' ? filters.status : undefined,
    sortBy: 'createdAt' as const,
    sortOrder: filters.sort === 'asc' ? 'asc' as const : 'desc' as const,
    ...loginLogTimeRange(String(filters.startDate || ''), String(filters.endDate || '')),
  }
}

