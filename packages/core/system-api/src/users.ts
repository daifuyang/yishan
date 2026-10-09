import type { UserDirectory, UserIdentity } from '@yishan/core-contracts'
import { and, inArray, isNull } from 'drizzle-orm'
import { UserService } from './core/services/user.service'
import { sysUser } from './db/schema'
import { currentSystemRuntime, type SystemRuntime } from './runtime'
import type { SysUserResp } from './core/schemas/user'

export function toUserIdentity(user: SysUserResp): UserIdentity {
  return { id: user.id, username: user.username ?? null, realName: user.realName ?? null, nickname: user.nickname ?? null, status: user.status, roleIds: user.roleIds ?? [], deptIds: user.deptIds ?? [] }
}

export function createUserDirectory(runtime: SystemRuntime): UserDirectory {
  return {
    findById: id => runtime.run(async () => { const user = await UserService.getUserById(id); return user ? toUserIdentity(user) : null }),
    async findByIds(ids, options?: { includeDeleted?: boolean }) {
      if (ids.length === 0) return new Map()
      // History display can include deleted identities, without exposing private user fields.
      const rows = await runtime.database.db.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName, nickname: sysUser.nickname, status: sysUser.status })
        .from(sysUser).where(and(inArray(sysUser.id, [...ids]), options?.includeDeleted ? undefined : isNull(sysUser.deletedAt)))
      return new Map<number, UserIdentity>(rows.map(row => [row.id, { ...row, status: String(row.status), roleIds: [], deptIds: [] }]))
    },
  }
}

export const userDirectory: UserDirectory = {
  findById: id => currentSystemRuntime().users.findById(id),
  findByIds: (ids, options) => currentSystemRuntime().users.findByIds(ids, options),
}

export const users = {
  create: UserService.createUser.bind(UserService),
  update: UserService.updateUser.bind(UserService),
}
