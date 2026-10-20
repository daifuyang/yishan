import { expect, it, vi } from 'vitest'
import { testSavedAiConfiguration } from '../services/ai-settings-connection.service.js'

it('tests the resolved saved configuration and returns no provider response or key', async () => {
  const configuration = { apiKey: 'secret-for-test', model: 'test', baseUrl: 'https://unit.test/v1' }
  const probe = vi.fn(async () => {})
  expect(await testSavedAiConfiguration({ resolve: async () => configuration }, probe)).toEqual({ ok: true, message: '连接成功，模型可用' })
  expect(probe).toHaveBeenCalledWith(configuration)
  const result = await testSavedAiConfiguration({ resolve: async () => configuration }, async () => { throw new Error('upstream echoed secret-for-test') })
  expect(result.ok).toBe(false)
  expect(JSON.stringify(result)).not.toContain('secret-for-test')
})
