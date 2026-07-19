import Fastify from 'fastify'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  pluginGate,
  registerPluginGate,
  setPluginState,
  PLUGIN_DISABLED,
  PLUGIN_NOT_FOUND,
  PLUGIN_FAILED,
  type PluginRuntimeState,
} from '../src/core/middleware/plugin-gate.js'

/**
 * Wave 4 — ADR-003 pluginGate unit tests.
 *
 * The gate is a per-plugin preHandler wrapped around a sub-app, but it has
 * no Fastify sub-app dependency: it only needs `request.server` decorated
 * with a `pluginState` map. So we can drive it directly with a one-route
 * Fastify, no AutoLoad, no real manifest.
 */

interface GateHarness {
  app: Awaited<ReturnType<typeof Fastify>>
  cleanup: () => Promise<void>
}

async function buildHarness(extra: (app: Awaited<ReturnType<typeof Fastify>>) => Promise<void> = async () => {}): Promise<GateHarness> {
  const app = Fastify({ logger: false })
  registerPluginGate(app)
  // Wrap the actual route in a sub-app so a single addHook('preHandler')
  // mirrors the production layout. The gate itself never references Fastify
  // context, only request.server, so this just exercises the contract.
  await app.register(async (instance) => {
    instance.addHook('preHandler', pluginGate('yishan/hello'))
    instance.get('/probe', async () => ({ ok: true }))
  })
  await extra(app)
  await app.ready()
  return {
    app,
    cleanup: async () => {
      await app.close()
    },
  }
}

describe('Wave 4: ADR-003 pluginGate', () => {
  let app: Awaited<ReturnType<typeof Fastify>>
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    const harness = await buildHarness()
    app = harness.app
    cleanup = harness.cleanup
  })

  afterEach(async () => {
    await cleanup()
  })

  it('returns 200 + ok body when state is enabled', async () => {
    setPluginState(app, 'yishan/hello', 'enabled')
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('returns 404 + PLUGIN_DISABLED when state is disabled', async () => {
    setPluginState(app, 'yishan/hello', 'disabled')
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ success: false, code: PLUGIN_DISABLED })
  })

  it('returns 404 + PLUGIN_DISABLED when state is installed (default install)', async () => {
    setPluginState(app, 'yishan/hello', 'installed')
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ code: PLUGIN_DISABLED })
  })

  it('returns 503 + PLUGIN_FAILED when state is failed', async () => {
    setPluginState(app, 'yishan/hello', 'failed')
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ success: false, code: PLUGIN_FAILED })
  })

  it('returns 404 + PLUGIN_NOT_FOUND when plugin id is not in state map', async () => {
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ success: false, code: PLUGIN_NOT_FOUND })
  })

  it('state map is shared across plugins (independence via ids)', async () => {
    // Set both states on the existing app: a separate test below builds
    // a multi-plugin app because `app.register(...)` after `app.ready()`
    // is not allowed in Fastify.
    setPluginState(app, 'yishan/hello', 'enabled')

    const a = await app.inject({ method: 'GET', url: '/probe' })
    expect(a.statusCode).toBe(200)

    // Build a second app where the only registered plugin id is `yishan/other`
    // and confirm the `yishan/hello` state does not bleed across fastify
    // instances either (each app has its own Map).
    await cleanup()
    const otherHarness = await buildHarness(async (otherApp) => {
      await otherApp.register(async (instance) => {
        instance.addHook('preHandler', pluginGate('yishan/other'))
        instance.get('/probe-other', async () => ({ ok: 'other' }))
      })
    })
    // swap harness for this assertion
    cleanup = otherHarness.cleanup
    app = otherHarness.app
    setPluginState(app, 'yishan/other', 'disabled')

    const b = await app.inject({ method: 'GET', url: '/probe-other' })
    expect(b.statusCode).toBe(404)
    expect(b.json()).toMatchObject({ code: PLUGIN_DISABLED })
  })

  it('exhaustive state matrix lines up with expected status codes', async () => {
    const expectations: Array<[PluginRuntimeState, number]> = [
      ['enabled', 200],
      ['disabled', 404],
      ['installed', 404],
      ['failed', 503],
    ]
    for (const [state, status] of expectations) {
      setPluginState(app, 'yishan/hello', state)
      const res = await app.inject({ method: 'GET', url: '/probe' })
      expect(res.statusCode, `state=${state}`).toBe(status)
    }
  })
})
