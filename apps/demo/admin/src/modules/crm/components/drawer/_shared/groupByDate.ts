import dayjs from 'dayjs';

/**
 * 按日期分组并产生 label：今天 / 昨天 / 具体日期。
 *
 * 输入：items（任意带 ISO 时间字符串字段的对象数组）+ getTime(item) 取时间。
 * 输出：[{ date, label, items: [...] }]，按 date 倒序。
 *
 * 设计：
 *   - 返回 date 是 ISO 短格式 YYYY-MM-DD；label 是中文人话。
 *   - 复用 dayjs（admin 已有依赖），不引新库。
 *   - 是纯函数；调用方自行渲染 Timeline 节点，不绑视觉。
 */
export interface GroupedByDate<T> {
  /** YYYY-MM-DD 短日期；调用方若要分组 key 也用它。 */
  date: string;
  /** 今天 / 昨天 / YYYY年MM月DD日 */
  label: string;
  items: T[];
}

const dateLabel = (date: string): string => {
  const value = dayjs(date);
  if (value.isSame(dayjs(), 'day')) return `今天 · ${value.format('MM月DD日')}`;
  if (value.isSame(dayjs().subtract(1, 'day'), 'day'))
    return `昨天 · ${value.format('MM月DD日')}`;
  return value.format('YYYY年MM月DD日');
};

export function groupByDate<T>(
  items: T[],
  getTime: (item: T) => string | null | undefined,
): GroupedByDate<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const raw = getTime(item);
    if (!raw) continue;
    const key = dayjs(raw).format('YYYY-MM-DD');
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, grouped]) => ({
      date,
      label: dateLabel(date),
      items: grouped,
    }));
}

/**
 * 给定起止 ISO 字符串，过滤落在区间内（含端点）的项。
 * 起止任一为空字符串则视为该方向不限。
 */
export function filterByDateRange<T>(
  items: T[],
  getTime: (item: T) => string | null | undefined,
  range: { from?: string; to?: string } | null,
): T[] {
  if (!range) return items;
  const from = range.from ? dayjs(range.from).startOf('day') : null;
  const to = range.to ? dayjs(range.to).endOf('day') : null;
  if (!from && !to) return items;
  return items.filter((item) => {
    const raw = getTime(item);
    if (!raw) return false;
    const t = dayjs(raw);
    if (from && t.isBefore(from)) return false;
    if (to && t.isAfter(to)) return false;
    return true;
  });
}
