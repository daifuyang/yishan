import Fastify from 'fastify'
import { afterEach, expect, it, vi } from 'vitest'
import settingsRoutes from '../routes/v1/settings.js'
import { AiSettingsService } from '../services/ai-settings.service.js'
import { errorHandlerPlugin } from '@yishan/core-api/plugins'

afterEach(() => vi.restoreAllMocks())
const data = { baseUrl: 'https://unit.test/v1', model: 'test', hasApiKey: true, source: 'database' as const }
async function appFor(denied = false) {
  const app = Fastify()
  await app.register(errorHandlerPlugin, { production: true })
  app.decorate('authenticate', async request => { Object.assign(request, { currentUser: { id: 7 } }) })
  app.decorate('requirePermission', permission => {
    expect(['ai:settings:read', 'ai:settings:update']).toContain(permission.code)
    return async () => { if (denied) throw Object.assign(new Error('禁止访问'), { statusCode: 403 }) }
  })
  await app.register(settingsRoutes)
  return app
}
it('uses separate settings permissions before reading, writing or probing', async () => {
  const read = vi.spyOn(AiSettingsService.prototype, 'read')
  const save = vi.spyOn(AiSettingsService.prototype, 'save')
  const app = await appFor(true)
  try {
    for (const request of [{ method: 'GET' as const, url: '/settings' }, { method: 'PUT' as const, url: '/settings', payload: { model: 'test' } }, { method: 'POST' as const, url: '/settings/test' }]) {
      expect((await app.inject(request)).statusCode).toBe(403)
    }
    expect(read).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  } finally { await app.close() }
})
it('never serializes keys even if a service response accidentally contains one', async () => {
  vi.spyOn(AiSettingsService.prototype, 'read').mockResolvedValue({ ...data, apiKey: 'must-not-appear' } as typeof data)
  vi.spyOn(AiSettingsService.prototype, 'save').mockResolvedValue(data)
  const app = await appFor()
  try {
    const response = await app.inject({ method: 'GET', url: '/settings' })
    expect(response.statusCode).toBe(200)
    expect(response.json().data).toEqual(data)
    expect(response.body).not.toContain('must-not-appear')
    const saved = await app.inject({ method: 'PUT', url: '/settings', payload: { model: 'test', apiKey: 'new-secret' } })
    expect(saved.statusCode).toBe(200)
    expect(saved.body).not.toContain('new-secret')
    expect(AiSettingsService.prototype.save).toHaveBeenCalledWith({ model: 'test', apiKey: 'new-secret' }, 7)
  } finally { await app.close() }
})
