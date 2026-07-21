import { vi, beforeEach, beforeAll } from 'vitest'

/**
 * Auto-mock the database layer for all tests in the repo.
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
 * Force-import all routes so each route file's `registerPermissions(...)` runs
 * before any test, populating the catalog.
 */
beforeAll(async () => {
  await import('../src/core/routes/api/health.js')
  await import('../src/core/routes/api/v1/admin/users/index.js')
  await import('../src/core/routes/api/v1/admin/roles/index.js')
  await import('../src/core/routes/api/v1/admin/menus/index.js')
  await import('../src/core/routes/api/v1/admin/departments/index.js')
  await import('../src/core/routes/api/v1/admin/attachments/index.js')
  await import('../src/core/routes/api/v1/admin/dicts/index.js')
  await import('../src/core/routes/api/v1/admin/positions/index.js')
  await import('../src/core/routes/api/v1/admin/system/options/index.js')
  await import('../src/core/routes/api/v1/admin/system/storage/index.js')
  await import('../src/core/routes/api/v1/admin/system/qiniu/index.js')
  await import('../src/core/routes/api/v1/admin/system/login-logs/index.js')
  await import('../src/core/routes/api/v1/admin/system/regions/index.js')
  await import('../src/core/routes/api/v1/admin/permissions/index.js')
  await import('../src/core/routes/api/v1/me/api-tokens/index.js')
  await import('../src/core/routes/api/v1/system/index.js')
  await import('../src/core/routes/api/v1/auth/index.js')
  await import('../src/core/routes/api/v1/app/index.js')
  await import('../src/core/routes/api/v1/app/menus/index.js')
  await import('../src/core/routes/api/v1/app/users/index.js')
  await import('../src/core/routes/api/v1/app/contacts/index.js')
  await import('../src/core/routes/api/v1/app/dicts/index.js')
  await import('../src/core/routes/api/v1/app/dashboard/index.js')
  await import('../src/core/routes/api/v1/app/auth/index.js')
});

beforeEach(() => {
  vi.restoreAllMocks();
});
