import Fastify from 'fastify'
import { drizzle } from 'drizzle-orm/mysql-proxy'
import { describe, expect, it } from 'vitest'
import type { AppQueryDb } from '@/db'
import { ResponseUtil } from '@/utils/response.js'
import { QuotationRepository } from '../repositories/quotation.repository.js'
import { QuotationListItemRespSchema, QuotationRespSchema, QuoteSeriesSummaryRespSchema } from '../schemas/quotation.schema.js'
import { EnvelopeSchema, PaginatedEnvelopeSchema } from '../schemas/routes.schema.js'

// mysql2 向 Drizzle 返回数组行，日期列以数据库字符串传入。
function quotationDb(firstViewedAt: string | null): AppQueryDb {
  const timestamp = '2026-10-07 02:40:02'
  const row = [
    1, 'Q-20261007-0001', '测试报价', 1, 1, null, 23, '测试客户', 1, 15,
    '测试商机', '联系人', timestamp, 7, '销售', null, 'sent', timestamp,
    10000, 0, 10000, 0, null, null, null, 7, timestamp, 7, timestamp,
    timestamp, null, null, null, firstViewedAt, firstViewedAt ? 1 : 0, 1,
  ]
  const db = drizzle(async (query) => ({
    rows: query.startsWith('select count(') ? [[1]] : [row],
  }))
  // 使用真实 MySQL 查询与解码器，仅将数据库传输换成无连接的测试适配器。
  return db as unknown as AppQueryDb
}

describe('报价分享时间响应序列化', () => {
  it('filters current-version status after grouping the complete version history, including in the count query', async () => {
    const queries: Array<{ query: string; params: unknown[] }> = []
    const db = drizzle(async (query, params) => {
      queries.push({ query, params })
      return { rows: query.startsWith('select count(') ? [[0]] : [] }
    })
    await QuotationRepository.listSeries({ status: 'sent' }, db as unknown as AppQueryDb)
    expect(queries).toHaveLength(2)
    for (const { query, params } of queries) {
      const groupEnd = query.indexOf('group by')
      const statusFilter = query.lastIndexOf('`crm_quotation`.`status` = ?')
      expect(groupEnd).toBeGreaterThan(-1)
      expect(statusFilter).toBeGreaterThan(groupEnd)
      expect(params).toContain('sent')
    }
  })
  it.each(['2026-10-07 02:40:02', null])('系列列表兼容最近查看时间 %s', async (lastViewedAt) => {
    const timestamp = '2026-10-07 02:40:02'
    const row = [
      'series-a', 'Q-20261007-0001', '项目报价', 23, '测试客户', 1, '测试商机', 'OPP-202610-0001',
      4, 2, 2, 'sent', 6400000, timestamp, timestamp, lastViewedAt, lastViewedAt ? 1 : 0, 1, 7, '销售',
    ]
    const db = drizzle(async (query) => ({ rows: query.startsWith('select count(') ? [[1]] : [row] }))
    const app = Fastify()
    app.get('/series', {
      schema: { response: { 200: PaginatedEnvelopeSchema(QuoteSeriesSummaryRespSchema) } },
    }, async (_request, reply) => {
      const result = await QuotationRepository.listSeries({}, db as unknown as AppQueryDb)
      return ResponseUtil.paginated(reply, result.rows, 1, 10, result.total)
    })
    try {
      const response = await app.inject('/series')
      expect(response.statusCode).toBe(200)
      expect(response.json().data[0]).toMatchObject({
        lastViewedAt: lastViewedAt ? '2026-10-07T02:40:02.000Z' : null,
        currentVersion: 2, versionCount: 2, customerViewStatus: lastViewedAt ? 'viewed' : 'unviewed',
      })
    } finally {
      await app.close()
    }
  })
  it.each(['2026-10-07 02:40:02', null])('列表兼容首次查看时间 %s', async (firstViewedAt) => {
    const app = Fastify()
    app.get('/quotations', {
      schema: { response: { 200: PaginatedEnvelopeSchema(QuotationListItemRespSchema) } },
    }, async (_request, reply) => {
      const result = await QuotationRepository.list({}, quotationDb(firstViewedAt))
      return ResponseUtil.paginated(reply, result.rows, 1, 10, result.total)
    })
    try {
      const response = await app.inject('/quotations')
      expect(response.statusCode).toBe(200)
      expect(response.json().data[0].shareFirstViewedAt).toBe(firstViewedAt ? '2026-10-07T02:40:02.000Z' : null)
      expect(response.json().pagination.total).toBe(1)
      expect(response.json().data[0].hasShare).toBe(true)
    } finally {
      await app.close()
    }
  })

  it.each(['2026-10-07 02:40:02', null])('详情兼容首次查看时间 %s', async (firstViewedAt) => {
    const app = Fastify()
    app.get('/quotations/1', {
      schema: { response: { 200: EnvelopeSchema(QuotationRespSchema) } },
    }, async (_request, reply) => {
      const head = await QuotationRepository.findById(1, quotationDb(firstViewedAt))
      return ResponseUtil.success(reply, { ...head, items: [] })
    })
    try {
      const response = await app.inject('/quotations/1')
      expect(response.statusCode).toBe(200)
      expect(response.json().data.shareFirstViewedAt).toBe(firstViewedAt ? '2026-10-07T02:40:02.000Z' : null)
    } finally {
      await app.close()
    }
  })
})
