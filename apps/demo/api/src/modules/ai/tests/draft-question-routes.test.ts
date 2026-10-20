import Fastify from 'fastify'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { errorHandlerPlugin, swaggerPlugin } from '@yishan/core-api/plugins'
import questionRoutes from '../routes/v1/questions.js'
import { DraftQuestionService } from '../services/draft-question.service.js'

async function appFor(status = 200) {
  const app = Fastify()
  await app.register(swaggerPlugin)
  await app.register(errorHandlerPlugin, { production: true })
  app.decorate('authenticate', async request => { Object.assign(request, { currentUser: { id: 7 }, tokenScope: ['ai:chat:use', 'system:user:create'] }) })
  app.decorate('requirePermission', permission => {
    expect(permission.code).toBe('ai:chat:use')
    return async () => { if (status !== 200) throw Object.assign(new Error('无权使用'), { statusCode: status }) }
  })
  await app.register(questionRoutes)
  return app
}
const body = { conversationId: 'c1', questionId: 'd1:3:deptIds', draftVersion: 3, values: [10] }

describe('Question HTTP boundary', () => {
  it('preserves candidate hierarchy in the HTTP response', async () => {
    const options = [{ value: 1, label: '公司' }, { value: 2, label: '销售部', parentValue: 1 }]
    const list = vi.spyOn(DraftQuestionService.prototype, 'list').mockResolvedValue({ questions: [{
      questionId: 'd1:3:deptIds', draftId: 'd1', draftVersion: 3, field: 'deptIds', title: '选择部门', multiple: true, allowEmpty: true, truncated: false, options,
    }] })
    const app = await appFor()
    try {
      const response = await app.inject({ method: 'GET', url: '/drafts/d1/questions?conversationId=c1' })
      expect(response.statusCode).toBe(200)
      expect(response.json().data.questions[0].options).toEqual(options)
    } finally { list.mockRestore(); await app.close() }
  })
  it('keeps the published OpenAPI question operations equal to the registered route contracts', async () => {
    const app = await appFor()
    try {
      await app.ready()
      const published = JSON.parse(readFileSync('openapi.json', 'utf8')) as { paths: Record<string, unknown> }
      for (const path of ['/drafts/{draftId}/questions', '/drafts/{draftId}/questions/answer']) {
        expect(published.paths[`/api/ai/v1${path}`]).toEqual(app.swagger().paths?.[path])
      }
    } finally { await app.close() }
  })
  it('requires AI permission for both reading and answering', async () => {
    const app = await appFor(403)
    try {
      expect((await app.inject({ method: 'GET', url: '/drafts/d1/questions?conversationId=c1' })).statusCode).toBe(403)
      expect((await app.inject({ method: 'POST', url: '/drafts/d1/questions/answer', payload: body })).statusCode).toBe(403)
    } finally { await app.close() }
  })

  it('passes the authenticated subject and conversation to the question service', async () => {
    const list = vi.spyOn(DraftQuestionService.prototype, 'list').mockResolvedValue({ questions: [] })
    const app = await appFor()
    try {
      const response = await app.inject({ method: 'GET', url: '/drafts/d1/questions?conversationId=c1' })
      expect(response.statusCode).toBe(200)
      expect(response.json().data).toEqual({ questions: [] })
      expect(list).toHaveBeenCalledWith({ actorId: 7, tokenScope: ['ai:chat:use', 'system:user:create'] }, 'c1', 'd1')
    } finally { list.mockRestore(); await app.close() }
  })

  it.each([{ ...body, values: ['10'] }, { ...body, actorId: 1 }, { ...body, values: [10, 10] }])('rejects raw malformed or forged answer %j before coercion', async payload => {
    const answer = vi.spyOn(DraftQuestionService.prototype, 'answer')
    const app = await appFor()
    try {
      expect((await app.inject({ method: 'POST', url: '/drafts/d1/questions/answer', payload })).statusCode).toBe(400)
      expect(answer).not.toHaveBeenCalled()
    } finally { answer.mockRestore(); await app.close() }
  })
})
