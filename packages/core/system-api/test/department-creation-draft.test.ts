import { afterEach, expect, it, vi } from './runtime-fixture'
import { testRuntime } from './runtime-fixture'
import { DeptService } from '../src/core/services/dept.service'
import { DeptRepository } from '../src/core/repositories/dept.repository'
import type { AppTx } from '../src/db'

afterEach(() => vi.restoreAllMocks())

it('refuses draft submission when its transaction participant is absent', async () => {
  await expect(DeptService.createDept({ name: '研发部', draftSubmission: { draftId: 'd1', draftVersion: 1 } }, 7)).rejects.toThrow('草稿')
})

it('normalizes the native root sentinel to null so a newly created department appears in the root tree', async () => {
  vi.spyOn(DeptRepository, 'findByName').mockResolvedValue(null)
  const saved = { id: 9, name: '总部', parentId: null as number | null, status: 1, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() }
  const create = vi.spyOn(DeptRepository, 'create').mockImplementation(async input => {
    saved.parentId = input.parentId ?? null
    return saved as Awaited<ReturnType<typeof DeptRepository.create>>
  })
  vi.spyOn(DeptRepository, 'getDeptTree').mockImplementation(async () => [saved] as Awaited<ReturnType<typeof DeptRepository.getDeptTree>>)
  await DeptService.createDept({ name: '总部', parentId: 0 }, 7)
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ parentId: null }), undefined)
  expect(await DeptService.getDeptTree()).toMatchObject([{ id: 9, name: '总部' }])
})

it('replays the completed department without issuing another creation', async () => {
  const tx = {} as AppTx
  vi.spyOn(DeptRepository, 'transaction').mockImplementation(async operation => operation(tx))
  const existing = { id: 9, name: '研发部', status: 1, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() }
  vi.spyOn(DeptRepository, 'findById').mockResolvedValue(existing as Awaited<ReturnType<typeof DeptRepository.findById>>)
  const create = vi.spyOn(DeptRepository, 'create')
  testRuntime().options.departmentCreationParticipant = {
    claim: async () => ({ kind: 'replay', departmentId: 9 }), complete: async () => {},
  }
  expect((await DeptService.createDept({ name: '研发部', draftSubmission: { draftId: 'd1', draftVersion: 1 } }, 7)).id).toBe(9)
  expect(create).not.toHaveBeenCalled()
})

it('uses the actor and one transaction for the existing creation and its draft receipt', async () => {
  const tx = {} as AppTx
  vi.spyOn(DeptRepository, 'transaction').mockImplementation(async operation => operation(tx))
  vi.spyOn(DeptRepository, 'findByName').mockResolvedValue(null)
  const created = { id: 9, name: '研发部', status: 1, sortOrder: 3, createdAt: new Date(), updatedAt: new Date() }
  const create = vi.spyOn(DeptRepository, 'create').mockResolvedValue(created as Awaited<ReturnType<typeof DeptRepository.create>>)
  const complete = vi.fn(async () => {})
  testRuntime().options.departmentCreationParticipant = {
    claim: async () => ({ kind: 'create', fields: { name: '研发部', sort_order: 3 } }), complete,
  }
  const submission = { draftId: 'd1', draftVersion: 1 }
  await DeptService.createDept({ name: '研发部', sort_order: 3, draftSubmission: submission }, 7)
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: '研发部', sortOrder: 3, creatorId: 7, updaterId: 7 }), tx)
  expect(complete).toHaveBeenCalledWith(tx, 7, submission, expect.objectContaining({ id: 9 }))
})

it('rejects client fields differing from the persisted draft before creation', async () => {
  vi.spyOn(DeptRepository, 'transaction').mockImplementation(async operation => operation({} as AppTx))
  const create = vi.spyOn(DeptRepository, 'create')
  testRuntime().options.departmentCreationParticipant = {
    claim: async () => ({ kind: 'create', fields: { name: '研发部' } }), complete: async () => {},
  }
  await expect(DeptService.createDept({ name: '财务部', draftSubmission: { draftId: 'd1', draftVersion: 1 } }, 7)).rejects.toThrow('不一致')
  expect(create).not.toHaveBeenCalled()
})

it('propagates receipt failure through the transaction before recording recoverable failure', async () => {
  const events: string[] = []
  vi.spyOn(DeptRepository, 'transaction').mockImplementation(async operation => {
    try { return await operation({} as AppTx) } catch (error) { events.push('rollback'); throw error }
  })
  vi.spyOn(DeptRepository, 'findByName').mockResolvedValue(null)
  const created = { id: 9, name: '研发部', status: 1, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() }
  vi.spyOn(DeptRepository, 'create').mockImplementation(async () => { events.push('insert'); return created as Awaited<ReturnType<typeof DeptRepository.create>> })
  testRuntime().options.departmentCreationParticipant = {
    claim: async () => { events.push('claim'); return { kind: 'create', fields: { name: '研发部' } } },
    complete: async () => { events.push('receipt'); throw new Error('receipt unavailable') },
    fail: async () => { events.push('failed') },
  }
  await expect(DeptService.createDept({ name: '研发部', draftSubmission: { draftId: 'd1', draftVersion: 1 } }, 7)).rejects.toThrow('receipt unavailable')
  expect(events).toEqual(['claim', 'insert', 'receipt', 'rollback', 'failed'])
})
