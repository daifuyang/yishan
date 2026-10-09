import Fastify from 'fastify'
import { describe, expect, it } from './runtime-fixture'
import { errorHandlerPlugin as errorHandler } from '@yishan/core-api/plugins'
import { BusinessError } from '@yishan/core-api/errors'

describe('business error HTTP responses', () => {
  it.each([33001, 33503, 33708])('returns module business code %s as HTTP 400 on a route with a success schema', async (code) => {
    const app = Fastify()
    await app.register(errorHandler)
    app.get('/failure', {
      schema: { response: { 200: {
        type: 'object', required: ['data'], properties: {
          data: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
        },
      } } },
    }, async () => { throw new BusinessError(code, '业务校验未通过') })
    try {
      const response = await app.inject('/failure')
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ success: false, code, message: '业务校验未通过' })
    } finally { await app.close() }
  })

  it('keeps unexpected server failures as HTTP 500', async () => {
    const app = Fastify()
    await app.register(errorHandler)
    app.get('/failure', async () => { throw new Error('unexpected failure') })
    try {
      expect((await app.inject('/failure')).statusCode).toBe(500)
    } finally { await app.close() }
  })
})
