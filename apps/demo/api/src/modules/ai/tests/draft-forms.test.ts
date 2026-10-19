import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadRoleIds: vi.fn(async () => [2]), loadPermissions: vi.fn(async () => ({ perms: new Set(['system:department:create']) })),
  identity: vi.fn(async () => ({ id: 7, status: '1', deptIds: [3] })),
  establish: vi.fn(async (_identity, _permission, operation) => operation()), references: vi.fn(async () => {}),
}))
vi.mock('@yishan/core-system-api', async original => ({
  ...(await original<typeof import('@yishan/core-system-api')>()),
  PermissionService: { loadRoleIdsForUser: mocks.loadRoleIds, loadForRoleIds: mocks.loadPermissions },
  userDirectory: { findById: mocks.identity }, establishDataScopeFor: mocks.establish,
  DeptService: { validateCreateReferences: mocks.references },
}))
import { authorizeDraft } from '../services/draft-forms.js'
import { PermissionCatalog } from '@yishan/core-api'
import { runWithPermissions } from '@yishan/core-api/permissions/catalog'

describe('department draft authorization', () => {
  beforeEach(() => vi.clearAllMocks())
  it('rejects a PAT without department creation scope before querying references', async () => {
    const catalog = new PermissionCatalog()
    catalog.register({ code: 'system:department:create', label: '新增部门', group: 'system' })
    await expect(runWithPermissions(catalog, () => authorizeDraft('department.create', { actorId: 7, tokenScope: [] }, { leaderId: 9 }))).rejects.toThrow('没有新增部门的权限')
    expect(mocks.establish).not.toHaveBeenCalled()
    expect(mocks.references).not.toHaveBeenCalled()
  })
  it('re-establishes department operation data scope for HTTP drafts instead of inheriting chat scope', async () => {
    const catalog = new PermissionCatalog()
    catalog.register({ code: 'system:department:create', label: '新增部门', group: 'system' })
    await runWithPermissions(catalog, () => authorizeDraft('department.create', { actorId: 7 }, { leaderId: 9 }))
    expect(mocks.establish).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, roleIds: [2], deptIds: [3] }), 'system:department:create', expect.any(Function))
    expect(mocks.references).toHaveBeenCalledWith({ leaderId: 9 })
  })
})
