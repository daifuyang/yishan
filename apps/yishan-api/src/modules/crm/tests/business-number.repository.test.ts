import { describe, expect, it, vi } from 'vitest'
import { BusinessNumberRepository } from '../repositories/business-number.repository.js'

describe('BusinessNumberRepository', () => {
  it('increments a prefix atomically and returns the allocated value', async () => {
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined)
    const db = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ onDuplicateKeyUpdate })),
      })),
      execute: vi.fn().mockResolvedValue([{ next_value: 8 }]),
    } as any
    await expect(BusinessNumberRepository.next('OPP-202610-', db)).resolves.toBe(7)
    expect(db.insert).toHaveBeenCalled()
    expect(onDuplicateKeyUpdate).toHaveBeenCalled()
    expect(db.execute).toHaveBeenCalled()
  })
})
