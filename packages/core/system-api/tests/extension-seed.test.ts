import { describe, expect, it, vi, testRuntime } from '../test/runtime-fixture'
import { createSystemRuntime, users, seedModuleMenus, seedModuleEnums, purgeModuleSeedDeclarations } from '../src'
import { UserRepository } from '../src/core/repositories/user.repository'
import { drizzleDb } from '../test/mocks/drizzle'

const user = {
  id: 2, username: 'alice', email: null, phone: null, realName: null, nickname: 'Alice', avatar: null,
  gender: 0, birthDate: null, status: 1, lastLoginTime: null, lastLoginIp: null, loginCount: 0,
  creatorId: 1, updaterId: 1, createdAt: new Date(), updatedAt: new Date(), creatorName: null, updaterName: null, deptIds: [], roleIds: [],
}

describe('user extension persistence boundary', () => {
  it('rejects validation before updating the user', async () => {
    const save = vi.spyOn(UserRepository, 'updateInTransaction').mockResolvedValue(user)
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(user)
    const runtime = createSystemRuntime({ database: testRuntime().database, config: testRuntime().config, extensions: [{ id: 'demo', validate: async () => { throw new Error('Nickname reserved') } }] })
    await expect(runtime.run(() => users.update(2, { nickname: 'reserved' }, 1))).rejects.toThrow('Nickname reserved')
    expect(save).not.toHaveBeenCalled()
  })
  it('reports a notification failure after a successful update without returning a failed save', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(user)
    vi.spyOn(UserRepository, 'updateInTransaction').mockResolvedValue(user)
    const notify = vi.fn(async () => { throw new Error('notification offline') })
    const report = vi.fn()
    const runtime = createSystemRuntime({ database: testRuntime().database, config: testRuntime().config, extensions: [{ id: 'demo', onEvent: notify }], onExtensionError: report })
    await expect(runtime.run(() => users.update(2, { nickname: 'Alice' }, 1))).resolves.toMatchObject({ id: 2 })
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'user.updated', user: expect.objectContaining({ id: 2 }) }))
    expect(report).toHaveBeenCalledWith(expect.any(Error), 'demo', expect.objectContaining({ type: 'user.updated' }))
  })
})

describe('module seed ownership', () => {
  it('rejects another module menu or core permission before any database write', async () => {
    vi.clearAllMocks()
    await expect(seedModuleMenus('demo', [{name:'Wrong',path:'/system/users',type:1,sortOrder:1}])).rejects.toThrow('cannot contribute path')
    await expect(seedModuleMenus('demo', [{name:'Wrong',path:'/demo/page',type:1,sortOrder:1,permissionCodes:['system:user:delete']}])).rejects.toThrow('cannot contribute permission')
    expect(drizzleDb.transaction).not.toHaveBeenCalled()
  })
  it('rejects foreign enum and cleanup declarations before mutating state', async () => {
    vi.clearAllMocks()
    await expect(seedModuleEnums('demo',[{type:'crm_status',code:'1',name:'Active',sort:1}])).rejects.toThrow('cannot contribute enum')
    await expect(purgeModuleSeedDeclarations('demo',{menuPaths:[],permissionCodes:['system:user:list'],enumTypes:[]})).rejects.toThrow('cannot contribute permission')
    expect(drizzleDb.transaction).not.toHaveBeenCalled()
    expect(drizzleDb.insert).not.toHaveBeenCalled()
  })
  it('allows explicit references to active System permissions without declaring external codes', async () => {
    const options = { allowedSystemPermissionCodes: ['region:list'] }
    const nodes = [{ name: 'Regions', path: '/demo/regions', type: 1 as const, sortOrder: 1, permissionCodes: ['region:list'] }]
    vi.spyOn(drizzleDb, 'transaction').mockResolvedValue(undefined)
    await expect(seedModuleMenus('demo', nodes, 1, options)).resolves.toBeUndefined()
    const runtime = testRuntime()
    const before = runtime.permissions.listPermissions().find(permission => permission.code === 'region:list')
    expect(before).toMatchObject({ label: '行政区划-列表', group: 'region' })
    await expect(seedModuleMenus('demo', [{ ...nodes[0], permissionCodes: ['unknown:permission'] }], 1,
      { allowedSystemPermissionCodes: ['unknown:permission'] })).rejects.toThrow('not an active System permission')
    runtime.permissions.register({ code: 'external:spoof', label: 'Spoof', group: 'external' })
    await expect(seedModuleMenus('demo', [{ ...nodes[0], permissionCodes: ['external:spoof'] }], 1,
      { allowedSystemPermissionCodes: ['external:spoof'] })).rejects.toThrow('not an active System permission')
    expect(runtime.permissions.listPermissions().find(permission => permission.code === 'region:list')).toBe(before)
  })
})
