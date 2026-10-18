import { afterAll, describe, expect } from 'vitest'
import { setupIntegration, it } from './_setup.js'
import { currentSystemRuntime } from '../../src/runtime.js'
import { establishDataScopeFor } from '../../src/core/plugins/external/data-scope.js'
import { UserRepository } from '../../src/core/repositories/user.repository.js'
import { RoleRepository } from '../../src/core/repositories/role.repository.js'
import { LoginLogRepository } from '../../src/core/repositories/login-log.repository.js'
import { UserService } from '../../src/core/services/user.service.js'
import { resolveSeedActor } from '../../src/scripts/seed/index.js'

const ctx = await setupIntegration()

describe.runIf(!ctx.skip)('integration: business data scope', () => {
  afterAll(async () => { await ctx.closeDb?.() })

  it('enforces department and self unions against MySQL without widening for unrelated roles', async () => {
    const runtime = currentSystemRuntime()
    for (const code of ['system:user:list', 'system:user:update', 'system:user:delete', 'system:login-log:list', 'system:role:list']) {
      runtime.permissions.register({ code, label: code, group: 'system' })
    }
    const permissions = ['system:user:list', 'system:user:update', 'system:user:delete', 'system:login-log:list']
    const scopedRole = await RoleRepository.create({ name: '部门范围', dataScope: 2, status: 1, permissionCodes: permissions, creatorId: 1, updaterId: 1 })
    const unrelatedRole = await RoleRepository.create({ name: '无关全量', dataScope: 1, status: 1, permissionCodes: ['system:role:list'], creatorId: 1, updaterId: 1 })
    const selfRole = await RoleRepository.create({ name: '本人范围', dataScope: 4, status: 1, permissionCodes: permissions, creatorId: 1, updaterId: 1 })
    const customRole = await RoleRepository.create({ name: '自定义范围', dataScope: 5, status: 1, permissionCodes: permissions, deptIds: [20], creatorId: 1, updaterId: 1 })
    const create = (username: string, deptId: number) => UserRepository.createInTransaction({
      username, phone: username, passwordHash: 'not-a-login-password', status: 1, gender: 0,
      deptIds: [deptId], creatorId: 1, updaterId: 1,
    })
    const actor = await create('admin', 10)
    const peer = await create('peer', 10)
    const outside = await create('outside', 20)
    const hidden = await create('hidden', 30)
    const identity = { userId: actor.id, deptIds: [10], roleIds: [scopedRole.id, unrelatedRole.id], superAdmin: false }
    const scoped = <T>(permission: string, fn: () => Promise<T>) => establishDataScopeFor(identity, permission, fn)

    await expect(UserService.getUserById(actor.id)).resolves.toBeNull()
    await expect(resolveSeedActor()).resolves.toMatchObject({ id: actor.id })
    await scoped('system:user:list', async () => {
      const result = await UserService.getUserList({ page: 1, pageSize: 100 })
      expect(result.list.map(user => user.id).sort()).toEqual([actor.id, peer.id].sort())
      expect(result.total).toBe(2)
      await expect(UserService.getUserById(outside.id)).resolves.toBeNull()
      await expect(UserService.findActiveUsersByDeptId(20)).resolves.toEqual([])
      expect((await UserService.findActiveUsersByDeptId(10)).map(user => user.id).sort()).toEqual([actor.id, peer.id].sort())
    })
    await scoped('system:user:update', async () => {
      await expect(UserService.updateUser(outside.id, { realName: '越权修改' }, actor.id)).rejects.toThrow('用户不存在')
    })
    await scoped('system:user:delete', async () => {
      await expect(UserService.deleteUser(outside.id, actor.id)).rejects.toThrow('用户不存在')
    })

    const ownLog = await LoginLogRepository.create({ userId: actor.id, username: 'admin', status: 1 })
    const peerLog = await LoginLogRepository.create({ userId: peer.id, username: 'peer', status: 1 })
    await LoginLogRepository.create({ userId: outside.id, username: 'outside', status: 1 })
    await scoped('system:login-log:list', async () => {
      expect((await LoginLogRepository.list()).map(log => log.id).sort()).toEqual([ownLog.id, peerLog.id].sort())
      await expect(LoginLogRepository.count()).resolves.toBe(2)
      await expect(LoginLogRepository.countDistinctUsersInWindow(new Date(0))).resolves.toBe(2)
    })

    await establishDataScopeFor({ ...identity, roleIds: [customRole.id, selfRole.id] }, 'system:user:list', async () => {
      const result = await UserService.getUserList({ page: 1, pageSize: 100 })
      expect(result.list.map(user => user.id).sort()).toEqual([actor.id, outside.id].sort())
      expect(result.total).toBe(2)
      await expect(UserService.getUserById(hidden.id)).resolves.toBeNull()
    })
    await establishDataScopeFor({ ...identity, roleIds: [unrelatedRole.id] }, 'system:user:list', async () => {
      expect((await UserService.getUserList({ page: 1, pageSize: 100 })).total).toBe(0)
    })
    await expect(UserRepository.findById(outside.id, undefined, false)).resolves.toMatchObject({ realName: null })
  })
})
