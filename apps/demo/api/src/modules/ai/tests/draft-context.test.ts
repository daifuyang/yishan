import { describe, expect, } from 'vitest'
import { it } from './draft-runtime.js'
import { buildDraftContext } from '../services/draft-context.js'
import type { ActionDraftRecord } from '../repositories/action-draft.repository.js'

describe('operation-specific draft context', () => {
  it('includes department fields and strips fields outside its original business schema', () => {
    const draft = { draftId: 'draft-dept', module: 'system', action: 'department.create', draftVersion: 2, status: 'collecting', formData: { name: '研发部', sort_order: 2, username: 'unrelated', password: 'sensitive' }, missingFields: [], validationErrors: [] } as unknown as ActionDraftRecord
    const context = buildDraftContext([draft])
    expect(context).toContain('name=')
    expect(context).toContain('研发部')
    expect(context).toContain('sort_order=')
    expect(context).not.toContain('unrelated')
    expect(context).not.toContain('sensitive')
  })
})
