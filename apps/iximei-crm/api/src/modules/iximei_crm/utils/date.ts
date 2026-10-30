import dayjs from 'dayjs'

/** Asia/Shanghai has no DST; wall-clock offset is always UTC+8. */
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const SHANGHAI_TZ = 'Asia/Shanghai'

function zonedParts(
  date: Date,
  timeZone: string,
  withTime = false,
): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime
      ? {
          hour: '2-digit' as const,
          minute: '2-digit' as const,
          second: '2-digit' as const,
          hourCycle: 'h23' as const,
        }
      : {}),
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: withTime ? get('hour') : 0,
    minute: withTime ? get('minute') : 0,
    second: withTime ? get('second') : 0,
  }
}

function zonedYmd(date: Date, timeZone: string) {
  const { year, month, day } = zonedParts(date, timeZone)
  return { year, month, day }
}

function shanghaiWallToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - SHANGHAI_OFFSET_MS)
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export const dateUtils = {
  // 格式化为 YYYY-MM-DD（如生日），按 Asia/Shanghai 日历日，无值返回 null
  formatDate(value?: Date | string | number | null): string | null {
    if (value == null) return null
    const d = dayjs(value)
    if (!d.isValid()) return null
    return dateUtils.formatShanghaiYmd(d.toDate())
  },

  // 格式化为 ISO 字符串（UTC），无值返回 null
  formatISO(value?: Date | string | number | null): string | null {
    if (value == null) return null
    const d = dayjs(value)
    if (!d.isValid()) return null
    // 使用原生 Date 的 toISOString 保持与现有数据一致
    return d.toDate().toISOString()
  },

  // 转换为 Date，非法或无值返回 null
  toDate(value?: Date | string | number | null): Date | null {
    if (value == null) return null
    const d = dayjs(value)
    if (!d.isValid()) return null
    return d.toDate()
  },

  // 当前时间的 Date
  now(): Date {
    return dayjs().toDate()
  },

  // 当前时间 ISO 字符串
  nowISO(): string {
    return dayjs().toDate().toISOString()
  },

  // 当前时间的秒级时间戳（10位）
  nowUnix(): number {
    return dayjs().unix()
  },

  formatShanghaiYmd(date: Date): string {
    const { year, month, day } = zonedYmd(date, SHANGHAI_TZ)
    return formatYmd(year, month, day)
  },

  /** YYYY-MM-DD HH:mm:ss in Asia/Shanghai — MySQL DATETIME wall-clock. */
  formatShanghaiDateTime(date: Date): string {
    const { year, month, day, hour, minute, second } = zonedParts(date, SHANGHAI_TZ, true)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${formatYmd(year, month, day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`
  },

  /**
   * Parse a MySQL DATETIME wall-clock string as Asia/Shanghai.
   * Drizzle's mysql2 driver typeCasts DATETIME to 'YYYY-MM-DD HH:mm:ss' and
   * the default mapper appends Z (UTC), which shifts China times by 8 hours.
   */
  parseMysqlDateTime(value: unknown): Date {
    if (value instanceof Date) return value
    const raw = String(value).trim()
    const normalized = raw.replace(' ', 'T')
    if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(normalized)) return new Date(normalized)
    return new Date(`${normalized}+08:00`)
  },

  /** YYYY-MM-DD → that calendar day's 00:00 in Asia/Shanghai. Invalid → null. */
  parseShanghaiDate(dateStr: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
    const [year, month, day] = dateStr.split('-').map(Number)
    const dt = shanghaiWallToUtc(year, month, day)
    if (dateUtils.formatShanghaiYmd(dt) !== dateStr) return null
    return dt
  },

  shanghaiDayStart(date: Date = new Date()): Date {
    const { year, month, day } = zonedYmd(date, SHANGHAI_TZ)
    return shanghaiWallToUtc(year, month, day)
  },

  shanghaiNextDayStart(date: Date = new Date()): Date {
    return new Date(dateUtils.shanghaiDayStart(date).getTime() + 86400000)
  },

  shanghaiMonthStart(date: Date = new Date()): Date {
    const { year, month } = zonedYmd(date, SHANGHAI_TZ)
    return shanghaiWallToUtc(year, month, 1)
  },

  shanghaiYearStart(date: Date = new Date()): Date {
    const { year } = zonedYmd(date, SHANGHAI_TZ)
    return shanghaiWallToUtc(year, 1, 1)
  },

  /** Monday 00:00 Asia/Shanghai of the week containing `date`. */
  shanghaiWeekStart(date: Date = new Date()): Date {
    const start = dateUtils.shanghaiDayStart(date)
    const { year, month, day } = zonedYmd(date, SHANGHAI_TZ)
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    const diff = dow === 0 ? 6 : dow - 1
    return new Date(start.getTime() - diff * 86400000)
  },

  shanghaiAddMonths(date: Date, delta: number): Date {
    const { year, month } = zonedYmd(date, SHANGHAI_TZ)
    const idx = year * 12 + (month - 1) + delta
    const y = Math.floor(idx / 12)
    const m = (idx % 12) + 1
    return shanghaiWallToUtc(y, m, 1)
  },
}
