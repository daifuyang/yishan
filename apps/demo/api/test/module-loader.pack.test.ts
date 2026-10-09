import { describe, expect, it, vi } from 'vitest'
import { createYishanApi, type ApiModule } from '@yishan/core-api'
import { swaggerPlugin } from '@yishan/core-api/plugins'
import type { ModuleMetadata } from '@yishan/core-contracts'

function module(id: string): ApiModule<undefined> {
  return { id, name: id, version: '1.0.0', tablePrefix: `${id}_`, contractVersion: 2,
    async register(router) { router.get('/v1/ping', { schema: { security: [] } }, async () => ({ id })) },
    seed: vi.fn(async () => {}),
    migrations: { id, folder: `/not-opened/${id}`, historyTable: `__migrations_${id}` },
  }
}

describe('explicit module installation', () => {
  it('only installs manifest members; omitted definitions have no routes, sync, seed or OpenAPI', async () => {
    const installed = module('installed')
    const omitted = module('omitted')
    const synced: ModuleMetadata[] = []
    const app = await createYishanApi({ modules: [installed], context: undefined,
      setup: async router => { await router.register(swaggerPlugin) },
      moduleState: { async sync(modules) { synced.push(...modules) }, async enabledIds() { return new Set(['installed', 'omitted']) } },
    })
    try {
      expect((await app.inject('/api/installed/v1/ping')).statusCode).toBe(200)
      expect((await app.inject('/api/omitted/v1/ping')).json().code).toBe(25005)
      expect(synced.map(value => value.id)).toEqual(['installed'])
      expect([...app.moduleLoader.listModuleIds()]).toEqual(['installed'])
      expect(Object.keys(app.swagger().paths!)).toEqual(['/api/installed/v1/ping'])
      expect(omitted.seed).not.toHaveBeenCalled()
      // Startup never runs migration or seed, even for installed modules.
      expect(installed.seed).not.toHaveBeenCalled()
    } finally { await app.close() }
  })
})
