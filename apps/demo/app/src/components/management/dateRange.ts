/**
 * 日期区间筛选的纯函数工具。
 *
 * 不依赖 React / Taro，可被页面自己的 query 模块直接引用并单测加载；
 * 展示层由 DateRangeSheet 负责。
 */

export interface DateRange {
  startDate: string
  endDate: string
}

export interface DateRangePreset {
  key: string
  label: string
}

/** 快捷区间。key 为 'custom' 时由 DateRangeSheet 展开手工日期，其余按天数回溯。 */
export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  { key: 'all', label: '不限' },
  { key: '1', label: '今天' },
  { key: '7', label: '近7天' },
  { key: '30', label: '近30天' },
  { key: 'custom', label: '自定义' },
]

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 快捷区间 → 具体日期。'all' 表示不限，数字 key 表示含今天在内的回溯天数。 */
export function dateRangePreset(key: string, now = new Date()): DateRange {
  if (key === 'all') return { startDate: '', endDate: '' }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (Number(key) - 1))
  return { startDate: localDate(start), endDate: localDate(now) }
}

/**
 * YYYY-MM-DD → 本地时区边界 ISO 时间（结束日取 23:59:59.999）。
 * 空值或非法日期返回 undefined，供查询层直接透传。
 */
export function parseDateBoundary(value: string, end = false): string | undefined {
  if (!value) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(
    year,
    month - 1,
    day,
    end ? 23 : 0,
    end ? 59 : 0,
    end ? 59 : 0,
    end ? 999 : 0,
  )
  if (parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month || parsed.getDate() !== day) {
    return undefined
  }
  return parsed.toISOString()
}

/**
 * 校验日期区间，返回错误文案；通过时返回空串。
 *
 * allowPartial 为真时允许只填一端（如登录日志），否则两端必填（如用户创建时间）。
 */
export function validateDateRange(start: string, end: string, allowPartial = false): string {
  if (start && !parseDateBoundary(start)) return '请选择有效日期'
  if (end && !parseDateBoundary(end, true)) return '请选择有效日期'
  if (!start && !end) return ''
  if (!allowPartial && (!start || !end)) return '请选择开始和结束日期'
  if (start && end && start > end) return '开始日期不能晚于结束日期'
  return ''
}
