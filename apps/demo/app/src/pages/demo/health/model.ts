import type { TagVariant } from '@/components/atoms'

/** 运行时长：一分钟内显示秒，否则按「天 / 时 / 分」拼接并跳过为零的部分（与 PC 端一致）。 */
export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  if (total < 60) return `${total} s`
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`]
    .filter(Boolean)
    .join(' ')
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** 字节数换算为 B / KB / MB / GB / TB，保留两位小数。 */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, Number(bytes) || 0)
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(2)} ${BYTE_UNITS[unit]}`
}

/** 已用内存占比（0–100 的整数百分比）。总量缺失时为 0。 */
export function memoryUsage(memory: { total: number; free: number }): number {
  const total = Number(memory.total) || 0
  if (total <= 0) return 0
  const used = total - (Number(memory.free) || 0)
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)))
}

/** 已用内存字节数，不会小于 0。 */
export function memoryUsed(memory: { total: number; free: number }): number {
  return Math.max(0, (Number(memory.total) || 0) - (Number(memory.free) || 0))
}

/** 运行环境展示文案与标签色。 */
export function envLabel(env: string): { label: string; variant: TagVariant } {
  switch (env) {
    case 'production':
      return { label: '生产', variant: 'success' }
    case 'pre':
      return { label: '预发', variant: 'warning' }
    case 'test':
      return { label: '测试', variant: 'primary' }
    default:
      return { label: '开发', variant: 'default' }
  }
}
