import { describe, expect, it } from 'vitest'
import {
  computeDraftCompletionFields,
  hasDraftValue,
} from '../services/draft-completion.js'

/**
 * 待补全字段的计算规则。
 *
 * 这些规则全部来自**表单契约**（字段、默认值、可写白名单），不按字段名硬编码：
 * 换一张表单、换一个字段名，行为不变。
 */
const form = {
  schemaVersion: 1,
  fields: [
    { name: 'phone', label: '手机号码', required: true, sensitive: false, selector: 'text', constraints: { pattern: '^1\\d{10}$' } },
    { name: 'realName', label: '真实姓名', required: true, sensitive: false, selector: 'text', constraints: {} },
    { name: 'nickname', label: '昵称', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'count', label: '数量', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'enabled', label: '是否启用', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'password', label: '用户密码', required: true, sensitive: true, selector: 'password', constraints: {} },
    { name: 'avatar', label: '头像', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'gender', label: '性别', required: false, sensitive: false, selector: 'enum', constraints: { enum: ['0', '1'] } },
    { name: 'secretNote', label: '内部备注', required: false, sensitive: false, selector: 'text', constraints: {}, hidden: true },
  ],
  defaults: { gender: '0' },
  editableFields: ['phone', 'realName', 'nickname', 'count', 'enabled', 'gender'],
  missingFields: [],
} as unknown as import('@yishan/core-api/ai-capabilities/catalog').AiDraftForm

const names = (fields: { name: string }[]) => fields.map(field => field.name)

describe('draft completion fields', () => {
  it('does not ask again for the values the conversation already collected', () => {
    const fields = computeDraftCompletionFields(form, { phone: '13800000000', realName: '张三' })
    expect(names(fields)).not.toContain('phone')
    expect(names(fields)).not.toContain('realName')
  })

  it('shows every unfilled field at once, optional ones included', () => {
    const fields = computeDraftCompletionFields(form, {})
    expect(names(fields)).toEqual(expect.arrayContaining(['phone', 'realName', 'nickname', 'count', 'enabled', 'password', 'avatar']))
  })

  it('treats 0 and false as filled values', () => {
    expect(hasDraftValue(0)).toBe(true)
    expect(hasDraftValue(false)).toBe(true)
    const fields = computeDraftCompletionFields(form, { count: 0, enabled: false })
    expect(names(fields)).not.toContain('count')
    expect(names(fields)).not.toContain('enabled')
  })

  it('treats an empty string, null and undefined as unfilled', () => {
    expect(hasDraftValue('')).toBe(false)
    expect(hasDraftValue(null)).toBe(false)
    expect(hasDraftValue(undefined)).toBe(false)
    const fields = computeDraftCompletionFields(form, { nickname: '', phone: null, realName: undefined })
    expect(names(fields)).toEqual(expect.arrayContaining(['nickname', 'phone', 'realName']))
  })

  it('honours the defaults declared by the form contract', () => {
    const fields = computeDraftCompletionFields(form, {})
    expect(names(fields)).not.toContain('gender')
  })

  it('never asks for a hidden field', () => {
    const fields = computeDraftCompletionFields(form, {})
    expect(names(fields)).not.toContain('secretNote')
  })

  it('still asks for the sensitive field, but never lets it into the draft', () => {
    const fields = computeDraftCompletionFields(form, {})
    const password = fields.find(field => field.name === 'password')
    expect(password).toBeTruthy()
    expect(password?.sensitive).toBe(true)
    expect(password?.draftWritable).toBe(false)
  })

  it('derives draft writability from the editable whitelist instead of the field name', () => {
    const fields = computeDraftCompletionFields(form, {})
    const avatar = fields.find(field => field.name === 'avatar')
    expect(avatar?.draftWritable).toBe(false)
    const nickname = fields.find(field => field.name === 'nickname')
    expect(nickname?.draftWritable).toBe(true)
  })

  it('brings back a filled but invalid field so the user can correct it', () => {
    const fields = computeDraftCompletionFields(form, { phone: '138' }, [{ field: 'phone' }])
    const phone = fields.find(field => field.name === 'phone')
    expect(phone).toBeTruthy()
    expect(phone?.invalid).toBe(true)
  })

  it('carries the original field definition and constraints through', () => {
    const fields = computeDraftCompletionFields(form, {})
    const phone = fields.find(field => field.name === 'phone')
    expect(phone?.label).toBe('手机号码')
    expect(phone?.required).toBe(true)
    expect(phone?.selector).toBe('text')
    expect(phone?.constraints).toEqual({ pattern: '^1\\d{10}$' })
  })
})
