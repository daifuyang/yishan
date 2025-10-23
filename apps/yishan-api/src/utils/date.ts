import dayjs from 'dayjs'

export const dateUtils = {
  // 格式化为 YYYY-MM-DD（如生日），无值返回 null
  formatDate(value?: Date | string | number | null): string | null {
    if (value == null) return null
    const d = dayjs(value)
    if (!d.isValid()) return null
    return d.format('YYYY-MM-DD')
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
  }
}