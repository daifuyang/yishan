/**
 * 草稿字段的规范形式。
 *
 * 这层存在的理由是一个**生产上无解**的夹缝：草稿里存 ISO 时间戳（模型给的、
 * 原生表单回填的），提交上来的永远是 `YYYY-MM-DD`（HTTP 契约 `format: "date"`），
 * 而草稿一致性比较原本是字符串全等 —— 两种形状比事实，于是每一次带草稿的
 * 创建都被判「与服务端草稿不一致」。
 *
 * 这里的断言守的是**规范形式本身**：什么算一个日期、日期怎么变成 `Date`、
 * 哪些字段算日期字段（从表单契约派生，不另抄一份）。
 */
import { describe, expect, it } from 'vitest'
import { canonicalDateOnly, canonicalDateToLocalDate, dateFormatFieldKeys, formatOf } from '../src/core/services/draft-field-format'
import { UserCreateDraftFieldsSchema } from '../src/core/schemas/user'

describe('canonicalDateOnly', () => {
  it('规范形式原样返回', () => {
    expect(canonicalDateOnly('1996-10-02')).toBe('1996-10-02')
  })

  it('ISO 时间戳取字面日期部分（日期字段没有时刻语义）', () => {
    expect(canonicalDateOnly('1996-10-02T00:00:00.000Z')).toBe('1996-10-02')
    expect(canonicalDateOnly('1996-10-02 08:30:00')).toBe('1996-10-02')
    // 带偏移的写法同样取字面日期：换时区不该换掉用户填的那一天。
    expect(canonicalDateOnly('1996-10-02T23:59:59-05:00')).toBe('1996-10-02')
  })

  it('前后空白不算值', () => {
    expect(canonicalDateOnly('  1996-10-02  ')).toBe('1996-10-02')
  })

  it.each([
    ['1996-13-01', '月份不存在'],
    ['1996-02-31', '日历上不存在这一天'],
    ['1996-00-10', '月份为 0'],
    ['1996-10-02abc', '日期后面跟的不是时间'],
    ['10-02-1996', '不是 ISO 顺序'],
    ['1996/10/02', '分隔符不对'],
    ['', '空串'],
    ['   ', '只有空白'],
  ])('拒绝 %s（%s）', value => {
    expect(canonicalDateOnly(value)).toBeUndefined()
  })

  it('非字符串一律不认', () => {
    expect(canonicalDateOnly(19961002)).toBeUndefined()
    expect(canonicalDateOnly(null)).toBeUndefined()
    expect(canonicalDateOnly(undefined)).toBeUndefined()
    expect(canonicalDateOnly({})).toBeUndefined()
  })
})

describe('canonicalDateToLocalDate', () => {
  it('按本地日历日构造，服务器时区不改变用户填的那一天', () => {
    const date = canonicalDateToLocalDate('1996-10-02')
    expect(date.getFullYear()).toBe(1996)
    expect(date.getMonth()).toBe(9)
    expect(date.getDate()).toBe(2)
  })

  it('跨时区也稳定（对比 UTC 午夜解析会差一天）', () => {
    const canonical = canonicalDateToLocalDate('1996-10-02')
    const utc = new Date('1996-10-02')
    // 规范形式与「用户填的那天」始终一致；UTC 解析在负时区会落到前一天。
    expect(canonical.getDate()).toBe(2)
    expect(utc.getUTCDate()).toBe(2)
  })
})

describe('dateFormatFieldKeys', () => {
  it('从表单契约派生日期字段，不另抄一份清单', () => {
    const keys = dateFormatFieldKeys(UserCreateDraftFieldsSchema.properties as unknown as Record<string, unknown>)
    expect([...keys]).toContain('birthDate')
    expect([...keys]).not.toContain('phone')
    expect([...keys]).not.toContain('deptIds')
  })

  it('联合类型的成员格式也算数（birthDate 是日期与空串的联合）', () => {
    expect(formatOf(UserCreateDraftFieldsSchema.properties.birthDate)).toBe('date')
  })
})
