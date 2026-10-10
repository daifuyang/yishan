import { createRequire } from 'node:module'
import { describe, expect, it } from '../test/runtime-fixture'
import type { SystemDatabase } from '../src/db'
import type { SystemRuntime } from '../src'
import type { FastifyInstance } from 'fastify'

const requirePackage = createRequire(import.meta.url)
const system = requirePackage('../dist') as typeof import('../src')
const core = requirePackage('@yishan/core-api') as typeof import('@yishan/core-api')

describe('compiled package composition', () => {
  it('boots two isolated system APIs and keeps the second usable after closing the first', async () => {
    let closedA = 0, closedB = 0
    async function make(id: 'A' | 'B'): Promise<{ runtime: SystemRuntime; app: FastifyInstance }> {
      const database = {
        db: {}, connect: async () => {}, close: async () => { if (id === 'A') closedA++; else closedB++ },
        healthCheck: async () => true, getConnectionStatus: () => ({ connected: true, stats: { queryCount: 0, uptime: 0 } }),
      } as unknown as SystemDatabase
      const runtime = system.createSystemRuntime({ database, config: system.createSystemConfig({ NODE_ENV: 'test', JWT_SECRET: id.repeat(40) }, process.cwd() + '/' + id), redis: false, staticAssets: false })
      const moduleId = id === 'A' ? 'alpha' : 'beta'
      const business: import('@yishan/core-api').ApiModule<SystemRuntime> = {
        id: moduleId, name: moduleId, version: '1.0.0', tablePrefix: `${moduleId}_`, contractVersion: 2,
        dependencies: [{ id: 'system', version: '^2.0.0' }],
        async register(router) {
          router.get('/value', async () => {
            await new Promise<void>(resolve => setImmediate(resolve))
            expect(system.currentSystemRuntime()).toBe(runtime)
            return { value: id }
          })
        },
      }
      const app = await core.createYishanApi({ modules: [system.systemModule, business], context: runtime, permissionCatalog: runtime.permissions, runInContext: fn => runtime.run(fn), setup: app => runtime.setup(app), resources: [database], serverOptions: { logger: false } })
      return { runtime, app }
    }
    const [a,b] = await Promise.all([make('A'),make('B')])
    try {
      const owned = await Promise.all([a.app.inject('/api/alpha/value'), b.app.inject('/api/beta/value')])
      expect(owned.map(response => response.statusCode)).toEqual([200, 200])
      expect(owned.map(response => response.json().value)).toEqual(['A', 'B'])
      expect((await a.app.inject('/api/beta/value')).statusCode).toBe(404)
      expect((await b.app.inject('/api/alpha/value')).statusCode).toBe(404)
      expect(a.runtime.permissions.codes.size).toBeGreaterThan(40)
      a.runtime.permissions.register({ code: 'demo:a-only', label: 'A only', group: 'demo' })
      a.runtime.caches.permissions.set('1|v1', { perms: new Set(['a']), roleCodes: new Set(), loadedAt: Date.now() })
      expect(b.runtime.permissions.has('demo:a-only')).toBe(false)
      expect(b.runtime.caches.permissions.size).toBe(0)
      const token = a.app.jwt.sign({ id: 1, type: 'access_token' })
      expect(() => b.app.jwt.verify(token)).toThrow()
      await a.app.close()
      expect(closedA).toBe(1)
      expect(closedB).toBe(0)
      expect((await b.app.inject({ method: 'GET', url: '/api/v1/auth/me' })).statusCode).toBe(401)
    } finally { await a.app.close(); await b.app.close() }
  })
})
