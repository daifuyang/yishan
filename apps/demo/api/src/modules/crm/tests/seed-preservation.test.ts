import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  menus: [{ path: '/crm/leads', name: '现有业务菜单' }],
  enums: [{ type: 'crm_lead_status', code: 'custom', name: '现有状态' }],
  grants: [{ roleId: 50, permissionCode: 'crm:lead:list' }],
}))

vi.mock('@yishan/core-system-api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@yishan/core-system-api')>(),
  resolveSeedActor: vi.fn(async () => ({ id: 1 })),
  seedModuleMenus: vi.fn(async () => {}),
  seedModuleEnums: vi.fn(async () => {}),
  purgeModuleSeedDeclarations: vi.fn(async () => {
    state.menus.splice(0)
    state.enums.splice(0)
    state.grants.splice(0)
  }),
}))

import seedCrm from '../seed'
import { seedModuleMenus, seedModuleEnums } from '@yishan/core-system-api'

describe('CRM normal seed preserves existing business declarations', () => {
  beforeEach(() => {
    state.menus.splice(0, state.menus.length, { path: '/crm/leads', name: '现有业务菜单' })
    state.enums.splice(0, state.enums.length, { type: 'crm_lead_status', code: 'custom', name: '现有状态' })
    state.grants.splice(0, state.grants.length, { roleId: 50, permissionCode: 'crm:lead:list' })
    vi.clearAllMocks()
  })

  it('adds current declarations without retiring maintained menus, enums or role grants', async () => {
    await seedCrm()
    await seedCrm()
    expect(state.menus).toEqual([{ path: '/crm/leads', name: '现有业务菜单' }])
    expect(state.enums).toEqual([{ type: 'crm_lead_status', code: 'custom', name: '现有状态' }])
    expect(state.grants).toEqual([{ roleId: 50, permissionCode: 'crm:lead:list' }])
    expect(seedModuleMenus).toHaveBeenCalledTimes(2)
    expect(seedModuleEnums).toHaveBeenCalledTimes(2)
  })
})
