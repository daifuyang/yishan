import Fastify from 'fastify'
import type { SQL } from 'drizzle-orm'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import { describe, expect, it, vi } from '../../../../test/runtime-fixture'
import { drizzleDb } from '../../../../test/mocks/drizzle'
import todosRoutes from '../routes/v1/todos/index.js'
import { TodosService } from '../services/todos.service.js'
import { TodosRepository, escapeLikePattern, type TodoRow } from '../repositories/todos.repository.js'
import type { AppQueryDb } from '@yishan/core-system-api/database'

const row: TodoRow = {
  id: 1,
  title: '示例',
  description: '',
  status: 0,
  dueAt: null,
  createdAt: new Date('2026-10-09T00:00:00Z'),
  updatedAt: new Date('2026-10-09T00:00:00Z'),
}

async function appFor() {
  const app = Fastify()
  app.decorate('drizzleDb', drizzleDb)
  app.decorate('authenticate', async () => {})
  app.decorate('requirePermission', () => async () => {})
  await app.register(todosRoutes)
  return app
}

describe('GET /api/demo/v1/todos querystring', () => {
  it('applies defaults when no query is given', async () => {
    const list = vi.spyOn(TodosService.prototype, 'list').mockResolvedValue({ total: 0, items: [] })
    const app = await appFor()
    try {
      const res = await app.inject({ method: 'GET', url: '/' })
      expect(res.statusCode, res.body).toBe(200)
      expect(res.json()).toEqual({ total: 0, items: [] })
      expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    } finally { await app.close() }
  })

  it('coerces string numbers and passes filters through', async () => {
    const list = vi.spyOn(TodosService.prototype, 'list').mockResolvedValue({ total: 7, items: [row] })
    const app = await appFor()
    try {
      const res = await app.inject({ method: 'GET', url: '/', query: { page: '2', pageSize: '5', keyword: ' 示例 ', status: '1' } })
      expect(res.statusCode, res.body).toBe(200)
      expect(res.json()).toMatchObject({ total: 7, items: [{ id: 1, createdAt: row.createdAt.toISOString() }] })
      expect(list).toHaveBeenCalledWith({ page: 2, pageSize: 5, keyword: ' 示例 ', status: 1 })
    } finally { await app.close() }
  })

  it.each([
    ['page=0'],
    ['pageSize=0'],
    ['pageSize=101'],
    ['status=3'],
    ['status=-1'],
    ['page=abc'],
    [`keyword=${'x'.repeat(101)}`],
  ])('rejects invalid query %s', async (qs) => {
    const list = vi.spyOn(TodosService.prototype, 'list').mockResolvedValue({ total: 0, items: [] })
    const app = await appFor()
    try {
      const res = await app.inject({ method: 'GET', url: `/?${qs}` })
      expect(res.statusCode).toBe(400)
      expect(list).not.toHaveBeenCalled()
    } finally { await app.close() }
  })
})

describe('TodosService.list', () => {
  const db = {} as AppQueryDb

  it('trims keyword, drops empty keyword and returns the filtered total', async () => {
    const list = vi.spyOn(TodosRepository, 'list').mockResolvedValue([row])
    const count = vi.spyOn(TodosRepository, 'count').mockResolvedValue(42)
    const service = new TodosService(db)

    await expect(service.list({ page: 3, pageSize: 10, keyword: '  foo  ', status: 2 })).resolves.toEqual({ total: 42, items: [row] })
    expect(list).toHaveBeenCalledWith({ keyword: 'foo', status: 2, page: 3, pageSize: 10 }, db)
    expect(count).toHaveBeenCalledWith({ keyword: 'foo', status: 2 }, db)

    await service.list({ keyword: '   ' })
    expect(list).toHaveBeenLastCalledWith({ keyword: undefined, status: undefined, page: 1, pageSize: 20 }, db)
    expect(count).toHaveBeenLastCalledWith({ keyword: undefined, status: undefined }, db)
  })
})

describe('TodosRepository list SQL', () => {
  const dialect = new MySqlDialect()

  function captureDb() {
    const captured: { where?: SQL; limit?: number; offset?: number } = {}
    const chain = {
      from: () => chain,
      where: (cond?: SQL) => { captured.where = cond; return chain },
      orderBy: () => chain,
      limit: (n: number) => { captured.limit = n; return chain },
      offset: (n: number) => { captured.offset = n; return Promise.resolve([]) },
      then: (resolve: (v: unknown[]) => unknown) => resolve([{ c: '3' }]),
    }
    const db = { select: () => chain } as unknown as AppQueryDb
    return { db, captured }
  }

  it('escapes LIKE wildcards in user input', () => {
    expect(escapeLikePattern('50%_a\\b')).toBe('50\\%\\_a\\\\b')
    expect(escapeLikePattern('plain')).toBe('plain')
  })

  it('matches keyword on title OR description, status exactly, and paginates', async () => {
    const { db, captured } = captureDb()
    await TodosRepository.list({ keyword: '50%', status: 1, page: 3, pageSize: 10 }, db)
    expect(captured.limit).toBe(10)
    expect(captured.offset).toBe(20)
    const query = dialect.sqlToQuery(captured.where as SQL)
    expect(query.sql).toMatch(/`title` like \? or .*`description` like \?/)
    expect(query.sql).toMatch(/`status` = \?/)
    expect(query.params).toEqual(['%50\\%%', '%50\\%%', 1])
  })

  it('applies no WHERE without filters and counts the filtered set', async () => {
    const { db, captured } = captureDb()
    await TodosRepository.list({ page: 1, pageSize: 20 }, db)
    expect(captured.where).toBeUndefined()
    expect(captured.offset).toBe(0)

    const counter = captureDb()
    await expect(TodosRepository.count({ status: 0 }, counter.db)).resolves.toBe(3)
    expect(dialect.sqlToQuery(counter.captured.where as SQL).params).toEqual([0])
  })
})
