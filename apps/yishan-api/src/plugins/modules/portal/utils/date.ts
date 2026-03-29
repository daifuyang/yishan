import dayjs from 'dayjs'

export const dateUtils = {
  formatDate(value?: Date | string | number | null): string | null {
    if (value == null) return null
    const d = dayjs(value)
    if (!d.isValid()) return null
    return d.format('YYYY-MM-DD')
  },

  formatISO(value?: Date | string | number | null): string | null {
    if (value == null) return null
    const d = dayjs(value)
    if (!d.isValid()) return null
    return d.toDate().toISOString()
  },

  toDate(value?: Date | string | number | null): Date | null {
    if (value == null) return null
    const d = dayjs(value)
    if (!d.isValid()) return null
    return d.toDate()
  },

  now(): Date {
    return dayjs().toDate()
  },

  nowISO(): string {
    return dayjs().toDate().toISOString()
  },

  nowUnix(): number {
    return dayjs().unix()
  }
}
