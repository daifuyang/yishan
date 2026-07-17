import { vi, beforeEach } from 'vitest'

/**
 * Auto-mock the database layer for all tests in the repo. Each module gets
 * the same underlying factory (`./mocks/drizzle`) so production code under
 * test sees a noop Drizzle client regardless of which import path it uses.
 *
 * The mocked modules:
 *   - `../src/db/index.js`      — new entry point exporting `drizzleDb`,
 *                                 `pool`, `schema`
 *   - `../src/db/manager.js`    — new `dbManager` singleton
 *   - `../src/db/client.js`     — new `pool` + `drizzleDb` factory (so any
 *                                 direct import of the client still resolves
 *                                 to the test mock)
 *
 * The factory must be hoisted (via `vi.hoisted`) because Vitest lifts every
 * `vi.mock(...)` call above all imports, which would otherwise see an
 * uninitialized `mockFactory` reference.
 */
const { mockFactory } = vi.hoisted(() => ({
  mockFactory: async () => {
    const mod = await import('./mocks/drizzle.js')
    return {
      default: mod.default,
      dbManager: mod.dbManager,
      drizzleDb: mod.drizzleDb,
      pool: {},
      schema: mod,
    }
  },
}))

vi.mock('../src/db/index.js', mockFactory)
vi.mock('../src/db/manager.js', mockFactory)
vi.mock('../src/db/client.js', mockFactory)

/**
 * Initialize global permission catalog for all tests.
 * This is required because computeEffectivePerms and getGlobalCatalog are used
 * throughout the codebase, and they now require initialization.
 */
beforeEach(async () => {
  const { initGlobalCatalog } = await import('../src/core/services/permission-catalog.service.js')
  // Initialize with empty plugin states (tests can override via their own setup)
  await initGlobalCatalog(
    async () => [],
    { listManifests: () => [] }
  )
})
