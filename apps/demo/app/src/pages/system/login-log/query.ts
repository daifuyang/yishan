export function loginLogTimeRange(start: string, end: string) {
  const parse = (value: string, endOfDay: boolean) => {
    if (!value) return undefined;
    const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.getFullYear() !== Number(value.slice(0, 4)) ||
      parsed.getMonth() + 1 !== Number(value.slice(5, 7)) ||
      parsed.getDate() !== Number(value.slice(8, 10))
    )
      throw new Error("请选择有效日期");
    return parsed.toISOString();
  };
  const startTime = parse(start, false);
  const endTime = parse(end, true);
  if (startTime && endTime && startTime > endTime) throw new Error("开始日期不能晚于结束日期");
  return { startTime, endTime };
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

