import Fastify from 'fastify'
import adminSystemPluginsPlugin from '../src/core/routes/api/v1/admin/system/plugins/index.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import { createPluginRuntime } from '../src/plugins-runtime/index.ts'
import { describe, it, expect, beforeEach } from 'vitest'

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)

  app.decorate('authenticate', async (request) => {
    ;(request as any).currentUser = { id: 1 }
  })

  const runtime = createPluginRuntime()
  runtime.register({ pluginId: 'test/demo-plugin', name: 'demo-plugin', version: '1.0.0', coreCompatibility: '^1.0.0' })
  runtime.lifecycle.load('demo-plugin')
  runtime.lifecycle.enable('demo-plugin')
  await runtime.persistence.syncManifest({ pluginId: 'test/demo-plugin', name: 'demo-plugin', version: '1.0.0', coreCompatibility: '^1.0.0' })
  await runtime.persistence.updateRuntimeState('test/demo-plugin', 'demo-plugin', 'enabled', true)
  runtime.hooks.on('plugin:test', async () => undefined)
  await runtime.hooks.emit({ name: 'plugin:test', payload: { ok: true } })

  app.decorate('pluginRuntime', runtime)
  await app.register(adminSystemPluginsPlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  process.env.NODE_ENV = 'test'
})

describe('Admin system plugins routes', () => {
  it('GET / returns plugin list', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0].name).toBe('demo-plugin')

    await app.close()
  })

  it('GET /:name returns details and missing returns not found', async () => {
    const app = await buildApp()
    const ok = await app.inject({ method: 'GET', url: '/demo-plugin' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data.name).toBe('demo-plugin')

    const missing = await app.inject({ method: 'GET', url: '/missing-plugin' })
    expect(missing.statusCode).toBe(404)
    expect(missing.json().success).toBe(false)

    await app.close()
  })

  it('POST /:name/enable and /disable toggle plugin', async () => {
    const app = await buildApp()

    const disabled = await app.inject({ method: 'POST', url: '/demo-plugin/disable' })
    expect(disabled.statusCode).toBe(200)
    expect(disabled.json().data.state).toBe('disabled')
    expect(disabled.json().data.enabled).toBe(false)

    const enabled = await app.inject({ method: 'POST', url: '/demo-plugin/enable' })
    expect(enabled.statusCode).toBe(200)
    expect(enabled.json().data.state).toBe('enabled')
    expect(enabled.json().data.enabled).toBe(true)

    await app.close()
  })

  it('GET /hooks/reports returns execution reports', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/hooks/reports?limit=50' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0].event).toBe('plugin:test')

    await app.close()
  })
})
