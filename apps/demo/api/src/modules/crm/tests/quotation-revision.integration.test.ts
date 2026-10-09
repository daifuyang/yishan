import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import { afterAll, beforeAll, describe, expect, it, vi } from '../../../../test/runtime-fixture'

// 专用测试库须预先迁移并填入沙盘源报价，绝不在业务库运行。
const url = process.env.YISHAN_QUOTE_TEST_DATABASE_URL
describe.runIf(Boolean(url))('quotation revision: real MySQL concurrency', () => {
  let pool: mysql.Pool
  let service: import('../services/quotation.service.js').QuotationService
  let repository: typeof import('../repositories/quotation.repository.js').QuotationRepository
  const user = { id: 1, roleCodes: ['super_admin'], deptIds: [] }
  beforeAll(async () => {
    const database = new URL(url!).pathname.slice(1)
    if (!/^yishan_quote_revision_test_\d+$/.test(database)) throw new Error('Must use a dedicated quote revision test database')
    pool = mysql.createPool({ uri: url!, connectionLimit: 4 })
    vi.doUnmock('@yishan/core-system-api/database'); vi.resetModules()
    const schema = await import('@yishan/core-system-api/schema')
    const db = drizzle(pool, { schema: schema.schema, mode: 'default' })
    vi.doMock('@yishan/core-system-api/database', () => ({ drizzleDb: db, pool, dbManager: { transaction: db.transaction.bind(db) } }))
    const { QuotationService } = await import('../services/quotation.service.js')
    repository = (await import('../repositories/quotation.repository.js')).QuotationRepository
    service = new QuotationService()
  })
  afterAll(async () => { await pool?.end(); vi.doUnmock('@yishan/core-system-api/database'); vi.resetModules() })
  it('allocates V2 and V3 concurrently, then V4 from V2, without altering V1 or its share', async () => {
    const before = await service.findDetailById(1, user)
    const revisions = await Promise.all([service.reviseQuotation(1, user), service.reviseQuotation(1, user)])
    expect(revisions.map(row => row.head.version).sort()).toEqual([2, 3])
    expect(new Set(revisions.map(row => row.head.quotationNo)).size).toBe(2)
    for (const row of revisions) {
      expect(row.head).toMatchObject({ rootQuoteId: 1, sourceQuoteId: 1, status: 'draft', sentAt: null, hasShare: false })
      expect(row.share).toBeNull(); expect(row.items).toHaveLength(4)
    }
    const v2 = revisions.find(row => row.head.version === 2)!
    const edited = await service.updateDraft(v2.head.id, { discountAmountCents: 600000, publicDiscountDescription: '首期合作优惠', internalDiscountReason: '竞争性报价' }, user)
    expect(edited.head).toMatchObject({ totalCents: 6400000, status: 'draft' })
    await pool.query('UPDATE crm_quotation SET status = ? WHERE id = ?', ['voided', v2.head.id])
    const v4 = await service.reviseQuotation(v2.head.id, user)
    expect(v4.head).toMatchObject({ version: 4, sourceQuoteId: v2.head.id, rootQuoteId: 1 })
    await expect(service.updateDraft(1, { discountAmountCents: 600000 }, user)).rejects.toThrow('草稿')
    expect(await service.findDetailById(1, user)).toEqual(before)
    const [shares] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM crm_quotation_share WHERE quotation_id <> 1')
    expect(shares).toHaveLength(0)
    // 即使绕过业务锁直接写同系列重复版本，数据库约束也必须拒绝。
    await expect(repository.create({
      quotationNo: 'duplicate-series-version', version: 2, rootQuoteId: 1, sourceQuoteId: 1,
      name: 'duplicate', customerId: 23, opportunityId: 1, contactId: 15, ownerUserId: 1,
      status: 'draft', netCents: 0, taxCents: 0, totalCents: 0, discountAmountCents: 0, creatorId: 1, updaterId: 1,
    })).rejects.toThrow()
  })
})
