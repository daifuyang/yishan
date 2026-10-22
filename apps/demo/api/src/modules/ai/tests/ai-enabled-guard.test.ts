import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { SystemErrorCode } from '@yishan/core-api/business-codes'
import { installAiEnabledGuard } from '../services/ai-enabled.guard.js'
import { AiSettingsService, type AiSettingsEnvironment } from '../services/ai-settings.service.js'
import type { AiSettingsRecord, AiSettingsStore } from '../repositories/ai-settings.repository.js'

function storeFor(row: AiSettingsRecord | null, failures = false): AiSettingsStore {
  return {
    async get() {
      if (failures) throw new Error('database unavailable')
      return row
    },
    async save() {},
  }
}

/**
 * 路由注册在被守卫的 router 的**子插件**里 —— 这正是 module.ts 的形状。直接写
 * 在 app 根上会绕过钩子，测出一个生产里不存在的假绿。
 */
async function appFor(row: AiSettingsRecord | null, failures = false, extra?: (app: any) => void) {
  const app = Fastify()
  const settings = new AiSettingsService(storeFor(row, failures), (): AiSettingsEnvironment => ({}))
  installAiEnabledGuard(app, settings)
  const reached: string[] = []
  await app.register(async (scope) => {
    scope.get('/chat', async () => {
      reached.push('/chat')
      return { ok: true }
    })
    scope.get('/settings', async () => {
      reached.push('/settings')
      return { ok: true }
    })
    scope.post('/settings/test', async () => {
      reached.push('/settings/test')
      return { ok: true }
    })
    scope.get('/runtime-config', async () => {
      reached.push('/runtime-config')
      return { ok: true }
    })
    extra?.(scope)
  })
  await app.ready()
  return { app, reached }
}

const off: AiSettingsRecord = { id: 1, baseUrl: 'https://gateway.example/v1', model: 'm', apiKey: 'k', enabled: false, updatedBy: 1, updatedAt: new Date() }
const on: AiSettingsRecord = { ...off, enabled: true }

describe('AI 全局开关守卫', () => {
  it('rejects business traffic with a 503 envelope while the switch is off', async () => {
    const { app, reached } = await appFor(off)
    try {
      const response = await app.inject({ method: 'GET', url: '/chat' })
      expect(response.statusCode).toBe(503)
      expect(response.json()).toMatchObject({ success: false, code: SystemErrorCode.SERVICE_UNAVAILABLE, message: 'AI 助手未启用' })
      expect(reached).toEqual([])
    } finally { await app.close() }
  })
  it('lets business traffic through while the switch is on', async () => {
    const { app, reached } = await appFor(on)
    try {
      expect((await app.inject({ method: 'GET', url: '/chat' })).statusCode).toBe(200)
      expect(reached).toEqual(['/chat'])
    } finally { await app.close() }
  })
  it('keeps the settings and runtime-config routes reachable so the switch can be flipped back', async () => {
    const { app, reached } = await appFor(off)
    try {
      expect((await app.inject({ method: 'GET', url: '/settings' })).statusCode).toBe(200)
      expect((await app.inject({ method: 'POST', url: '/settings/test' })).statusCode).toBe(200)
      expect((await app.inject({ method: 'GET', url: '/runtime-config' })).statusCode).toBe(200)
      expect(reached).toEqual(['/settings', '/settings/test', '/runtime-config'])
    } finally { await app.close() }
  })
  it('does not exempt a route merely because its path mentions settings', async () => {
    const { app } = await appFor(off, false, scope => { scope.get('/conversation-settings', async () => ({ ok: true })) })
    try {
      expect((await app.inject({ method: 'GET', url: '/conversation-settings' })).statusCode).toBe(503)
    } finally { await app.close() }
  })
  it('treats a read failure as enabled rather than silently shutting the feature off', async () => {
    const { app, reached } = await appFor(null, true)
    try {
      expect((await app.inject({ method: 'GET', url: '/chat' })).statusCode).toBe(200)
      expect(reached).toEqual(['/chat'])
    } finally { await app.close() }
  })
  it('reads the switch per request so a change takes effect without a restart', async () => {
    let enabled = true
    const app = Fastify()
    const settings = new AiSettingsService({
      async get() { return { ...on, enabled } },
      async save() {},
    }, (): AiSettingsEnvironment => ({}))
    const guard = vi.spyOn(AiSettingsService.prototype, 'isEnabled')
    installAiEnabledGuard(app, settings)
    await app.register(async (scope) => { scope.get('/chat', async () => ({ ok: true })) })
    await app.ready()
    try {
      expect((await app.inject({ method: 'GET', url: '/chat' })).statusCode).toBe(200)
      enabled = false
      expect((await app.inject({ method: 'GET', url: '/chat' })).statusCode).toBe(503)
      expect(guard).toHaveBeenCalledTimes(2)
    } finally { await app.close() }
  })
})