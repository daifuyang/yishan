import Fastify from 'fastify'
import { describe, it, expect } from 'vitest'
import helloManifest from '../../../plugins/yishan/hello/plugin.ts'

/**
 * Wave 2 smoke test for the hello plugin migration.
 *
 * Goals:
 *   - Verify `plugins/yishan/hello/plugin.ts` exports a manifest whose shape
 *     matches the SDK `PluginManifest` contract (id, kind, api.prefix).
 *   - Verify the API routes file at
 *     `plugins/yishan/hello/api/routes/v1/admin/index.ts` mounts under the
 *     new `/api/plugins/yishan/hello/v1/...` prefix via Fastify injection.
 *     The exact response code (401 vs 200) depends on the test decorators'
 *     `authenticate` behavior, so we only assert "the route registered"
 *     (i.e. NOT `FST_ERR_NOT_FOUND`).
 */

describe('Wave 2: hello plugin boot', () => {
  it('hello manifest exports a plugin.ts with id yishan/hello', () => {
    expect(helloManifest.id).toBe('yishan/hello')
    expect(helloManifest.kind).toBe('sample')
    expect(helloManifest.api?.prefix).toBe('/api/plugins/yishan/hello/v1')
  })

  it('hello manifest mirrors the legacy plugin-platform fields for runtime compatibility', () => {
    // The legacy `apps/yishan-api/src/core/plugin-platform` runtime still
    // keys on `name` and persists `pluginId`/`dbNamespace`. The catalog
    // manifest carries both SDK and legacy fields until Wave 3 retires the
    // legacy layer; assert the legacy side is present for the in-tree hello.
    expect((helloManifest as unknown as { name: string }).name).toBe('hello')
    expect((helloManifest as unknown as { pluginId: string }).pluginId).toBe('yishan/hello')
    expect((helloManifest as unknown as { dbNamespace: string }).dbNamespace).toBe('ys_hello')
  })

  it('hello api routes mount under /api/plugins/yishan/hello/v1', async () => {
    const app = Fastify({ logger: false })
    app.decorate('authenticate', async () => undefined)
    app.decorate('requirePermission', () => async () => undefined)
    const { default: helloAdminRoutes } = (await import(
      '../../../plugins/yishan/hello/api/routes/v1/admin/index.ts'
    )) as { default: any }
    await app.register(helloAdminRoutes, { prefix: 'api/plugins/yishan/hello/v1' })
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/api/plugins/yishan/hello/v1/' })
    // The preHandler runs without a real auth decorator, so the exact
    // status is environment-dependent. The point of this assertion is to
    // prove the route was *registered* — getting an explicit 401/200/500
    // means Fastify found the handler, vs 404 = `FST_ERR_NOT_FOUND`.
    expect(res.statusCode).not.toBe(404)
    await app.close()
  })
})
