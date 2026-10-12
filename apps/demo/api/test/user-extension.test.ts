import { describe, expect, it } from 'vitest'
import { createDemoUserExtension } from '../src/extensions/user-profile'
import type { UserLifecycleEvent } from '@yishan/core-contracts'

describe('Demo user extension', () => {
  it('rejects its reserved automation identity before persistence', async () => {
    const extension = createDemoUserExtension({ recordEvent: async () => {} })
    await expect(extension.validate?.({ operation: 'create', actorId: 1, fields: { username: 'demo_service' } })).rejects.toThrow(/reserved/)
    await expect(extension.validate?.({ operation: 'create', actorId: 1, fields: { username: 'person' } })).resolves.toBeUndefined()
  })

  it('receives a successful system lifecycle event without a private repository', async () => {
    const recorded: UserLifecycleEvent[] = []
    const extension = createDemoUserExtension({ recordEvent: async event => { recorded.push(event) } })
    const event: UserLifecycleEvent = { type: 'user.created', actorId: 1, user: { id: 8, username: 'person', realName: null, nickname: null, status: '1', roleIds: [], deptIds: [] } }
    await extension.onEvent?.(event)
    expect(recorded).toEqual([event])
  })
})
