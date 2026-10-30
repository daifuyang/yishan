import { vi, beforeEach } from 'vitest'
import { resetTestRuntime } from './runtime-fixture'

const { mockFactory } = vi.hoisted(() => ({
  mockFactory: async () => {
    const module = await import('./mocks/drizzle')
    return { drizzleDb: module.drizzleDb, dbManager: module.dbManager }
  },
}))

vi.mock('@yishan/core-system-api/database', mockFactory)
beforeEach(() => { vi.restoreAllMocks(); resetTestRuntime() })
