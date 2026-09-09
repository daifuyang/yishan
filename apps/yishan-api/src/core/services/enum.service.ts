/**
 * sys_enum Service —— 枚举中心业务编排。
 *
 * 责任：
 *   - 校验 type 必须在 SYS_ENUM_TYPES 字典内（拒绝前端传任意字符串）
 *   - 校验 code 全局唯一（联合 type 维度）
 *   - 提供 60s in-process 缓存，供前端 dropdown 与后端 service 共用
 *   - 写入时审计 createdBy/updatedBy（始终来自 currentUser，不接受前端伪造）
 *
 * 缓存语义：
 *   - 缓存 key = type
 *   - TTL = 60s
 *   - 缓存内容：code/name/sort 精简字段（不含 enabled=false 的项）
 *   - 写入/更新/删除后，调用 invalidate(type) 清掉缓存
 */
import { BusinessError } from '@/exceptions/business-error.js'
import { EnumRepository, type CreateEnumInput, type EnumListQuery, type EnumRow, type UpdateEnumInput } from '../repositories/enum.repository.js'
import { SYS_ENUM_TYPES, type SysEnumType } from '../schemas/enum.schema.js'

const CACHE_TTL_MS = 60 * 1000

interface CacheEntry {
  expiresAt: number
  items: Array<{ code: string; name: string; sort: number }>
}

const cache = new Map<string, CacheEntry>()

function invalidate(type: string): void {
  cache.delete(type)
}

function ensureValidType(type: string): void {
  if (!SYS_ENUM_TYPES.includes(type as SysEnumType)) {
    throw new BusinessError(
      1_000_001 as never,
      `不支持的 enum type: ${type}`,
    )
  }
}

export class EnumService {
  /**
   * 查询枚举列表（管理后台用：返回完整字段含 enabled、remark）。
   */
  async list(query: EnumListQuery) {
    if (query.type) ensureValidType(query.type)
    const { rows, total } = await EnumRepository.list(query)
    return {
      items: rows,
      total,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    }
  }

  /** 给前端 dropdown 用的精简版（启用项，按 sort/code 排序），走 60s 缓存。 */
  async listByType(type: string): Promise<{ type: string; items: Array<{ code: string; name: string; sort: number }>; cachedAt: string }> {
    ensureValidType(type)
    const cached = cache.get(type)
    if (cached && cached.expiresAt > Date.now()) {
      return { type, items: cached.items, cachedAt: new Date(cached.expiresAt - CACHE_TTL_MS).toISOString() }
    }
    const rows = await EnumRepository.findActiveByType(type)
    const items = rows.map((r) => ({ code: r.code, name: r.name, sort: r.sort }))
    cache.set(type, { expiresAt: Date.now() + CACHE_TTL_MS, items })
    return { type, items, cachedAt: new Date().toISOString() }
  }

  /** 一次性拉多个 type，用于首屏注入。 */
  async listByTypes(types: readonly string[]): Promise<Record<string, Array<{ code: string; name: string; sort: number }>>> {
    for (const t of types) ensureValidType(t)
    const result: Record<string, Array<{ code: string; name: string; sort: number }>> = {}
    const toFetch: string[] = []
    for (const t of types) {
      const cached = cache.get(t)
      if (cached && cached.expiresAt > Date.now()) {
        result[t] = cached.items
      } else {
        toFetch.push(t)
      }
    }
    if (toFetch.length > 0) {
      const map = await EnumRepository.findActiveByTypes(toFetch)
      for (const t of toFetch) {
        const rows = map.get(t) ?? []
        const items = rows.map((r) => ({ code: r.code, name: r.name, sort: r.sort }))
        cache.set(t, { expiresAt: Date.now() + CACHE_TTL_MS, items })
        result[t] = items
      }
    }
    return result
  }

  async create(input: CreateEnumInput, currentUser: { id: number }): Promise<EnumRow> {
    ensureValidType(input.type)
    const dupe = await EnumRepository.findByTypeAndCode(input.type, input.code)
    if (dupe) {
      throw new BusinessError(
        1_000_002 as never,
        `枚举已存在: type=${input.type} code=${input.code}`,
      )
    }
    const created = await EnumRepository.create({
      ...input,
      creatorId: currentUser.id,
      updaterId: currentUser.id,
    })
    invalidate(input.type)
    return created
  }

  async update(id: number, input: UpdateEnumInput, currentUser: { id: number }): Promise<EnumRow | null> {
    const existing = await EnumRepository.findById(id)
    if (!existing) return null
    const updated = await EnumRepository.update(id, {
      ...input,
      updaterId: currentUser.id,
    })
    invalidate(existing.type)
    return updated
  }

  async softDelete(id: number, currentUser: { id: number }): Promise<{ id: number; affected: number }> {
    const existing = await EnumRepository.findById(id)
    if (!existing) return { id, affected: 0 }
    const affected = await EnumRepository.softDelete(id)
    // softDelete 不带 updaterId；这里手动更新一次以便审计
    if (affected > 0) {
      await EnumRepository.update(id, { updaterId: currentUser.id } as UpdateEnumInput)
    }
    invalidate(existing.type)
    return { id, affected }
  }

  /** 列出所有 type 字典值（用于枚举中心首页"按 type 分组"）。 */
  async listTypes(): Promise<string[]> {
    return EnumRepository.listTypes()
  }
}
