import { describe, expect, it } from 'vitest'
import { createSystemConfig } from '../src/config/create'
import { createSystemRuntime, currentSystemRuntime } from '../src/runtime'

describe('system instance scope', () => {
  it('requires an explicit scope and isolates simultaneous runtimes', async () => {
    expect(() => currentSystemRuntime()).toThrow(/SystemRuntime/)
    const make = (id: string) => createSystemRuntime({
      database: { db: {} , healthCheck: async () => true, transaction: async () => {}, getConnectionStatus: () => ({connected:true,stats:{queryCount:0,uptime:0}}) } as never,
      config: createSystemConfig({ JWT_SECRET: id.repeat(40), NODE_ENV: 'test' }, 'C:/test/' + id),
    })
    const a = make('a'), b = make('b')
    const results = await Promise.all([a.run(async () => { await Promise.resolve(); return currentSystemRuntime() }), b.run(async () => { await Promise.resolve(); return currentSystemRuntime() })])
    expect(results).toEqual([a, b])
    expect(a.permissions).not.toBe(b.permissions)
    expect(a.caches).not.toBe(b.caches)
  })
  it('rejects weak production secrets when creating the runtime', () => {
    expect(() => createSystemRuntime({ database: {} as never, config: createSystemConfig({ NODE_ENV: 'production', JWT_SECRET: 'secret' }, 'C:/test') })).toThrow()
  })
})
