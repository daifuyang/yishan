/**
 * 通用格式化
 */

/**
 * 格式化日期时间
 *  - 不传返回 '-'
 *  - 只传日期返回 'YYYY-MM-DD'
 *  - 完整 ISO 返回 'YYYY-MM-DD HH:mm'
 */
export function formatDateTime(input?: string | number | Date | null): string {
  if (!input) return '-'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  return `${y}-${m}-${day} ${hh}:${mm}`
}

export function formatDate(input?: string | number | Date | null): string {
  if (!input) return '-'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  return `${y}-${m}-${day}`
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

/** 取首字（用于头像缺图占位） */
export function firstChar(text?: string | null): string {
  if (!text) return '?'
  return text.charAt(0).toUpperCase()
}
