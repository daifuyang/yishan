import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROLE_IDS } from '@/modules/iximei_crm/role-codes'
import hospitalRoutes from '../routes/v1/hospitals/index.js'
import { HospitalsService } from '../services/hospitals.service.js'
import { HospitalsRepository } from '../repositories/hospitals.repository.js'

function dumpSql(node: any, seen = new WeakSet()): string {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (typeof node !== 'object' || seen.has(node)) return ''
  seen.add(node)
  if (Array.isArray(node.value) && node.value.every((value: unknown) => typeof value === 'string')) return node.value.join('')
  if (Array.isArray(node.queryChunks)) return node.queryChunks.map((chunk: any) => dumpSql(chunk, seen)).join('')
  if (node.sql) return dumpSql(node.sql, seen)
  return ''
}

describe('hospital category list filter', () => {
  afterEach(() => vi.restoreAllMocks())

  it('passes the unknown category filter from the management route to the list service', async () => {
    const list = vi.spyOn(HospitalsService, 'list').mockResolvedValue({ list: [], page: 1, pageSize: 10, total: 0 })
    const app = Fastify()
    app.decorate('authenticate', async (request: any) => {
      request.currentUser = { id: 1, roleIds: [ROLE_IDS.SUPER_ADMIN] }
    })
    app.decorate('requirePermission', () => async () => {})
    await app.register(hospitalRoutes, { prefix: '/api/crm/v1' })

    const response = await app.inject({ method: 'GET', url: '/api/crm/v1/hospitals?category=unknown' })

    expect(response.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ category: 'unknown' }))
    await app.close()
  })

  it('adds the normalized unknown category predicate before paging hospital rows', async () => {
    const execute = vi.fn().mockResolvedValue([[{ id: 9 }], []])
    const listQuery: any = {
      from: () => listQuery,
      where: () => listQuery,
      orderBy: () => listQuery,
      limit: () => listQuery,
      offset: () => Promise.resolve([]),
    }
    const totalQuery: any = {
      from: () => totalQuery,
      where: () => Promise.resolve([{ total: 0 }]),
    }
    const select = vi.fn()
      .mockReturnValueOnce(listQuery)
      .mockReturnValueOnce(totalQuery)

    await HospitalsRepository.list({ page: 1, pageSize: 10, category: 'unknown' }, { select, execute } as any)

    expect(execute).toHaveBeenCalledOnce()
    expect(dumpSql(execute.mock.calls[0][0])).toContain('category')
  })
})
