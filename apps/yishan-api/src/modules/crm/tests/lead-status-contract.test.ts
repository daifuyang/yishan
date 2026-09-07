import { describe, expect, it } from 'vitest'
import { Value } from '@sinclair/typebox/value'
import { LeadActivityCreateReqSchema } from '../schemas/lead.schema.js'

describe('lead follow-up status contract', () => {
  it('accepts only the four user-selectable follow-up statuses', () => {
    expect(Value.Check(LeadActivityCreateReqSchema, {
      type: 'phone', content: '已联系', followUpStatus: 'contact_valid',
    })).toBe(true)
    expect(Value.Check(LeadActivityCreateReqSchema, {
      type: 'phone', content: '已联系', followUpStatus: 'processing',
    })).toBe(false)
  })
})
