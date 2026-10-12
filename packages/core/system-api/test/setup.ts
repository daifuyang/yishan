import { vi, beforeEach, beforeAll } from 'vitest'
import Fastify from 'fastify'
import { resetTestRuntime, setTestPermissionDeclarations } from './runtime-fixture'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const { mockFactory } = vi.hoisted(() => ({ mockFactory: async () => {
  const mod = await import('./mocks/drizzle.js')
  return { default: mod.default, dbManager: mod.dbManager, drizzleDb: mod.drizzleDb }
} }))
vi.mock('../src/db/index.js', mockFactory)

vi.mock('@yishan/core-api/routes/route-registrar', async importOriginal => {
  const original = await importOriginal<typeof import('@yishan/core-api/routes/route-registrar')>()
  return { ...original, createRouteRegistrar: (app: import('fastify').FastifyInstance) => {
    // These unit builders intentionally mock access policy. Authentication-chain suites install real decorators.
    if (!app.hasDecorator('softAuthenticate') && app.hasDecorator('authenticate')) app.decorate('softAuthenticate', app.authenticate)
    if (!app.hasDecorator('requirePermission')) app.decorate('requirePermission', () => async () => {})
    return original.createRouteRegistrar(app)
  } }
})

beforeAll(async () => {
  const runtime = resetTestRuntime()
  await runtime.run(async () => {
    const app = Fastify({ logger: false })
    app.decorate('authenticate', async () => {})
    app.decorate('softAuthenticate', async () => {})
    app.decorate('requirePermission', () => async () => {})
    app.decorate('rateLimit', () => async () => {})
    for (const method of ['get','post','put','patch','delete','register'] as const) vi.spyOn(app, method).mockImplementation(() => app)
    async function collect(dir: string): Promise<void> {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = join(dir,entry.name)
        if (entry.isDirectory()) await collect(file)
        else if (entry.name.endsWith('.ts') && !['admin-crud.ts','route-registrar.ts'].includes(entry.name)) {
          const plugin = await import(file)
          if (typeof plugin.default === 'function') await plugin.default(app,{})
        }
      }
    }
    await collect(join(__dirname, '../src/core/routes'))
    setTestPermissionDeclarations(runtime.permissions.listPermissions())

  })
})
beforeEach(() => { vi.restoreAllMocks(); resetTestRuntime() })
