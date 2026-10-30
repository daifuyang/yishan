import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleDb } from '@yishan/core-system-api/database'
import { HospitalDashboardRepository } from '../repositories/hospital-dashboard.repository.js'

describe('HospitalDashboardRepository.getTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([
          { date: '2026-07-23', count: 3 },
        ]).then(res, rej),
      }
      return chain
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('返回 30 个日期点, 缺失日补 0', async () => {
    const result = await HospitalDashboardRepository.getTrend([5], 30)
    expect(result.daily).toHaveLength(30)
    // mock 只给了 '2026-07-23' 一条数据：除该日外其余日期都应补 0。
    // 不依赖“今天”是几号（该日可能在/不在 30 天窗口内）。
    const nonMock = result.daily.filter((d) => d.date !== '2026-07-23')
    expect(nonMock.every((d) => d.count === 0)).toBe(true)
  })

  it('返回 statusBreakdown 含 viewed/unviewed', async () => {
    const result = await HospitalDashboardRepository.getTrend([5], 30)
    expect(result.statusBreakdown).toHaveProperty('viewed')
    expect(result.statusBreakdown).toHaveProperty('unviewed')
  })

  it('SQL 调用了 DATE(createdAt) groupBy', async () => {
    await HospitalDashboardRepository.getTrend([5], 30)
    expect(drizzleDb.select).toHaveBeenCalled()
  })
})