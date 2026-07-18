import Fastify from 'fastify'
import adminSystemPluginsPlugin from '../src/core/routes/api/v1/admin/system/plugins/index.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import { createPluginRuntime } from '../src/core/plugin-platform/index.ts'
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * 真实生产逻辑要求启停走 strict 持久化 reader/writer（见
 * PluginManageService.readOriginalSnapshot / updateRuntimeStateStrict）。
 * 测试中 Drizzle mock 不存在 sys_plugin 行，因此必须在 runtime.persistence 上
 * 用 vi.fn 直接替换三个 strict 方法，把状态保存在闭包里的内存对象上。
 *
 * 生产代码与默认 strict 语义保持不变：本测试只替换 persistence 方法，
 * 不修改 PluginManageService 任何逻辑。
 */
async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)

  app.decorate('authenticate', async (request) => {
    ;(request as any).currentUser = { id: 1 }
  })
  // 单测不需要真实 RBAC 校验：no-op 占位。
  app.decorate('requirePermission', () => async (_request: any, _reply: any) => undefined)
  app.decorate('requireRole', () => async (_request: any, _reply: any) => undefined)

  const runtime = createPluginRuntime()
  runtime.register({
    pluginId: 'test/demo-plugin',
    name: 'demo-plugin',
    version: '1.0.0',
    dbNamespace: 'ys_demo',
    coreCompatibility: '^1.0.0',
    permissions: []
  })
  runtime.lifecycle.load('demo-plugin')
  runtime.lifecycle.enable('demo-plugin')
  await runtime.persistence.syncManifest({
    pluginId: 'test/demo-plugin',
    name: 'demo-plugin',
    version: '1.0.0',
    dbNamespace: 'ys_demo',
    coreCompatibility: '^1.0.0',
    permissions: []
  })

  // —— strict 持久化状态保存在测试内存对象里 ——
  const persisted = {
    pluginId: 'test/demo-plugin',
    name: 'demo-plugin',
    version: '1.0.0',
    coreCompatibility: '^1.0.0',
    lifecycleState: 'enabled' as 'enabled' | 'disabled',
    enabled: true as boolean,
    lastError: undefined as string | undefined,
    updatedAt: undefined as Date | undefined,
  }

  runtime.persistence.getRuntimeStateStrict = vi.fn(async (pluginId: string, name?: string) => {
    if (pluginId === persisted.pluginId || name === persisted.name) {
      return { ...persisted }
    }
    return null
  }) as typeof runtime.persistence.getRuntimeStateStrict

  runtime.persistence.updateRuntimeStateStrict = vi.fn(
    async (
      _pluginId: string,
      _name: string,
      lifecycleState: typeof persisted.lifecycleState,
      enabled: boolean,
      error?: string
    ) => {
      persisted.lifecycleState = lifecycleState
      persisted.enabled = enabled
      persisted.lastError = error
      persisted.updatedAt = new Date()
    }
  ) as typeof runtime.persistence.updateRuntimeStateStrict

  runtime.persistence.listPluginStatesStrict = vi.fn(async () => [
    {
      pluginId: persisted.pluginId,
      enabled: persisted.enabled,
      updatedAt: persisted.updatedAt ? persisted.updatedAt.toISOString() : null,
    },
  ]) as typeof runtime.persistence.listPluginStatesStrict

  // 暴露闭包状态，便于用例断言 strict 状态已更新。
  ;(app as unknown as { __persisted: typeof persisted }).__persisted = persisted

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
    const persisted = (app as unknown as { __persisted: {
      lifecycleState: 'enabled' | 'disabled'
      enabled: boolean
    } }).__persisted

    // 初始 fixture：已 enabled=true
    expect(persisted.enabled).toBe(true)
    expect(persisted.lifecycleState).toBe('enabled')

    // disable 必须返回 200，且 strict 状态确实翻转为 disabled/false
    const disabled = await app.inject({ method: 'POST', url: '/demo-plugin/disable' })
    expect(disabled.statusCode).toBe(200)
    expect(disabled.json().data.state).toBe('disabled')
    expect(disabled.json().data.enabled).toBe(false)
    expect(persisted.lifecycleState).toBe('disabled')
    expect(persisted.enabled).toBe(false)

    // enable 再次翻回 enabled/true
    const enabled = await app.inject({ method: 'POST', url: '/demo-plugin/enable' })
    expect(enabled.statusCode).toBe(200)
    expect(enabled.json().data.state).toBe('enabled')
    expect(enabled.json().data.enabled).toBe(true)
    expect(persisted.lifecycleState).toBe('enabled')
    expect(persisted.enabled).toBe(true)

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
