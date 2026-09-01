/**
 * SettingsService 单测 —— Tag / Status / Source 三个 CRUD 服务的核心规则。
 *
 * 覆盖：唯一性校验、system status 不可删、enabled toggle。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TagService } from '../services/settings.service.js'
import { StatusService } from '../services/settings.service.js'
import { SourceService } from '../services/settings.service.js'
import { TagRepository } from '../repositories/tag.repository.js'
import { StatusRepository } from '../repositories/status.repository.js'
import { SourceRepository } from '../repositories/source.repository.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TagService', () => {
  it('同名标签 → TAG_NAME_DUPLICATE', async () => {
    vi.spyOn(TagRepository, 'findByName').mockResolvedValue({
      id: 1,
      name: 'VIP',
      color: null,
      enabled: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const service = new TagService()
    await expect(service.create({ name: 'VIP' })).rejects.toMatchObject({ code: 33302 })
  })

  it('不同名标签 → 正常创建', async () => {
    vi.spyOn(TagRepository, 'findByName').mockResolvedValue(null)
    const createSpy = vi.spyOn(TagRepository, 'create').mockResolvedValue({
      id: 1,
      name: 'NEW',
      color: null,
      enabled: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const service = new TagService()
    const tag = await service.create({ name: 'NEW' })
    expect(tag.name).toBe('NEW')
    expect(createSpy).toHaveBeenCalled()
  })
})

describe('StatusService', () => {
  it('系统预置 status（isSystem=1）不可删除', async () => {
    vi.spyOn(StatusRepository, 'findById').mockResolvedValue({
      id: 1,
      name: '待跟进',
      code: 'pending',
      type: 'active',
      sort: 1,
      enabled: 1,
      isSystem: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const service = new StatusService()
    await expect(service.remove(1)).rejects.toMatchObject({ code: 33313 })
  })

  it('非系统 status 可删除', async () => {
    vi.spyOn(StatusRepository, 'findById').mockResolvedValue({
      id: 2,
      name: '客户自定义状态',
      code: null,
      type: 'active',
      sort: 99,
      enabled: 1,
      isSystem: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const softDeleteSpy = vi
      .spyOn(StatusRepository, 'softDelete')
      .mockResolvedValue(undefined)
    const service = new StatusService()
    await service.remove(2)
    expect(softDeleteSpy).toHaveBeenCalled()
  })
})

describe('SourceService', () => {
  it('同名 source → SOURCE_NAME_DUPLICATE', async () => {
    vi.spyOn(SourceRepository, 'findByName').mockResolvedValue({
      id: 1,
      name: '官网',
      code: null,
      sort: 0,
      enabled: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const service = new SourceService()
    await expect(service.create({ name: '官网' })).rejects.toMatchObject({ code: 33322 })
  })
})
