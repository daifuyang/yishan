/**
 * SettingsService 单测 —— Tag / Status / Source 三个 CRUD 服务的核心规则。
 *
 * 覆盖：唯一性校验、system status 不可删、enabled toggle。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TagService } from '../services/settings.service.js'
import { SourceService } from '../services/settings.service.js'
import { TagRepository } from '../repositories/tag.repository.js'
import { SourceRepository } from '../repositories/source.repository.js'
import * as settings from '../services/settings.service.js'

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

describe('customer lifecycle status settings', () => {
  it('does not expose mutable customer status CRUD', () => {
    expect((settings as Record<string, unknown>).StatusService).toBeUndefined()
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
