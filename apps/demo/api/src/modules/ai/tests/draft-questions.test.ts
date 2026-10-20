import { describe, expect, it } from 'vitest'
import { DraftQuestionService } from '../services/draft-question.service.js'
import type { ActionDraft } from '../services/action-draft.service.js'

function fixture(multiple = true) {
  let row: ActionDraft = {
    draftId: 'd1', conversationId: 'c1', ownerId: 7, module: 'system', action: 'user.create',
    schemaVersion: 1, formData: {}, draftVersion: 3, status: 'collecting', missingFields: [], validationErrors: [],
    resultRef: null, failureReason: null, expiresAt: new Date('2099-01-01'), createdAt: new Date(), updatedAt: new Date(),
  }
  let permitted = true
  const drafts = {
    async get(owner: number) { if (owner !== row.ownerId) throw Object.assign(new Error('草稿不存在'), { statusCode: 404 }); return structuredClone(row) },
    async patch(_owner: number, _id: string, version: number, fields: Record<string, unknown>) {
      if (version !== row.draftVersion) throw Object.assign(new Error('版本冲突'), { statusCode: 409 })
      row = { ...row, formData: { ...row.formData, ...fields }, draftVersion: version + 1 }
      return row
    },
  }
  const service = new DraftQuestionService(drafts, async () => {
    if (!permitted) throw Object.assign(new Error('权限已收回'), { statusCode: 403 })
    return [{ field: 'deptIds', title: '选择归属部门', multiple, allowEmpty: true, options: [{ value: 10, label: '销售部 / 张三' }, { value: 11, label: '研发部 / 张三' }] }]
  })
  const subject = { actorId: 7 }
  const answer = { conversationId: 'c1', questionId: 'd1:3:deptIds', draftVersion: 3, values: [11] }
  return { service, subject, answer, row: () => row, revoke: () => { permitted = false }, close: () => { row.status = 'completed' } }
}

describe('draft questions', () => {
  it('stores single-choice answers as a scalar and replays without another patch', async () => {
    const f = fixture(false)
    expect(await f.service.answer(f.subject, 'd1', f.answer)).toMatchObject({ draftVersion: 4, formData: { deptIds: 11 } })
    expect(await f.service.answer(f.subject, 'd1', f.answer)).toMatchObject({ draftVersion: 4 })
  })
  it('binds options to draft version and saves the explicit selection only once', async () => {
    const f = fixture()
    expect(await f.service.list(f.subject, 'c1', 'd1')).toMatchObject({ questions: [{ questionId: 'd1:3:deptIds', draftVersion: 3, options: [{ value: 10 }, { value: 11 }] }] })
    expect(await f.service.answer(f.subject, 'd1', f.answer)).toMatchObject({ draftVersion: 4, formData: { deptIds: [11] } })
    expect(await f.service.answer(f.subject, 'd1', f.answer)).toMatchObject({ draftVersion: 4 })
  })

  it('rejects forged candidates and question identities without changing the draft', async () => {
    const f = fixture()
    await expect(f.service.answer(f.subject, 'd1', { ...f.answer, values: [99] })).rejects.toMatchObject({ statusCode: 400 })
    await expect(f.service.answer(f.subject, 'd1', { ...f.answer, questionId: 'd1:3:password' })).rejects.toMatchObject({ statusCode: 409 })
    expect(f.row().draftVersion).toBe(3)
  })

  it('rejects cross-user, cross-conversation and stale answers', async () => {
    const f = fixture()
    await expect(f.service.list({ actorId: 8 }, 'c1', 'd1')).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.service.answer(f.subject, 'd1', { ...f.answer, conversationId: 'c2' })).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.service.answer(f.subject, 'd1', { ...f.answer, draftVersion: 2 })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rechecks permission for answers and replay, and refuses closed drafts', async () => {
    const f = fixture()
    await f.service.answer(f.subject, 'd1', f.answer)
    f.revoke()
    await expect(f.service.answer(f.subject, 'd1', f.answer)).rejects.toMatchObject({ statusCode: 403 })
    const closed = fixture()
    closed.close()
    await expect(closed.service.answer(closed.subject, 'd1', closed.answer)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('accepts an explicit empty selection and rejects duplicate or coerced ids', async () => {
    const f = fixture()
    await expect(f.service.answer(f.subject, 'd1', { ...f.answer, values: [10, 10] })).rejects.toMatchObject({ statusCode: 400 })
    expect(await f.service.answer(f.subject, 'd1', { ...f.answer, values: [] })).toMatchObject({ formData: { deptIds: [] } })
  })
})
