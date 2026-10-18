/**
 * AI 能力的数据范围上下文用例。
 *
 * 覆盖面分工：
 *   - 「范围算出来之后有没有真的落到 SQL 上」由 system-api 的
 *     `data-scope.repository.test.ts` 覆盖（那里跑的是 AI 能力最终调用的同一条
 *     `UserService` → `UserRepository` 路径）。
 *   - 本文件只回答 AI 侧特有的两个问题：
 *       1. 每次能力执行是否按**本能力自己的 permissionCode** 建立上下文，
 *          而不是沿用聊天接口的 `ai:chat:use`；
 *       2. 上下文里的身份是否只来自服务端 actor，并发 / 流式调用之间不串。
 *
 * 能力是真的注册的（不是 stub 掉 execute 换断言），execute 里直接读上下文，
 * 因此「上下文没建立」会立刻暴露成断言失败。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiCapabilityCatalog, PermissionCatalog } from '@yishan/core-api'
import { runWithPermissions } from '@yishan/core-api/permissions/catalog'
import { runWithAiCapabilities, type AiCapability, type AiCapabilityContext } from '@yishan/core-api/ai-capabilities/catalog'
import { Type } from '@sinclair/typebox'

const ACTIVE_CODES = ['system:user:list', 'system:user:update', 'ai:chat:use']
const loadForRoleIds = vi.fn(async () => ({ perms: new Set<string>(ACTIVE_CODES), roleCodes: new Set<string>() }))

vi.mock('@yishan/core-system-api', async importOriginal => ({
  ...(await importOriginal<typeof import('@yishan/core-system-api')>()),
  PermissionService: { loadForRoleIds: (...args: unknown[]) => loadForRoleIds(...(args as [never])) },
}))

const { currentDataScope, isDataScopeBypassed } = await import('@yishan/core-system-api')
const { executeCapability, toolsForActor } = await import('../services/ai-execution-chain.js')

const AUDIT: Array<Record<string, unknown>> = []
const audit = { async write(record: Record<string, unknown>) { AUDIT.push(record) } }

/** 每个能力执行时看到的上下文快照。 */
const observed: Array<{ name: string; subject: unknown; bypassed: boolean }> = []

function observing(name: string, permissionCode: string, waitMs = 0): AiCapability {
  return {
    name,
    description: 'test',
    moduleId: 'system',
    operationId: `op.${name}`,
    permissionCode,
    inputSchema: Type.Object({ id: Type.Optional(Type.Integer()) }),
    riskLevel: 'read',
    enabled: true,
    async execute(_context: AiCapabilityContext) {
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs))
      observed.push({ name, subject: currentDataScope(), bypassed: isDataScopeBypassed() })
      return { data: { ok: true }, mutated: false }
    },
  }
}

function harness(capabilities: AiCapability[], enabled: string[] = ['demo', 'ai']) {
  const catalog = new AiCapabilityCatalog()
  catalog.register(...capabilities)
  const runtime = { moduleState: { enabledIds: async () => new Set(enabled) } } as never
  const permissions = new PermissionCatalog()
  permissions.register(...ACTIVE_CODES.map(code => ({ code, label: code, group: 'test' })))
  const run = <T>(fn: () => Promise<T>) => runWithAiCapabilities(catalog, () => runWithPermissions(permissions, fn))
  return {
    runtime,
    run,
    toolsForActor: (actor: never) => run(() => toolsForActor(actor)),
    base: {
      requestId: 'r1',
      conversationId: 'c1',
      actor: { userId: 7, roleIds: [1], deptIds: [10] },
      runtime,
      audit,
    },
  }
}

beforeEach(() => {
  AUDIT.length = 0
  observed.length = 0
  loadForRoleIds.mockClear()
})

describe('AI 能力执行时的行级上下文', () => {
  it('establishes a scope context inside the capability', async () => {
    const h = harness([observing('list_users', 'system:user:list')])
    const outcome = await h.run(() => executeCapability(h.base, 'list_users', {}))

    expect(outcome).toMatchObject({ ok: true })
    expect(observed).toHaveLength(1)
    expect(observed[0].bypassed).toBe(false)
    expect(observed[0].subject).toMatchObject({ userId: 7, roleIds: [1], deptIds: [10] })
  })

  it('scopes by the capability permission code, not by the chat endpoint permission', async () => {
    // 聊天接口的权限是 ai:chat:use。能力必须按 system:user:list 建立上下文，
    // 否则一个只有聊天权限的角色会按错档位解析范围。
    const h = harness([observing('get_user', 'system:user:list')])
    await h.run(() => executeCapability(h.base, 'get_user', { id: 42 }))
    expect(observed[0].subject).toMatchObject({ permissionCode: 'system:user:list' })
  })

  it('takes the identity from the server-side actor, never from the tool input', async () => {
    const h = harness([observing('get_user', 'system:user:list')])
    // 模型试图指定另一个操作者与他的部门。
    await h.run(() =>
      executeCapability(h.base, 'get_user', {
        id: 42,
        userId: 999,
        actorId: 999,
        deptIds: [88],
        roleIds: [5],
      }),
    )
    expect(observed[0].subject).toMatchObject({ userId: 7, roleIds: [1], deptIds: [10] })
  })

  it('does not establish a context for a capability the actor may not run', async () => {
    const h = harness([observing('update_user', 'system:user:delete')])
    const outcome = await h.run(() => executeCapability(h.base, 'update_user', { id: 42 }))

    expect(outcome).toMatchObject({ ok: false })
    expect(observed).toHaveLength(0)
    expect(AUDIT.at(-1)).toMatchObject({ permissionDecision: 'denied', executionStatus: 'denied' })
  })

  it('does not establish a context for a capability in a disabled module', async () => {
    const h = harness([{ ...observing('list_users', 'system:user:list'), moduleId: 'demo' }], [])
    const outcome = await h.run(() => executeCapability(h.base, 'list_users', {}))

    expect(outcome).toMatchObject({ ok: false })
    expect(observed).toHaveLength(0)
  })

  it('carries the PAT token scope into the context so it can only narrow', async () => {
    const h = harness([observing('list_users', 'system:user:list')])
    await h.run(() =>
      executeCapability({ ...h.base, actor: { userId: 7, roleIds: [1], deptIds: [10], tokenScope: ['system:user:list'] } }, 'list_users', {}),
    )
    // 上下文带着收窄后的 tokenScope：范围解析里 PAT 只能收紧，不能放宽。
    expect(observed[0].subject).toMatchObject({ tokenScope: ['system:user:list'] })
  })

  it('denies outright when the PAT does not carry the capability permission', async () => {
    const h = harness([observing('list_users', 'system:user:list')])
    const outcome = await h.run(() =>
      executeCapability({ ...h.base, actor: { userId: 7, roleIds: [1], deptIds: [10], tokenScope: ['ai:chat:use'] } }, 'list_users', {}),
    )
    expect(outcome).toMatchObject({ ok: false })
    expect(observed).toHaveLength(0)
  })

  it('isolates the context between two concurrent capability calls', async () => {
    const h = harness([observing('slow_list', 'system:user:list', 20), observing('fast_list', 'system:user:list', 1)])
    const base = h.base
    await Promise.all([
      h.run(() => executeCapability({ ...base, requestId: 'a', actor: { userId: 1, roleIds: [1], deptIds: [10] } }, 'slow_list', {})),
      h.run(() => executeCapability({ ...base, requestId: 'b', actor: { userId: 2, roleIds: [1], deptIds: [20] } }, 'fast_list', {})),
    ])
    const slow = observed.find(entry => entry.name === 'slow_list')
    const fast = observed.find(entry => entry.name === 'fast_list')
    // 交错之后仍各自持有自己的身份。
    expect(slow?.subject).toMatchObject({ userId: 1, deptIds: [10] })
    expect(fast?.subject).toMatchObject({ userId: 2, deptIds: [20] })
  })

  it('leaves no context behind once the capability call returns', async () => {
    const h = harness([observing('list_users', 'system:user:list')])
    await h.run(() => executeCapability(h.base, 'list_users', {}))
    // 上下文只在这段执行期间存在，事后不得被后续逻辑读到。
    expect(currentDataScope()).toBeNull()
  })

  it('hides a capability the actor may not run from the tool list as well', async () => {
    loadForRoleIds.mockResolvedValueOnce({ perms: new Set(['ai:chat:use']), roleCodes: new Set<string>() })
    const h = harness([observing('get_user', 'system:user:list'), observing('list_users', 'system:user:list')])
    const { capabilities } = await h.toolsForActor({ userId: 7, roleIds: [1], deptIds: [10] } as never)
    // 工具清单只是提示，但无权的能力不应出现在给模型的定义里。
    expect(capabilities.map(c => c.name)).not.toContain('get_user')
  })
})
