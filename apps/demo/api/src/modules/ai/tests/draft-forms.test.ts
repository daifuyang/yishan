import { beforeEach, describe, expect, vi } from 'vitest'
import { it } from './draft-runtime.js'

const mocks = vi.hoisted(() => ({
  loadRoleIds: vi.fn(async () => [2]), loadPermissions: vi.fn(async () => ({ perms: new Set(['system:department:create']) })),
  identity: vi.fn(async () => ({ id: 7, status: '1', deptIds: [3] })),
  references: vi.fn(async () => {}),
}))
import { PermissionService, userDirectory, DeptService, UserCreationFormService, currentDataScope, type DeptCandidateNode } from '@yishan/core-system-api'
import { authorizeDraft, draftAdapter } from '../services/draft-forms.js'
import { PermissionCatalog, AiCapabilityCatalog } from '@yishan/core-api'
import { runWithAiCapabilities } from '@yishan/core-api/ai-capabilities/catalog'
import { testRuntime } from '../../../../test/runtime-fixture.js'
import { runWithPermissions } from '@yishan/core-api/permissions/catalog'

describe('department draft authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(PermissionService, 'loadRoleIdsForUser').mockImplementation(mocks.loadRoleIds)
    vi.spyOn(PermissionService, 'loadForRoleIds').mockImplementation(mocks.loadPermissions)
    vi.spyOn(userDirectory, 'findById').mockImplementation(mocks.identity)
    vi.spyOn(DeptService, 'validateCreateReferences').mockImplementation(mocks.references)
  })
  it('rejects a PAT without department creation scope before querying references', async () => {
    const catalog = new PermissionCatalog()
    catalog.register({ code: 'system:department:create', label: '新增部门', group: 'system' })
    await expect(runWithPermissions(catalog, () => authorizeDraft('department.create', { actorId: 7, tokenScope: [] }, { leaderId: 9 }))).rejects.toThrow('没有新增部门的权限')
    expect(mocks.references).not.toHaveBeenCalled()
  })
  it('re-establishes department operation data scope for HTTP drafts instead of inheriting chat scope', async () => {
    const catalog = new PermissionCatalog()
    catalog.register({ code: 'system:department:create', label: '新增部门', group: 'system' })
    vi.spyOn(DeptService, 'validateCreateReferences').mockImplementation(async fields => {
      expect(currentDataScope()).toMatchObject({ userId: 7, roleIds: [2], deptIds: [3], permissionCode: 'system:department:create' })
      await mocks.references(fields)
    })
    await runWithPermissions(catalog, () => authorizeDraft('department.create', { actorId: 7 }, { leaderId: 9 }))
    expect(mocks.loadRoleIds).toHaveBeenCalledWith(7)
    expect(mocks.references).toHaveBeenCalledWith({ leaderId: 9 })
  })
})

describe('user draft questions', () => {
  const subject = { actorId: 7, tokenScope: ['system:user:create'] }
  const candidates = () => ({ departments: [] as DeptCandidateNode[], roles: [] as { id: number; name: string }[], total: 0, page: 1, pageSize: 100, creatable: true })

  it('asks departments first and distinguishes duplicate names with parent paths', async () => {
    const raw = candidates()
    raw.departments = [{ id: 1, name: '总部', children: [{ id: 2, name: '研发' }] }, { id: 3, name: '分部', children: [{ id: 4, name: '研发' }] }] as DeptCandidateNode[]
    const list = vi.spyOn(UserCreationFormService, 'listCandidates').mockResolvedValue(raw)
    const fields = { phone: '13800000000' }
    const questions = await draftAdapter('user.create').questions!(subject, fields)
    expect(questions).toMatchObject([{ field: 'deptIds', multiple: true, options: [{ value: 1, label: '总部' }, { value: 2, label: '总部 / 研发' }, { value: 3, label: '分部' }, { value: 4, label: '分部 / 研发' }] }])
    expect(list).toHaveBeenCalledWith(subject, { deptIds: undefined, page: 1, pageSize: 100 })
    expect(fields).toEqual({ phone: '13800000000' })
  })

  it('queries roles for explicitly selected departments without selecting a sole candidate', async () => {
    const raw = candidates()
    raw.roles = [{ id: 9, name: '访客' }]
    raw.total = 1
    const list = vi.spyOn(UserCreationFormService, 'listCandidates').mockResolvedValue(raw)
    const fields = { deptIds: [3] }
    expect(await draftAdapter('user.create').questions!(subject, fields)).toMatchObject([{ field: 'roleIds', options: [{ value: 9, label: '访客' }] }])
    expect(list).toHaveBeenCalledWith(subject, { deptIds: [3], page: 1, pageSize: 100 })
    expect(fields).toEqual({ deptIds: [3] })
  })

  it('recognizes explicit empty answers and skips already answered fields', async () => {
    const list = vi.spyOn(UserCreationFormService, 'listCandidates').mockResolvedValue(candidates())
    expect(await draftAdapter('user.create').questions!(subject, { deptIds: [] })).toMatchObject([{ field: 'roleIds', options: [] }])
    expect(list).toHaveBeenCalledWith(subject, { deptIds: [], page: 1, pageSize: 100 })
    list.mockClear()
    expect(await draftAdapter('user.create').questions!(subject, { deptIds: [], roleIds: [] })).toEqual([])
    expect(list).not.toHaveBeenCalled()
  })

  it('bounds department choices and marks incomplete role pages as truncated', async () => {
    const raw = candidates()
    raw.departments = Array.from({ length: 101 }, (_, index) => ({ id: index + 1, name: `部门${index}` })) as DeptCandidateNode[]
    raw.roles = [{ id: 9, name: '访客' }]
    raw.total = 101
    vi.spyOn(UserCreationFormService, 'listCandidates').mockResolvedValue(raw)
    const departments = await draftAdapter('user.create').questions!(subject, {})
    expect(departments[0].options).toHaveLength(100)
    expect(departments[0].truncated).toBe(true)
    expect(await draftAdapter('user.create').questions!(subject, { deptIds: [1] })).toMatchObject([{ field: 'roleIds', truncated: true }])
  })
})

it('rejects a draft authorization when its contributed business module is disabled', async () => {
  const adapter = { ...draftAdapter('user.create'), action: 'project.create', moduleId: 'projects', authorize: vi.fn(async () => {}) }
  const catalog = new AiCapabilityCatalog()
  catalog.register({ name: 'project_form', moduleId: 'projects', operationId: 'projectCreate', permissionCode: adapter.permissionCode, inputSchema: {}, riskLevel: 'prepare', enabled: true, description: '项目', draftAdapter: adapter, execute: async () => ({ data: {} }) })
  vi.spyOn(testRuntime().moduleState, 'enabledIds').mockResolvedValue(new Set())
  await expect(runWithAiCapabilities(catalog, () => authorizeDraft('project.create', { actorId: 7 }, {}))).rejects.toThrow('不可用')
  expect(adapter.authorize).not.toHaveBeenCalled()
})
