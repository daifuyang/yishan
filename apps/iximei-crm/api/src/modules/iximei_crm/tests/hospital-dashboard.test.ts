/**
 * 医院后台数据看板 repository 测试。
 *
 * 覆盖两条核心 SQL：
 * 1. getStats(hospitalId) — 单条聚合 4 个时间桶 + viewed/unviewed
 * 2. getUnviewedCount(hospitalId) — 未查看派单数（LEFT JOIN + IS NULL）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleDb } from '@yishan/core-system-api/database'
import { HospitalDashboardRepository } from '../repositories/hospital-dashboard.repository.js'

describe('HospitalDashboardRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => vi.restoreAllMocks())

  it('getStats 返回 4 个时间桶 + viewed/unviewed 共 6 个字段', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        then: (res: any, rej: any) =>
          Promise.resolve([
            {
              todayCount: 3,
              monthCount: 12,
              yearCount: 120,
              totalCount: 200,
              viewedCount: 80,
              unviewedCount: 120,
            },
          ]).then(res, rej),
      }
      return chain
    })
    const stats = await HospitalDashboardRepository.getStats([5])
    expect(stats).toHaveProperty('todayCount')
    expect(stats).toHaveProperty('monthCount')
    expect(stats).toHaveProperty('yearCount')
    expect(stats).toHaveProperty('totalCount')
    expect(stats).toHaveProperty('viewedCount')
    expect(stats).toHaveProperty('unviewedCount')
    expect(stats.todayCount).toBe(3)
    expect(stats.unviewedCount).toBe(120)
    // total = viewed + unviewed
    expect(stats.totalCount).toBe(stats.viewedCount + stats.unviewedCount)
  })

  it('getStats 当无数据时返回全 0', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([]).then(res, rej),
      }
      return chain
    })
    const stats = await HospitalDashboardRepository.getStats([99])
    expect(stats.todayCount).toBe(0)
    expect(stats.viewedCount).toBe(0)
    expect(stats.unviewedCount).toBe(0)
  })

  it('getUnviewedCount 返回派单未查看数量', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([{ count: 7 }]).then(res, rej),
      }
      return chain
    })
    const n = await HospitalDashboardRepository.getUnviewedCount([5])
    expect(n).toBe(7)
  })

  it('getUnviewedCount 当无未查看派单时返回 0', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([]).then(res, rej),
      }
      return chain
    })
    const n = await HospitalDashboardRepository.getUnviewedCount([5])
    expect(n).toBe(0)
  })
})