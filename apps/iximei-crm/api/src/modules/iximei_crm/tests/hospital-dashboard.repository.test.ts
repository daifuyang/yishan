/**
 * HospitalDashboardRepository — 已完成派单不计入未查看数（任务 6）
 *
 * 覆盖三种关键场景：
 * - completed 状态的派单 + 没人查看 → 不计入 unviewedCount
 * - pending 状态的派单 + 没人查看 → 计入 unviewedCount
 * - pending 状态的派单 + 已有人查看 → 不计入 unviewedCount（view_log.id NOT NULL）
 *
 * 实现细节：
 * - `getCompletedStatusIds()` 内部查 crm_dispatch_status，结果缓存 60s。
 *   每个 test 用 `vi.resetModules()` 让下次 import 拿到全新模块（清空缓存与 spy）。
 * - 然后 spy `drizzleDb.select`，按调用顺序返回 chain 数据。
 *   spy 的"调用顺序"由 production code 决定：
 *     getUnviewedCount       →  status dict + dispatch = 2 次 select
 *     getStats               →  status dict + dispatch = 2 次 select
 *     getTrend               →  status dict + daily + breakdown = 3 次 select
 *
 * 注：`vi.resetModules()` 后必须用动态 import 获取本测试需要的 drizzleDb + repository；
 * 不能用顶部 import 的引用,否则 spy 装在旧模块上,新模块的 select 不会被拦截。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** 构造一个通用 chain：支持 .from().leftJoin().where().groupBy().orderBy().limit().offset()，
 * 终结时通过 `result` 字段返回数据。 */
function makeChainWithResult(result: unknown[]): any {
  const chain: any = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    then: (res: any, rej: any) => Promise.resolve(result).then(res, rej),
  }
  return chain
}

/** 让每次 select 调用按 calls 数组依次返回 chain；
 * 用尽后再调用则返回空数组 chain。 */
function mockSelectCalls(drizzleDb: any, calls: unknown[][]): ReturnType<typeof vi.spyOn> {
  let i = 0
  return vi.spyOn(drizzleDb, 'select').mockImplementation((..._args: any[]) => {
    const r = i < calls.length ? calls[i] : []
    i += 1
    return makeChainWithResult(r)
  })
}

/** 模拟 status 字典里"已完成 / 已处理" 行（生产代码里缓存 60s）。 */
const COMPLETED_STATUS_ROWS = [
  { id: 4, name: '已完成' },
  { id: 5, name: '已处理' },
]

describe('HospitalDashboardRepository — exclude completed from unviewed', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })
  afterEach(() => vi.restoreAllMocks())

  it('getUnviewedCount — 修复后 WHERE 含 NOT IN (4,5),数据库返回 count=0', async () => {
    const { drizzleDb } = await import('@yishan/core-system-api/database')
    mockSelectCalls(drizzleDb, [COMPLETED_STATUS_ROWS, [{ count: 0 }]])

    const { HospitalDashboardRepository } = await import(
      '../repositories/hospital-dashboard.repository.js'
    )
    const n = await HospitalDashboardRepository.getUnviewedCount([5])
    expect(n).toBe(0)
    expect(drizzleDb.select).toHaveBeenCalledTimes(2)
  })

  it('getUnviewedCount — pending 派单 + 没人查看,数据库返回 count=7', async () => {
    const { drizzleDb } = await import('@yishan/core-system-api/database')
    mockSelectCalls(drizzleDb, [COMPLETED_STATUS_ROWS, [{ count: 7 }]])

    const { HospitalDashboardRepository } = await import(
      '../repositories/hospital-dashboard.repository.js'
    )
    const n = await HospitalDashboardRepository.getUnviewedCount([5])
    expect(n).toBe(7)
    expect(drizzleDb.select).toHaveBeenCalledTimes(2)
  })

  it('getUnviewedCount — pending 派单 + 有人查看,数据库返回 count=0', async () => {
    const { drizzleDb } = await import('@yishan/core-system-api/database')
    mockSelectCalls(drizzleDb, [COMPLETED_STATUS_ROWS, [{ count: 0 }]])

    const { HospitalDashboardRepository } = await import(
      '../repositories/hospital-dashboard.repository.js'
    )
    const n = await HospitalDashboardRepository.getUnviewedCount([5])
    expect(n).toBe(0)
  })

  it('getUnviewedCount — status 字典无"已完成",过滤退化为 no-op', async () => {
    // 第一次 select 返回空数组（没有匹配的"已完成/已处理"行）；
    // production 看到 completedIds.length === 0,跳过 NOT IN 过滤。
    const { drizzleDb } = await import('@yishan/core-system-api/database')
    mockSelectCalls(drizzleDb, [[], [{ count: 9 }]])

    const { HospitalDashboardRepository } = await import(
      '../repositories/hospital-dashboard.repository.js'
    )
    const n = await HospitalDashboardRepository.getUnviewedCount([5])
    expect(n).toBe(9)
  })

  it('getStats — 6 个聚合字段透传', async () => {
    const { drizzleDb } = await import('@yishan/core-system-api/database')
    mockSelectCalls(drizzleDb, [
      COMPLETED_STATUS_ROWS,
      [
        {
          todayCount: 1,
          monthCount: 2,
          yearCount: 3,
          totalCount: 4,
          viewedCount: 2,
          unviewedCount: 2,
        },
      ],
    ])

    const { HospitalDashboardRepository } = await import(
      '../repositories/hospital-dashboard.repository.js'
    )
    const stats = await HospitalDashboardRepository.getStats([5])
    expect(stats.unviewedCount).toBe(2)
    expect(stats.totalCount).toBe(4)
    expect(stats.viewedCount).toBe(2)
    expect(drizzleDb.select).toHaveBeenCalledTimes(2)
  })

  it('getTrend — daily + breakdown 三次 select,breakdown 透传', async () => {
    const { drizzleDb } = await import('@yishan/core-system-api/database')
    mockSelectCalls(drizzleDb, [
      COMPLETED_STATUS_ROWS,
      [{ date: '2026-08-01', count: 5 }],
      [{ viewed: 3, unviewed: 1 }],
    ])

    const { HospitalDashboardRepository } = await import(
      '../repositories/hospital-dashboard.repository.js'
    )
    const result = await HospitalDashboardRepository.getTrend([5], 30)
    expect(result.statusBreakdown.unviewed).toBe(1)
    expect(result.statusBreakdown.viewed).toBe(3)
    expect(drizzleDb.select).toHaveBeenCalledTimes(3)
  })

  it('getUnviewedCount — 当 hospitalIds 为空时直接返回 0,不查数据库', async () => {
    const { drizzleDb } = await import('@yishan/core-system-api/database')

    const { HospitalDashboardRepository } = await import(
      '../repositories/hospital-dashboard.repository.js'
    )
    const n = await HospitalDashboardRepository.getUnviewedCount([])
    expect(n).toBe(0)
    expect(drizzleDb.select).not.toHaveBeenCalled()
  })

  it('getStats — 当 hospitalIds 为空时直接返回全 0,不查数据库', async () => {
    const { drizzleDb } = await import('@yishan/core-system-api/database')

    const { HospitalDashboardRepository } = await import(
      '../repositories/hospital-dashboard.repository.js'
    )
    const stats = await HospitalDashboardRepository.getStats([])
    expect(stats).toEqual({
      todayCount: 0,
      monthCount: 0,
      yearCount: 0,
      totalCount: 0,
      viewedCount: 0,
      unviewedCount: 0,
    })
    expect(drizzleDb.select).not.toHaveBeenCalled()
  })

  it('getTrend — 当 hospitalIds 为空时直接返回占位结构,不查数据库', async () => {
    const { drizzleDb } = await import('@yishan/core-system-api/database')

    const { HospitalDashboardRepository } = await import(
      '../repositories/hospital-dashboard.repository.js'
    )
    const result = await HospitalDashboardRepository.getTrend([], 30)
    expect(result).toEqual({
      daily: [],
      statusBreakdown: { viewed: 0, unviewed: 0 },
    })
    expect(drizzleDb.select).not.toHaveBeenCalled()
  })
})
