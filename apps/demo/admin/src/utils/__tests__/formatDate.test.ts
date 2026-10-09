/**
 * 安全日期格式化 helper 的单元测试。
 *
 * 背景：销售截图里「下次跟进」出现 `Invalid Date`。原因通常来自后端
 * 序列化的空字符串或被错误解析的日期字符串。ProTable 的内置
 * `valueType: 'dateTime'` 不替我们兜底，必须在渲染前自检。
 */

import { formatDateTime, isOverdue } from '@/utils/formatDate'

describe('formatDateTime —— 安全日期渲染', () => {
  it('对 null / undefined 返回占位符，绝不输出 Invalid Date', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
  })

  it('对空字符串 / 非法字符串返回占位符', () => {
    expect(formatDateTime('')).toBe('—')
    expect(formatDateTime('Invalid Date')).toBe('—')
    expect(formatDateTime('not-a-date')).toBe('—')
  })

  it('对合法 ISO 字符串返回 YYYY-MM-DD HH:mm:ss', () => {
    expect(formatDateTime('2026-09-06T10:30:00.000Z')).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    )
  })

  it('对合法 Date 对象也正确格式化', () => {
    const d = new Date('2026-01-02T03:04:05.000Z')
    expect(formatDateTime(d)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})

describe('isOverdue —— 下次跟进是否已逾期', () => {
  const now = new Date('2026-09-06T10:00:00.000Z').getTime()

  it('null / undefined / 空值 不算逾期', () => {
    expect(isOverdue(null, now)).toBe(false)
    expect(isOverdue(undefined, now)).toBe(false)
    expect(isOverdue('', now)).toBe(false)
    expect(isOverdue('Invalid Date', now)).toBe(false)
  })

  it('过去时间 算逾期', () => {
    expect(isOverdue('2026-09-05T10:00:00.000Z', now)).toBe(true)
  })

  it('未来时间 不算逾期', () => {
    expect(isOverdue('2026-09-07T10:00:00.000Z', now)).toBe(false)
  })
})
