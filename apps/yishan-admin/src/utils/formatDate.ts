/**
 * 安全日期格式化 helper。
 *
 * 设计动机：销售截图里「下次跟进」曾出现 `Invalid Date`。ProTable 内置的
 * `valueType: 'dateTime'` 不替我们兜底（空串、非日期字符串、null 都会
 * 直接交给 dayjs，从而渲染 `Invalid Date`），所以必须在渲染前自检。
 *
 * 约定：
 *  - 所有入参一律视为不可信。
 *  - 任何「不是有效日期」的输入 → 返回占位符 `—`，绝不抛错、绝不返回字面 `Invalid Date`。
 *  - `isOverdue` 单独抽出，便于表格里给「下次跟进」打逾期 Tag。
 */

import dayjs from 'dayjs'

const PLACEHOLDER = '—'
const FORMAT = 'YYYY-MM-DD HH:mm:ss'

/** 判断一个值是否能被 dayjs 解析为有效日期。 */
function isValidDateInput(value: unknown): value is string | number | Date {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return false
    // dayjs 对纯字面 'Invalid Date' 仍会通过构造，但 format 时输出 Invalid Date；
    // 这里直接拦截。
    if (trimmed === 'Invalid Date') return false
    const d = dayjs(trimmed)
    return d.isValid()
  }
  if (typeof value === 'number') return Number.isFinite(value) && dayjs(value).isValid()
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  return false
}

export function formatDateTime(value: unknown): string {
  if (!isValidDateInput(value)) return PLACEHOLDER
  return dayjs(value as string | number | Date).format(FORMAT)
}

/**
 * 判断「下次跟进时间」是否已过 `now`。无效输入一律按「未逾期」处理，
 * 避免空字段被误标红。
 */
export function isOverdue(value: unknown, now: number = Date.now()): boolean {
  if (!isValidDateInput(value)) return false
  return dayjs(value as string | number | Date).valueOf() < now
}
