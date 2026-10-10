/**
 * 期间 / 池内时长 计算工具。
 *
 * 业务动机：CRM 需要把"客户在公海里待了多久"、"两次跟进之间隔了多少天"
 * 这种期间语义集中表达，不在 service 内各自拼 dayjs。
 *
 * 所有函数以 number (millis) 为内部表示；只有展示 / SQL 边界才转 Date。
 *
 * 包含：
 *   - durationMs(start, end)  安全取差值，end < start → 0
 *   - daysBetween(start, end) 整天数差（向下取整）
 *   - hoursBetween(start, end)
 *   - overlaps(aStart, aEnd, bStart, bEnd)  期间 [a, b) 是否相交
 *   - poolDurationHours(enteredAt, now)   公海内小时数
 *   - clampToRange(value, min, max)        钳位
 */

export type DateInput = Date | string | number | null | undefined

function toMs(value: DateInput): number | null {
  if (value == null) return null
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  const ms = typeof value === 'number' ? value : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

/** 期间差值（毫秒）；end < start 时返回 0。任一端为 null 时返回 0。 */
export function durationMs(start: DateInput, end: DateInput): number {
  const s = toMs(start)
  const e = toMs(end)
  if (s == null || e == null) return 0
  return Math.max(0, e - s)
}

/** 整天数差（向下取整）；不足一天按 0 计。 */
export function daysBetween(start: DateInput, end: DateInput): number {
  return Math.floor(durationMs(start, end) / (24 * 60 * 60 * 1000))
}

/** 整小时差（向下取整）。 */
export function hoursBetween(start: DateInput, end: DateInput): number {
  return Math.floor(durationMs(start, end) / (60 * 60 * 1000))
}

/**
 * 期间 [aStart, aEnd) 与 [bStart, bEnd) 是否相交。
 *
 * 半开区间约定：aEnd === bStart 时**不**算相交（连续无重叠）。
 * 任一端为 null → 返回 false。
 */
export function overlaps(
  aStart: DateInput,
  aEnd: DateInput,
  bStart: DateInput,
  bEnd: DateInput,
): boolean {
  const as = toMs(aStart)
  const ae = toMs(aEnd)
  const bs = toMs(bStart)
  const be = toMs(bEnd)
  if (as == null || ae == null || bs == null || be == null) return false
  return as < be && bs < ae
}

/**
 * 公海内小时数：
 *   - enteredAt 为 null 表示从未进入公海 → 0
 *   - now 为 null → 0
 *   - 累计时长含小数（用于精细展示），但 service 内常配 `floor` 后入库
 */
export function poolDurationHours(enteredAt: DateInput, now: DateInput): number {
  const ms = durationMs(enteredAt, now)
  return ms / (60 * 60 * 1000)
}

/** 钳位：value < min → min；value > max → max；否则原值。 */
export function clampToRange(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * 是否在某个时间窗口之前（用于"超期"判断）。
 * 边界：now === plannedAt 视为未到（不在之前）。
 */
export function isBefore(plannedAt: DateInput, now: DateInput): boolean {
  const p = toMs(plannedAt)
  const n = toMs(now)
  if (p == null || n == null) return false
  return n < p
}

/** 是否已超期（与 isBefore 相反；用于显示 overdue）。 */
export function isOverdue(plannedAt: DateInput, now: DateInput): boolean {
  const p = toMs(plannedAt)
  const n = toMs(now)
  if (p == null || n == null) return false
  return n > p
}

export const DateRange = {
  durationMs,
  daysBetween,
  hoursBetween,
  overlaps,
  poolDurationHours,
  clampToRange,
  isBefore,
  isOverdue,
}
