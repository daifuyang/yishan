/**
 * MembersRepository.listSelectableCustomers — mobile 精确 / name 前缀 / keyword 模糊
 *
 * 覆盖：
 *   1. { mobile: '13800138000' } 走精确相等分支：WHERE 含 eq(crmCustomer.mobile, '13800138000')
 *   2. { name: '张三' } 走前缀 LIKE 分支：WHERE 含 like(crmCustomer.name, '张三%')
 *   3. { keyword: '13800' } 回退到原 LIKE 模糊（向后兼容）：WHERE 含 %keyword% 模糊
 *   4. { mobile: '123' }（非法格式）回退到 keyword 模糊分支，不走精确匹配
 *
 * 选型说明：
 *   仓库 vitest 已在 test/setup.ts 全局 auto-mock `@yishan/core-system-api/database`、`@yishan/core-system-api/database/manager.js`、
 *   `@yishan/core-system-api/database/client.js`，把 drizzleDb 替换为可链接的 chain（终端 resolve 到 []）。
 *   listSelectableCustomers 走 Drizzle ORM 拼 SQL；通过接管 select() 链捕获
 *   where() 入参（Drizzle 的 SQL/Column/StringChunk 节点）并递归展开成可读文本，
 *   既能区分 mobile/name/keyword 三条分支，又不依赖真实 MySQL。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleDb } from '@yishan/core-system-api/database'
import { MembersRepository } from '../repositories/members.repository.js'

const DRIZZLE_NAME = Symbol.for('drizzle:Name')

/**
 * 把 Drizzle SQL 节点递归展开成可读字符串：
 *   - SQL → 拼接其 queryChunks
 *   - Column → 输出 `<table[Symbol(drizzle:Name)]>.<name>`
 *   - StringChunk → 输出其 .value 数组 join 后的字符串
 *   - 其它对象 → 退化为 [ClassName]
 */
function dumpSql(node: any, seen = new WeakSet()): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number' || typeof node === 'boolean') return String(node)
  if (typeof node === 'symbol') return ''
  if (seen.has(node)) return ''
  seen.add(node)
  // Drizzle Column: has .name + .table (the table object).
  // The Column's table.name is actually a Column (cycle); the real table name
  // is on table[DRIZZLE_NAME].
  if (typeof node.name === 'string' && node.table && node.table[DRIZZLE_NAME]) {
    const tableName = String(node.table[DRIZZLE_NAME])
    return `${tableName}.${node.name}`
  }
  // Drizzle Table ref (Symbol-tagged only).
  if (node[DRIZZLE_NAME]) {
    return String(node[DRIZZLE_NAME])
  }
  // StringChunk: .value is string[]
  if (Array.isArray(node.value) && node.value.every((v: any) => typeof v === 'string')) {
    return node.value.join('')
  }
  // SQL: .queryChunks
  if (Array.isArray(node.queryChunks)) {
    return node.queryChunks.map((c: any) => dumpSql(c, seen)).join('')
  }
  // 兜底包装
  if (node.sql) return dumpSql(node.sql, seen)
  // Drizzle Param / Placeholder：值在 .value 里
  if (node.constructor?.name === 'Param' || node.constructor?.name === 'Placeholder') {
    return String(node.value ?? '')
  }
  return `[${node.constructor?.name ?? typeof node}]`
}

/**
 * 拿到 drizzleDb.select() 链上 where() 的所有入参（Drizzle SQL 节点）。
 */
function captureWhereConditions(): any[][] {
  const selectMock = drizzleDb.select as unknown as ReturnType<typeof vi.fn>
  const calls: any[][] = []
  for (const res of selectMock.mock.results) {
    const chain = (res?.value ?? {}) as any
    const whereMock = chain.where as ReturnType<typeof vi.fn> | undefined
    if (whereMock && whereMock.mock) {
      for (const c of whereMock.mock.calls) calls.push(c[0])
    }
  }
  return calls
}

describe('MembersRepository.listSelectableCustomers — mobile 精确 / name 前缀 / keyword 兼容', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 接管 select() 链：每个链都带 then(resolve -> [])；where/orderBy/limit/offset 都返回链
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        offset: vi.fn(() => chain),
        then: (_res: any, rej: any) => Promise.resolve([]).then(_res, rej),
      }
      return chain
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('input { mobile: "13800138000" } 走精确相等分支', async () => {
    await MembersRepository.listSelectableCustomers({
      mobile: '13800138000',
      page: 1,
      pageSize: 20,
    } as any)

    const wheres = captureWhereConditions()
    expect(wheres.length).toBeGreaterThan(0)
    const dumped = wheres.map((w) => dumpSql(w)).join(' || ')
    // 主列表查询应含 mobile 列 = 13800138000（精确）
    expect(dumped).toContain('crm_customer.mobile')
    expect(dumped).toContain('13800138000')
    // mobile 命中后不应走 keyword 模糊（两端 %）
    expect(dumped).not.toContain('%13800138000%')
  })

  it('input { name: "张三" } 走前缀 LIKE 分支', async () => {
    await MembersRepository.listSelectableCustomers({
      name: '张三',
      page: 1,
      pageSize: 20,
    } as any)

    const wheres = captureWhereConditions()
    expect(wheres.length).toBeGreaterThan(0)
    const dumped = wheres.map((w) => dumpSql(w)).join(' || ')
    // 期望生成 like '张三%'
    expect(dumped).toContain('crm_customer.name')
    expect(dumped).toContain('张三%')
    // name 前缀不应有 %张三（仅末尾 %）
    expect(dumped).not.toContain('%张三%')
  })

  it('input { keyword: "13800" } 回退到原 LIKE 模糊匹配（向后兼容）', async () => {
    await MembersRepository.listSelectableCustomers({
      keyword: '13800',
      page: 1,
      pageSize: 20,
    } as any)

    const wheres = captureWhereConditions()
    expect(wheres.length).toBeGreaterThan(0)
    const dumped = wheres.map((w) => dumpSql(w)).join(' || ')
    // keyword 模糊应包含两端各一个 %
    expect(dumped).toContain('%13800%')
    expect(dumped).toContain('crm_customer.mobile')
    expect(dumped).toContain('crm_customer.name')
  })

  it('input { mobile: "123" }（非法格式）回退到 keyword/name 分支，不走精确匹配', async () => {
    await MembersRepository.listSelectableCustomers({
      mobile: '123',
      keyword: '张',
      page: 1,
      pageSize: 20,
    } as any)

    const wheres = captureWhereConditions()
    expect(wheres.length).toBeGreaterThan(0)
    const dumped = wheres.map((w) => dumpSql(w)).join(' || ')
    // 应走 keyword 模糊（%张%）
    expect(dumped).toContain('%张%')
    // 不应走 mobile = "123" 精确匹配 —— 即不应出现 crm_customer.mobile + "123"
    // 注意 hasActiveMember 子查询用 eq(customerId, ...) 等不会含 "123"，所以这个匹配足够严格
    expect(dumped).not.toMatch(/crm_customer\.mobile.{0,40}123/)
  })

  /**
   * 用户截图场景：搜索 11 位手机号 → 列表里仍出现多条相似号码（含已是会员的客户）。
   * 根因是历史路由曾在 customers 模块下（不带 notExists 排除），后来迁到 members 模块下。
   * 现在的 listSelectableCustomers 必须把"已是活跃会员"这一谓词落到 SQL 上，否则
   * 用户体验就和当初 customers 模块那一版退化的"模糊匹配多条"无差异。
   *
   * 注意 hasActiveMember 是关联子查询 + NOT EXISTS：dumpSql 会把它展平成
   * `crm_member_customer` + `crm_member_customer.customer_id` + `crm_member_customer.member_status`
   * 这些标识符的拼接。换言之，只要主 WHERE 里能看到这些表/列字样，就足以证明
   * notExists 谓词被组装出来。
   */
  it('主 WHERE 拼上了 notExists(hasActiveMember) 子查询谓词（被转会员的客户被排除）', async () => {
    await MembersRepository.listSelectableCustomers({
      mobile: '18396533112',
      page: 1,
      pageSize: 10,
    } as any)

    const wheres = captureWhereConditions()
    expect(wheres.length).toBeGreaterThan(0)
    const dumped = wheres.map((w) => dumpSql(w)).join(' || ')

    // hasActiveMember 子查询基于 crm_member_customer：必须出现在主 WHERE 里
    expect(dumped).toContain('crm_member_customer')
    // 子查询关联外查询的 customer_id（drizzle 用 eq(crmMemberCustomer.customerId, crmCustomer.id)）
    expect(dumped).toContain('crm_member_customer.customer_id')
    // 子查询锁定 member_status = 'active'
    expect(dumped).toContain('crm_member_customer.member_status')
    expect(dumped).toContain('active')
    // deletedAt IS NULL 过滤（排除软删除的会员）
    expect(dumped).toContain('crm_member_customer.deleted_at')
  })

  /**
   * 用户期望：不输入关键词时，结果也要遵循 notExists 排除。
   * (例如清空搜索框、翻页、刷新 — 不能因为参数为空就跳过会员过滤。)
   */
  it('没有任何 search 输入时（仅分页）仍然走 notExists 排除路径', async () => {
    await MembersRepository.listSelectableCustomers({
      page: 1,
      pageSize: 10,
    } as any)

    const wheres = captureWhereConditions()
    expect(wheres.length).toBeGreaterThan(0)
    const dumped = wheres.map((w) => dumpSql(w)).join(' || ')

    // 即使没传 mobile/name/keyword，主 WHERE 也必须有 hasActiveMember 关联子查询
    expect(dumped).toContain('crm_member_customer')
    expect(dumped).toContain('crm_member_customer.member_status')
  })
})
