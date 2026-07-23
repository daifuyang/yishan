/**
 * portal 模块 repository 冒烟测试。
 *
 * 验证去重 / soft delete 行为（不需要真 DB；用 vi.spyOn 拦 repository）。
 */

import { describe, expect, it, vi } from 'vitest'
import { CategoriesRepository } from '../repositories/categories.repository.js'
import { CategoriesService } from '../services/categories.service.js'

describe('CategoriesService', () => {
  it('rejects create when name + parent already exists', async () => {
    const dupe = { id: 99, name: '新闻', parentId: null } as never
    const findSpy = vi.spyOn(CategoriesRepository, 'findByNameAndParent').mockResolvedValue(dupe)
    const svc = new CategoriesService({} as never)

    await expect(
      svc.create({ name: '新闻', creatorId: 1, updaterId: 1 } as never),
    ).rejects.toThrow('Category already exists under the same parent')
    expect(findSpy).toHaveBeenCalled()
  })

  it('allows create when no duplicate', async () => {
    vi.spyOn(CategoriesRepository, 'findByNameAndParent').mockResolvedValue(null)
    const createSpy = vi
      .spyOn(CategoriesRepository, 'create')
      .mockResolvedValue({ id: 1, name: '新闻', parentId: null } as never)
    const svc = new CategoriesService({} as never)
    const row = await svc.create({ name: '新闻', creatorId: 1, updaterId: 1 } as never)
    expect(row.id).toBe(1)
    expect(createSpy).toHaveBeenCalledOnce()
  })
})
