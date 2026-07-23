import { describe, expect, it, vi } from 'vitest'
import { CategoriesRepository } from '../repositories/categories.repository.js'
import { CategoriesService } from '../services/categories.service.js'

describe('CategoriesService', () => {
  it('create delegates to repository', async () => {
    const createSpy = vi
      .spyOn(CategoriesRepository, 'create')
      .mockResolvedValue({ id: 1, name: '服饰' } as never)
    const svc = new CategoriesService({} as never)
    const row = await svc.create({ name: '服饰', creatorId: 1, updaterId: 1 } as never)
    expect(row.id).toBe(1)
    expect(createSpy).toHaveBeenCalledOnce()
  })

  it('remove throws when not found', async () => {
    vi.spyOn(CategoriesRepository, 'findById').mockResolvedValue(null)
    const svc = new CategoriesService({} as never)
    await expect(svc.remove(99)).rejects.toThrow('Category not found')
  })
})
