import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleDb } from '@yishan/core-system-api/database'
import { DispatchesRepository } from '../repositories/dispatches.repository.js'

describe('DispatchesRepository.viewLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(drizzleDb, 'insert').mockImplementation(() => {
      const chain: any = {
        values: vi.fn(() => chain),
        onDuplicateKeyUpdate: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([{ insertId: 1 }]).then(res, rej),
      }
      return chain
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('recordView 调用 drizzle insert + onDuplicateKeyUpdate', async () => {
    await DispatchesRepository.recordView({
      dispatchId: 100,
      hospitalId: 5,
      viewerUserId: 7,
      viewerUsername: 'hospital_a',
      viewerHospitalName: 'A 医院',
      ipAddress: '127.0.0.1',
    } as any)
    expect(drizzleDb.insert).toHaveBeenCalled()
  })

  it('listViewLogs 返回某派单的全部记录', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([]).then(res, rej),
      }
      return chain
    })
    const result = await DispatchesRepository.listViewLogs(100)
    expect(result).toEqual([])
  })
})