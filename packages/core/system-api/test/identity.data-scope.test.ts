import { describe, expect, it, vi, beforeEach, testRuntime } from './runtime-fixture'
import { defaultAuthProvider } from '../src/core/services/auth-provider'
import { UserService } from '../src/core/services/user.service'
import { UserRepository, type UserDetailRow } from '../src/core/repositories/user.repository'
import { UserTokenRepository } from '../src/core/repositories/user-token.repository'
import { ApiTokenRepository } from '../src/core/repositories/api-token.repository'
import { runWithDataScope } from '../src/core/auth/data-scope'

const user: UserDetailRow = {
  id: 7, username: 'admin', realName: '管理员', nickname: null, email: null,
  phone: '13800000000', avatar: null, gender: 0, birthDate: null, status: 1,
  lastLoginTime: null, lastLoginIp: null, loginCount: 0,
  creatorId: 1, updaterId: 1, creatorName: null, updaterName: null,
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
  roleIds: [3], deptIds: [10],
}

beforeEach(() => {
  // Keep the real Service and scope resolver; emulate an identity row only for unrestricted reads.
  vi.spyOn(UserRepository, 'findByIdWithScope').mockImplementation(async (_id, condition) => condition ? null : user)
})

describe('identity reads outside business data scope', () => {
  it.each(['access_token', 'refresh_token'] as const)('resolves a valid %s before a scope exists', async kind => {
    const tokenLookup = kind === 'access_token' ? 'findByAccessToken' : 'findByRefreshToken'
    vi.spyOn(UserTokenRepository, tokenLookup).mockResolvedValue({ userId: 7 } as Awaited<ReturnType<typeof UserTokenRepository.findByAccessToken>>)
    await expect(defaultAuthProvider.resolveSession({ token: 'valid', kind })).resolves.toMatchObject({ id: 7 })
  })

  it('resolves a valid PAT before a scope exists', async () => {
    vi.spyOn(ApiTokenRepository, 'findByRawToken').mockResolvedValue({ id: 2, userId: 7, scopes: ['system:user:list'] } as Awaited<ReturnType<typeof ApiTokenRepository.findByRawToken>>)
    vi.spyOn(ApiTokenRepository, 'touch').mockResolvedValue(undefined)
    await expect(defaultAuthProvider.resolveApiToken({ token: 'valid', ip: '127.0.0.1', log: { warn: vi.fn() } }))
      .resolves.toMatchObject({ user: { id: 7 }, scopes: ['system:user:list'] })
  })

  it('keeps internal single identity lookup available without a request (including seed)', async () => {
    await expect(testRuntime().users.findById(7)).resolves.toMatchObject({ id: 7, roleIds: [3], deptIds: [10] })
  })

  it('does not apply a caller business permission to an internal identity lookup', async () => {
    await runWithDataScope({ userId: 8, roleIds: [], deptIds: [], superAdmin: false, permissionCode: 'demo:profile:read' }, async () => {
      await expect(testRuntime().users.findById(7)).resolves.toMatchObject({ id: 7 })
    })
  })

  it('still denies ordinary user detail reads without a scope', async () => {
    await expect(UserService.getUserById(7)).resolves.toBeNull()
  })

  it('does not leave an unrestricted scope after an internal lookup', async () => {
    await testRuntime().users.findById(7)
    await expect(UserService.getUserById(7)).resolves.toBeNull()
  })
})
