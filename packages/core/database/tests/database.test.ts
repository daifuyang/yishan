import { beforeEach, describe, expect, it, vi } from 'vitest'

const adapter = vi.hoisted(() => ({
  createPool: vi.fn(),
  getConnection: vi.fn(),
  release: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}))

vi.mock('mysql2/promise', () => ({
  createPool: adapter.createPool,
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  adapter.createPool.mockReturnValue({
    getConnection: adapter.getConnection,
    query: adapter.query,
    end: adapter.end,
  })
  adapter.getConnection.mockResolvedValue({ release: adapter.release })
  adapter.query.mockResolvedValue([[{ result: 1 }], []])
  adapter.end.mockResolvedValue(undefined)
})

describe('createDatabase', () => {
  it('imports without creating a pool and only uses the supplied connection', async () => {
    const { createDatabase } = await import('../src/index.js')
    expect(adapter.createPool).not.toHaveBeenCalled()
    const database = createDatabase({ connection: 'mysql://explicit/db', schema: {} })
    expect(adapter.createPool).toHaveBeenCalledWith('mysql://explicit/db')
    expect(database.getConnectionStatus().connected).toBe(false)
    await database.connect()
    expect(database.getConnectionStatus().connected).toBe(true)
    expect(adapter.release).toHaveBeenCalledOnce()
    await database.close()
    expect(database.getConnectionStatus().connected).toBe(false)
  })

  it('keeps connection status false after a failed probe and can retry', async () => {
    const { createDatabase } = await import('../src/index.js')
    const database = createDatabase({ connection: { host: 'explicit' }, schema: {} })
    adapter.getConnection.mockRejectedValueOnce(new Error('offline'))
    await expect(database.connect()).rejects.toThrow('offline')
    expect(database.getConnectionStatus().connected).toBe(false)
    await database.connect()
    expect(database.getConnectionStatus().connected).toBe(true)
  })

  it('returns a failed health check on query failure without swallowing connect errors', async () => {
    const { createDatabase } = await import('../src/index.js')
    const database = createDatabase({ connection: 'mysql://explicit/db', schema: {} })
    expect(await database.healthCheck()).toBe(true)
    adapter.query.mockRejectedValueOnce(new Error('offline'))
    expect(await database.healthCheck()).toBe(false)
  })

  it('closes the pool once and rejects connecting a closed database', async () => {
    const { createDatabase } = await import('../src/index.js')
    const database = createDatabase({ connection: 'mysql://explicit/db', schema: {} })
    await Promise.all([database.close(), database.close()])
    expect(adapter.end).toHaveBeenCalledOnce()
    await expect(database.connect()).rejects.toThrow(/closed/i)
    expect(await database.healthCheck()).toBe(false)
  })

  it('does not mark an in-flight probe connected after closing', async () => {
    const { createDatabase } = await import('../src/index.js')
    const database = createDatabase({ connection: 'mysql://explicit/db', schema: {} })
    let resolveConnection: ((connection: { release: () => void }) => void) | undefined
    adapter.getConnection.mockReturnValue(new Promise<{ release: () => void }>((resolve) => { resolveConnection = resolve }))
    const connecting = database.connect()
    await database.close()
    resolveConnection?.({ release: adapter.release })
    await expect(connecting).rejects.toThrow(/closed/i)
    expect(database.getConnectionStatus().connected).toBe(false)
    expect(adapter.release).toHaveBeenCalledOnce()
  })

  it('uses a transaction connection and rolls back when the operation fails', async () => {
    const { createDatabase } = await import('../src/index.js')
    const database = createDatabase({ connection: 'mysql://explicit/db', schema: {} })
    const statements: string[] = []
    adapter.getConnection.mockResolvedValue({
      release: adapter.release,
      query: async (query: { sql: string } | string) => {
        statements.push(typeof query === 'string' ? query : query.sql)
        return [[], []]
      },
    })
    await expect(database.transaction(async () => { throw new Error('business rejection') })).rejects.toThrow('business rejection')
    expect(statements).toEqual(['begin', 'rollback'])
    expect(adapter.release).toHaveBeenCalledOnce()
  })
})
