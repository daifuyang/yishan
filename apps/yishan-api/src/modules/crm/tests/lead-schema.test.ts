import { describe, expect, it } from 'vitest'
import { Value } from '@sinclair/typebox/value'
import {
  LeadConvertReqSchema,
  LeadDisqualifyReqSchema,
  LeadQualificationReqSchema,
  LeadReactivateReqSchema,
  LEAD_DISQUALIFY_CODES,
} from '../schemas/lead.schema.js'

describe('线索生命周期 schema 契约', () => {
  it('拒绝非标准作废原因代码与空资格证据', () => {
    expect(Value.Check(LeadDisqualifyReqSchema, { code: 'maybe', reason: '拒绝' })).toBe(false)
    expect(Value.Check(LeadDisqualifyReqSchema, { code: 'duplicate', reason: '' })).toBe(false)
    expect(Value.Check(LeadQualificationReqSchema, { evidence: '', nextAction: '下周回访' })).toBe(false)
    expect(Value.Check(LeadQualificationReqSchema, { evidence: 'ok', nextAction: '' })).toBe(false)
  })

  it('作废原因 code 必须是七选一的标准码', () => {
    for (const code of LEAD_DISQUALIFY_CODES) {
      expect(Value.Check(LeadDisqualifyReqSchema, { code, reason: '本年度无采购计划' })).toBe(true)
    }
    expect(Value.Check(LeadDisqualifyReqSchema, { code: 'random_code', reason: '解释' })).toBe(false)
  })

  it('重新激活必须提供原因，且不能为空字符串', () => {
    expect(Value.Check(LeadReactivateReqSchema, { reason: '客户已重新接洽' })).toBe(true)
    expect(Value.Check(LeadReactivateReqSchema, { reason: '' })).toBe(false)
    // 全空白由 service 层 trim() 后再判断，schema 只承担"非空字符串"约束。
  })

  it('转化请求必须同时选择客户与联系人', () => {
    expect(
      Value.Check(LeadConvertReqSchema, {
        customer: { mode: 'existing', customerId: 10 },
      }),
    ).toBe(false)

    expect(
      Value.Check(LeadConvertReqSchema, {
        contact: { mode: 'create', name: '王伟', mobile: '13800000000' },
      }),
    ).toBe(false)

    expect(
      Value.Check(LeadConvertReqSchema, {
        customer: { mode: 'create', name: '上海示例', type: 'enterprise', phone: '021-12345678' },
        contact: { mode: 'create', name: '王伟', mobile: '13800000000' },
      }),
    ).toBe(true)

    expect(
      Value.Check(LeadConvertReqSchema, {
        customer: { mode: 'existing', customerId: 0 },
        contact: { mode: 'create', name: '王伟' },
      }),
    ).toBe(false)
  })
})
