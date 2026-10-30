/**
 * DashboardRepository.getHospitalRankings 测试。
 *
 * 覆盖单条核心 SQL：
 * - 按 dispatchCount DESC 排前 N
 * - 派生字段 viewedRate = viewed / dispatchCount * 100（保留 1 位小数）
 * - unviewedCount = max(0, dispatchCount - viewedCount)
 * - firstViewedAt 转 ISO 字符串或 null
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleDb } from '@yishan/core-system-api/database'
import { DashboardRepository } from '../repositories/dashboard.repository.js'

describe('DashboardRepository.getHospitalRankings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => vi.restoreAllMocks())

  it('按 dispatchCount DESC 排前 N，并派生 viewedRate', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (res: any, rej: any) =>
          Promise.resolve([
            {
              hospitalId: 1,
              hospitalName: 'A 医院',
              dispatchCount: 50,
              viewedCount: 30,
              replyCount: 12,
              firstViewedAt: new Date('2026-08-01T00:00:00Z'),
            },
            {
              hospitalId: 2,
              hospitalName: 'B 医院',
              dispatchCount: 30,
              viewedCount: 25,
              replyCount: 8,
              firstViewedAt: null,
            },
          ]).then(res, rej),
      }
      return chain
    })

    const result = await DashboardRepository.getHospitalRankings(10)

    expect(result).toHaveLength(2)
    expect(result[0].hospitalName).toBe('A 医院')
    expect(result[0].hospitalId).toBe(1)
    expect(result[0].dispatchCount).toBe(50)
    expect(result[0].viewedCount).toBe(30)
    // 30/50 = 60%
    expect(result[0].viewedRate).toBe(60)
    // 50 - 30
    expect(result[0].unviewedCount).toBe(20)
    expect(result[0].replyCount).toBe(12)
    expect(result[0].firstViewedAt).toBe('2026-08-01T00:00:00.000Z')

    expect(result[1].hospitalName).toBe('B 医院')
    // 25/30 = 83.333... → 83.3
    expect(result[1].viewedRate).toBe(83.3)
    expect(result[1].firstViewedAt).toBeNull()
  })

  it('当无数据时返回空数组', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([]).then(res, rej),
      }
      return chain
    })

    const result = await DashboardRepository.getHospitalRankings(10)
    expect(result).toEqual([])
  })

  it('当 dispatchCount 为 0 时 viewedRate 为 0，unviewedCount 为 0', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (res: any, rej: any) =>
          Promise.resolve([
            {
              hospitalId: 3,
              hospitalName: 'C 医院',
              dispatchCount: 0,
              viewedCount: 0,
              replyCount: 0,
              firstViewedAt: null,
            },
          ]).then(res, rej),
      }
      return chain
    })

    const result = await DashboardRepository.getHospitalRankings(10)
    expect(result).toHaveLength(1)
    expect(result[0].viewedRate).toBe(0)
    expect(result[0].unviewedCount).toBe(0)
  })
})