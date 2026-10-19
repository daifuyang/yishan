import { afterEach, describe, expect, it, vi } from './runtime-fixture'
import { systemAiCapabilities } from '../src/core/ai/system-capabilities'
import { UserService } from '../src/core/services/user.service'
import { FormatRegistry } from '@sinclair/typebox'

const context = { actorId: 7, permissions: new Set<string>(), requestId: 'user-ui-test' }

function tool(name: string) {
  const capability = systemAiCapabilities.find(item => item.name === name)
  if (!capability) throw new Error(`Missing capability ${name}`)
  return capability
}

afterEach(() => vi.restoreAllMocks())

describe('native user UI preparation', () => {
  it('returns incomplete create fields for the native form without creating a user', async () => {
    const create = vi.spyOn(UserService, 'createUser')
    const result = await tool('prepare_user_create').execute(context, { realName: '张三' })
    expect(result.render).toMatchObject({ kind: 'form.prefill', payload: { target: 'user.create', fields: { realName: '张三' }, missing: ['phone'], route: '/system/user' } })
    expect(result.mutated).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })

  it.each([{ password: 'Passw0rd' }, { actorId: 1 }, { phone: 123 }, { status: '9' }])('rejects invalid or forged create fields %j', async input => {
    await expect(tool('prepare_user_create').execute(context, input)).rejects.toThrow()
  })

  it('preserves valid native email and birth date fields', async () => {
    const oldEmail = FormatRegistry.Get('email')
    const oldDate = FormatRegistry.Get('date')
    FormatRegistry.Set('email', value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    FormatRegistry.Set('date', value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)))
    try {
      const result = await tool('prepare_user_create').execute(context, { email: 'zhang@example.com', birthDate: '2000-01-02' })
      expect(result.render).toMatchObject({ payload: { fields: { email: 'zhang@example.com', birthDate: '2000-01-02' } } })
      await expect(tool('prepare_user_create').execute(context, { email: 'bad-email' })).rejects.toThrow()
      await expect(tool('prepare_user_create').execute(context, { birthDate: '2000-50-50' })).rejects.toThrow()
    } finally {
      if (oldEmail) FormatRegistry.Set('email', oldEmail)
      else FormatRegistry.Delete('email')
      if (oldDate) FormatRegistry.Set('date', oldDate)
      else FormatRegistry.Delete('date')
    }
  })

  it('returns only requested update fields so native form edits are preserved', async () => {
    vi.spyOn(UserService, 'getUserById').mockResolvedValue({ id: 12, realName: '张三', phone: '123' } as Awaited<ReturnType<typeof UserService.getUserById>>)
    const update = vi.spyOn(UserService, 'updateUser')
    const result = await tool('prepare_update_user').execute(context, { id: 12, nickname: '小张' })
    expect(result.render).toMatchObject({ kind: 'form.prefill', payload: { target: 'user.update', fields: { id: 12, nickname: '小张' }, missing: [] } })
    expect((result.render?.payload as { fields: Record<string, unknown> }).fields).not.toHaveProperty('realName')
    expect((result.render?.payload as { fields: Record<string, unknown> }).fields).not.toHaveProperty('phone')
    expect(update).not.toHaveBeenCalled()
    expect(result.mutated).toBe(false)
  })

  it('prepares a confirmation for the exact visible delete target without deleting it', async () => {
    vi.spyOn(UserService, 'getUserById').mockResolvedValue({ id: 12, realName: '张三', phone: '123' } as Awaited<ReturnType<typeof UserService.getUserById>>)
    const remove = vi.spyOn(UserService, 'deleteUser')
    const result = await tool('prepare_delete_user').execute(context, { id: 12 })
    expect(result.render).toEqual({ kind: 'action.confirm', payload: { target: 'user.delete', id: 12, label: '张三' } })
    expect(result.summary).toContain('等待确认')
    expect(result.mutated).toBe(false)
    expect(remove).not.toHaveBeenCalled()
  })

  it('does not offer a delete target outside the existing data scope', async () => {
    vi.spyOn(UserService, 'getUserById').mockResolvedValue(null)
    await expect(tool('prepare_delete_user').execute(context, { id: 12 })).rejects.toThrow('不存在或不在你的数据范围内')
  })

  it.each([0, -1, 1.5, '12', undefined])('rejects invalid target IDs %j for update and delete', async id => {
    await expect(tool('prepare_update_user').execute(context, { id })).rejects.toThrow()
    await expect(tool('prepare_delete_user').execute(context, { id })).rejects.toThrow()
  })

  it('uses separate existing mutation permissions while exposing only preparation', () => {
    expect(tool('prepare_user_create')).toMatchObject({ moduleId: 'system', operationId: 'createUser', permissionCode: 'system:user:create', riskLevel: 'prepare' })
    expect(tool('prepare_update_user')).toMatchObject({ moduleId: 'system', operationId: 'updateUser', permissionCode: 'system:user:update', riskLevel: 'prepare' })
    expect(tool('prepare_delete_user')).toMatchObject({ moduleId: 'system', operationId: 'deleteUser', permissionCode: 'system:user:delete', riskLevel: 'prepare' })
  })
})
