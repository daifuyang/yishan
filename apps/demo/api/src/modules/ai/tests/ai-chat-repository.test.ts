import { MySqlDialect } from 'drizzle-orm/mysql-core'
import type { SQL } from 'drizzle-orm'
import type { AppQueryDb } from '@yishan/core-system-api/database'
import { describe, expect, it } from 'vitest'
import { AiChatRepository } from '../repositories/ai-chat.repository.js'

function writes(affectedRows = 1) {
  const conditions: SQL[] = []
  const patches: Record<string, unknown>[] = []
  const chain = {
    set(patch: Record<string, unknown>) { patches.push(patch); return chain },
    async where(condition: SQL) { conditions.push(condition); return [{ affectedRows }] },
  }
  // The repository receives a query-only test double; no database is opened.
  const db = { update: () => chain, delete: () => chain } as unknown as AppQueryDb
  return { repo: new AiChatRepository(db), conditions, patches }
}
const dialect = new MySqlDialect()

describe('AI chat repository ownership and lease SQL', () => {
  it.each(['rename', 'remove'] as const)('allows %s after a crashed generation lease expires', async operation => {
    const f = writes()
    if (operation === 'rename') await f.repo.rename(19, 'conversation-1', 'title')
    else await f.repo.remove(19, 'conversation-1')
    const query = dialect.sqlToQuery(f.conditions[0])
    expect(query.params.slice(0, 2)).toEqual([19, 'conversation-1'])
    expect(query.sql).toMatch(/`active_owner` is null or .*`lease_expires_at` < \?/)
    expect(query.params[2]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/)
  })
  it('refuses mutations when the atomic database predicate rejects a live lease', async () => {
    const f = writes(0)
    await expect(f.repo.rename(19, 'conversation-1', 'title')).rejects.toMatchObject({ statusCode: 409 })
    await expect(f.repo.remove(19, 'conversation-1')).rejects.toMatchObject({ statusCode: 409 })
  })
  it('acquires only an empty lease and expires only leases owned by the same user', async () => {
    const f = writes()
    await expect(f.repo.acquire(19, 'conversation-1', 'generation-1')).resolves.toBe(true)
    expect(f.conditions).toHaveLength(2)
    const cleanup = dialect.sqlToQuery(f.conditions[0])
    expect(cleanup.params[0]).toBe(19)
    expect(cleanup.sql).toContain('`lease_expires_at` < ?')
    const acquire = dialect.sqlToQuery(f.conditions[1])
    expect(acquire.params).toEqual([19, 'conversation-1'])
    expect(acquire.sql).toContain('`active_owner` is null')
    expect(f.patches[1]).toMatchObject({ activeOwner: 19, generationToken: 'generation-1' })
  })
  it('fences lease release by owner, conversation and generation token', async () => {
    const f = writes()
    await f.repo.release(19, 'conversation-1', 'generation-1')
    expect(dialect.sqlToQuery(f.conditions[0]).params).toEqual([19, 'conversation-1', 'generation-1'])
    expect(f.patches).toEqual([{ activeOwner: null, generationToken: null, leaseExpiresAt: null }])
  })
})
