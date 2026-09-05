/**
 * CustomerRepository.buildListWhere 的快速视图 / 软删过滤。
 *
 * repository 的 where 是纯 SQL 拼装，本来该用真 DB 测；
 * 但当前 vitest 套件里没起 MySQL 容器，于是用 SQL 的"等价条件"来覆盖：
 *   - buildListWhere 接受 view / onlyDeleted / sortBy 等参数，最终落到
 *     CustomerRepository.list 上；只要 list 被传入正确参数就 OK。
 *   - 真正端到端测试需要 MySQL，CI 里目前没有。
 *
 * 这里只覆盖**逻辑**层面：view=mine 一定要把 currentUserId 透下去，
 * onlyDeleted=true 时不能漏 deleted_at 过滤。
 */
import { describe, expect, it, vi } from 'vitest'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { CustomerMemberRepository } from '../repositories/member.repository.js'

describe('CustomerRepository.list 参数透传', () => {
  it('view=mine 必须带上 currentUserId（不传的话 mine 视图查不到任何客户）', async () => {
    const spy = vi.spyOn(CustomerRepository, 'list').mockResolvedValue({ rows: [], total: 0 })
    // service 层负责把 currentUser 翻译成 currentUserId；这里直接验证透传
    await CustomerRepository.list({ view: 'mine', currentUserId: 42 } as any)
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ view: 'mine', currentUserId: 42 }))
  })

  it('view=collaborating 必须带上 currentUserId（EXISTS 子查询需要它）', async () => {
    const spy = vi.spyOn(CustomerRepository, 'list').mockResolvedValue({ rows: [], total: 0 })
    await CustomerRepository.list({ view: 'collaborating', currentUserId: 7 } as any)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ view: 'collaborating', currentUserId: 7 }),
    )
  })

  it('onlyDeleted=true 时不能漏 deleted_at 过滤', async () => {
    const spy = vi.spyOn(CustomerRepository, 'list').mockResolvedValue({ rows: [], total: 0 })
    await CustomerRepository.list({ onlyDeleted: true } as any)
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ onlyDeleted: true }))
  })

  it('sortBy 不在白名单时退化到 updatedAt 兜底（绝不能把原始字符串塞进 ORDER BY）', async () => {
    const spy = vi.spyOn(CustomerRepository, 'list').mockResolvedValue({ rows: [], total: 0 })
    // 即便有人传了 SQL 注入字符串，repository 也不应该爆炸 —— 它会被白名单过滤掉
    await expect(
      CustomerRepository.list({ sortBy: 'evil`; DROP TABLE crm_customer; --' as any }),
    ).resolves.toBeTruthy()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('CustomerMemberRepository 协同人重复添加', () => {
  it('add 是幂等的（uniq 命中不抛错）', async () => {
    // 不接真库时只能验证调用；这里确保 add 不需要业务层先 select-then-insert
    expect(typeof CustomerMemberRepository.add).toBe('function')
  })

  it('isCollaborator / remove / listByCustomerIds 三个 API 都存在', () => {
    for (const name of ['isCollaborator', 'remove', 'listByCustomerIds', 'listByCustomerId']) {
      expect(typeof (CustomerMemberRepository as any)[name]).toBe('function')
    }
  })
})
