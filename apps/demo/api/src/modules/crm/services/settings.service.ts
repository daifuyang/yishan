import { BusinessError } from '@yishan/core-api/errors'
import type { AppQueryDb } from '@yishan/core-system-api/database'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  TagRepository,
  type TagListQuery,
  type TagRow,
  type CreateTagInput,
  type UpdateTagInput,
} from '../repositories/tag.repository.js'
import {
  SourceRepository,
  type SourceListQuery,
  type SourceRow,
  type CreateSourceInput,
  type UpdateSourceInput,
} from '../repositories/source.repository.js'

/**
 * SettingsService —— 标签 / 状态 / 来源的 CRUD 业务编排。
 *
 * 第一版策略：
 *   - 全部仅做"基础 CRUD + 唯一性校验"；
 *   - 系统预置的 status（is_system=1）禁止 delete，update 也仅允许改 name/sort/enabled。
 */

export class TagService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  async list(query: TagListQuery): Promise<{ total: number; items: TagRow[]; page: number; pageSize: number }> {
    const { rows, total } = await TagRepository.list(query, this.deps.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 200 }
  }

  async listAllEnabled(): Promise<TagRow[]> {
    return TagRepository.listAllEnabled(this.deps.db)
  }

  async findById(id: number): Promise<TagRow | null> {
    return TagRepository.findById(id, this.deps.db)
  }

  async create(input: CreateTagInput): Promise<TagRow> {
    const dupe = await TagRepository.findByName(input.name, undefined, this.deps.db)
    if (dupe) {
      throw new BusinessError(CrmErrorCode.CRM_TAG_NAME_DUPLICATE, '标签名称已存在')
    }
    return TagRepository.create(input, this.deps.db)
  }

  async update(id: number, input: UpdateTagInput): Promise<TagRow | null> {
    const existing = await TagRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_TAG_NOT_FOUND, '标签不存在')
    }
    if (input.name !== undefined && input.name !== existing.name) {
      const dupe = await TagRepository.findByName(input.name, id, this.deps.db)
      if (dupe) {
        throw new BusinessError(CrmErrorCode.CRM_TAG_NAME_DUPLICATE, '标签名称已存在')
      }
    }
    return TagRepository.update(id, input, this.deps.db)
  }

  async remove(id: number): Promise<void> {
    const existing = await TagRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_TAG_NOT_FOUND, '标签不存在')
    }
    await TagRepository.softDelete(id, this.deps.db)
  }
}

export class SourceService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  async list(query: SourceListQuery): Promise<{ total: number; items: SourceRow[]; page: number; pageSize: number }> {
    const { rows, total } = await SourceRepository.list(query, this.deps.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 200 }
  }

  async findById(id: number): Promise<SourceRow | null> {
    return SourceRepository.findById(id, this.deps.db)
  }

  async create(input: CreateSourceInput): Promise<SourceRow> {
    const dupe = await SourceRepository.findByName(input.name, undefined, this.deps.db)
    if (dupe) {
      throw new BusinessError(CrmErrorCode.CRM_SOURCE_NAME_DUPLICATE, '来源名称已存在')
    }
    return SourceRepository.create(input, this.deps.db)
  }

  async update(id: number, input: UpdateSourceInput): Promise<SourceRow | null> {
    const existing = await SourceRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_SOURCE_NOT_FOUND, '客户来源不存在')
    }
    if (input.name !== undefined && input.name !== existing.name) {
      const dupe = await SourceRepository.findByName(input.name, id, this.deps.db)
      if (dupe) {
        throw new BusinessError(CrmErrorCode.CRM_SOURCE_NAME_DUPLICATE, '来源名称已存在')
      }
    }
    return SourceRepository.update(id, input, this.deps.db)
  }

  async remove(id: number): Promise<void> {
    const existing = await SourceRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_SOURCE_NOT_FOUND, '客户来源不存在')
    }
    await SourceRepository.softDelete(id, this.deps.db)
  }
}
