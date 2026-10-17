import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiCapabilityCatalog, PermissionCatalog } from '@yishan/core-api'
import { runWithPermissions } from '@yishan/core-api/permissions/catalog'
import { Type } from '@sinclair/typebox'
import { runWithAiCapabilities } from '@yishan/core-api/ai-capabilities/catalog'
import type { AiCapability } from '@yishan/core-api/ai-capabilities/catalog'

/** 活动权限目录。执行链用它过滤 PAT 交集，因此必须是真实存在的码。 */
const ACTIVE_CODES = ['system:user:list', 'system:user:create', 'system:user:update', 'ai:chat:use']
const loadForRoleIds = vi.fn(async () => ({ perms: new Set<string>(ACTIVE_CODES), roleCodes: new Set<string>() }))

vi.mock('@yishan/core-system-api', async importOriginal => ({
  ...(await importOriginal<typeof import('@yishan/core-system-api')>()),
  PermissionService: { loadForRoleIds: (...args: unknown[]) => loadForRoleIds(...args as [never]) },
}))

const { executeCapability, toolsForActor } = await import('../services/ai-execution-chain.js')

const AUDIT: import('../repositories/ai-audit.repository.js').AiAuditRecord[] = []
const audit = { async write(record: (typeof AUDIT)[number]) { AUDIT.push(record) } }

function capability(overrides: Partial<AiCapability> & Pick<AiCapability, 'name' | 'permissionCode'>): AiCapability {
  return {
    description: 'test', moduleId: 'system', operationId: 'op', inputSchema: undefined,
    riskLevel: 'read', enabled: true, execute: async () => ({ data: { ok: true } }),
    ...overrides,
  }
}

/**
 * 绕过 register 校验强行塞进目录，模拟「注册期校验被绕过」的场景：
 * 执行入口必须自己再判一次，而不是信任「能查到的都是安全的」。
 */
function forceRegister(catalog: AiCapabilityCatalog, capability: AiCapability): void {
  const definitions = (catalog as unknown as { definitions: Map<string, AiCapability> }).definitions
  definitions.set(capability.name, Object.freeze({ ...capability }))
}

function harness(capabilities: AiCapability[], enabled: string[] = ['demo', 'ai']) {
  const catalog = new AiCapabilityCatalog()
  catalog.register(...capabilities)
  const runtime = { moduleState: { enabledIds: async () => new Set(enabled) } } as never
  // PAT 交集要读活动权限目录，所以两个作用域都要建立——与真实运行时一致。
  const permissions = new PermissionCatalog()
  permissions.register(...ACTIVE_CODES.map(code => ({ code, label: code, group: 'test' })))
  const run = <T>(fn: () => Promise<T>) => runWithAiCapabilities(catalog, () => runWithPermissions(permissions, fn))
  return { catalog, runtime, run, base: { requestId: 'r1', conversationId: 'c1', actor: { userId: 7, roleIds: [1] }, runtime, audit } }
}

beforeEach(() => { AUDIT.length = 0; loadForRoleIds.mockClear() })

describe('AI execution chain', () => {
  it('denies an unknown capability and still leaves an audit trail', async () => {
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })])
    const outcome = await h.run(() => executeCapability(h.base, 'hallucinated_tool', {}))
    expect(outcome).toEqual({ ok: false, error: '能力 hallucinated_tool 不可用' })
    expect(AUDIT[0]).toMatchObject({ capabilityName: 'hallucinated_tool', permissionDecision: 'denied' })
  })

  it('denies when the module is disabled even for a permitted capability', async () => {
    const h = harness([capability({ name: 'business_users', moduleId: 'demo', permissionCode: 'system:user:list' })], [])
    const outcome = await h.run(() => executeCapability(h.base, 'business_users', {}))
    expect(outcome).toEqual({ ok: false, error: '能力 business_users 不可用' })
    expect(AUDIT[0]).toMatchObject({ permissionDecision: 'denied' })
  })

  it('executes system capabilities when only optional modules have persisted enabled rows', async () => {
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })], ['demo', 'ai'])
    const outcome = await h.run(() => executeCapability(h.base, 'list_users', {}))
    expect(outcome.ok).toBe(true)
    expect(AUDIT[0]).toMatchObject({ permissionDecision: 'allowed', executionStatus: 'success' })
  })

  it('rejects an input that fails the declared schema before executing', async () => {
    const execute = vi.fn(async () => ({ data: {} }))
    const h = harness([capability({ name: 'get_user', permissionCode: 'system:user:list', inputSchema: Type.Object({ id: Type.Integer() }), execute })])
    const outcome = await h.run(() => executeCapability(h.base, 'get_user', { id: 'abc' }))
    expect(outcome.ok).toBe(false)
    expect(execute).not.toHaveBeenCalled()
    expect(AUDIT[0]).toMatchObject({ executionStatus: 'rejected' })
  })

  it('records a failed execution with a truncated error summary', async () => {
    const h = harness([capability({ name: 'boom', permissionCode: 'system:user:list', execute: async () => { throw new Error('数据库炸了') } })])
    const outcome = await h.run(() => executeCapability(h.base, 'boom', { secretField: 'x' }))
    expect(outcome).toEqual({ ok: false, error: '数据库炸了' })
    expect(AUDIT[0]).toMatchObject({ executionStatus: 'failed', errorSummary: '数据库炸了', inputDigest: 'secretField' })
  })

  it('re-resolves permissions at execution time instead of trusting the tool list', async () => {
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })])
    const listed = await h.run(() => toolsForActor({ userId: 7, roleIds: [1] }))
    expect(listed.capabilities.map(c => c.name)).toContain('list_users')
    // 清单裁剪发生在权限还充足时；执行前权限已被回收。
    loadForRoleIds.mockResolvedValue({ perms: new Set(), roleCodes: new Set() })
    const outcome = await h.run(() => executeCapability(h.base, 'list_users', {}))
    expect(outcome).toEqual({ ok: false, error: '没有权限执行该操作' })
    expect(AUDIT.at(-1)).toMatchObject({ permissionDecision: 'denied' })
  })

  it('lets a PAT without the matching scope lose the capability', async () => {
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })])
    loadForRoleIds.mockResolvedValue({ perms: new Set(ACTIVE_CODES), roleCodes: new Set() })
    const tools = await h.run(() => toolsForActor({ userId: 7, roleIds: [1], tokenScope: ["ai:chat:use"] }))
    expect(tools.capabilities.map(c => c.name)).not.toContain('list_users')
  })

  it('rejects a PAT that explicitly scopes to nothing', async () => {
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })])
    loadForRoleIds.mockResolvedValue({ perms: new Set(ACTIVE_CODES), roleCodes: new Set() })
    const tools = await h.run(() => toolsForActor({ userId: 7, roleIds: [1], tokenScope: [] }))
    expect(tools.capabilities).toEqual([])
  })

  it('passes the actor from the request, never from the model input', async () => {
    let seen = -1
    const h = harness([capability({ name: 'echo_actor', permissionCode: 'system:user:list', execute: async (ctx, input) => { seen = ctx.actorId; return { data: { input } } } })])
    await h.run(() => executeCapability(h.base, 'echo_actor', { actorId: 1, userId: 1 }))
    expect(seen).toBe(7)
  })

  it('hides a disabled capability from the tool list but still refuses it on execution', async () => {
    const h = harness([
      capability({ name: 'list_users', permissionCode: 'system:user:list' }),
      capability({ name: 'off', permissionCode: 'system:user:list', enabled: false }),
    ])
    const tools = await h.run(() => toolsForActor({ userId: 7, roleIds: [1] }))
    expect(tools.capabilities.map(c => c.name)).toEqual(['list_users'])
    const outcome = await h.run(() => executeCapability(h.base, 'off', {}))
    expect(outcome.ok).toBe(false)
  })

  it('keeps the super-admin sentinel out of reach of an ordinary role', async () => {
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })])
    loadForRoleIds.mockResolvedValue({ perms: new Set(['__super_admin__']), roleCodes: new Set() })
    const tools = await h.run(() => toolsForActor({ userId: 7, roleIds: [1], tokenScope: ["system:user:list"] }))
    // tokenScope 不含哨兵，交集之后超管旁路被剥离。
    expect(tools.capabilities.map(c => c.name)).toEqual([])
  })
})

describe('model-facing capability boundary', () => {
  it('refuses to register a write capability', () => {
    const catalog = new AiCapabilityCatalog()
    expect(() => catalog.register(capability({ name: 'create_user', permissionCode: 'system:user:create', riskLevel: 'write' }))).toThrow()
  })

  it('refuses to register a sensitive capability', () => {
    const catalog = new AiCapabilityCatalog()
    expect(() => catalog.register(capability({ name: 'reset_password', permissionCode: 'system:user:update', riskLevel: 'sensitive' }))).toThrow()
  })

  it('still registers read and prepare capabilities', () => {
    const catalog = new AiCapabilityCatalog()
    expect(() => catalog.register(
      capability({ name: 'list_users', permissionCode: 'system:user:list', riskLevel: 'read' }),
      capability({ name: 'prefill_user', permissionCode: 'system:user:list', riskLevel: 'prepare' }),
    )).not.toThrow()
  })

  it('never hands a write capability to the model, even with full permissions', async () => {
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })])
    forceRegister(h.catalog, capability({ name: 'create_user', permissionCode: 'system:user:create', riskLevel: 'write' }))
    loadForRoleIds.mockResolvedValue({ perms: new Set(['__super_admin__']), roleCodes: new Set() })
    const tools = await h.run(() => toolsForActor({ userId: 7, roleIds: [1] }))
    expect(tools.capabilities.map(c => c.name)).toEqual(['list_users'])
  })

  it('denies a force-registered write capability at execution without running its business code', async () => {
    const execute = vi.fn(async () => ({ data: { ok: true } }))
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })])
    forceRegister(h.catalog, capability({ name: 'create_user', permissionCode: 'system:user:create', riskLevel: 'write', execute }))
    const result = await h.run(() => executeCapability(h.base, 'create_user', {}))
    expect(result.ok).toBe(false)
    expect(execute).not.toHaveBeenCalled()
    expect(AUDIT.at(-1)).toMatchObject({ permissionDecision: 'denied', executionStatus: 'denied' })
  })

  it('denies a force-registered sensitive capability at execution too', async () => {
    const execute = vi.fn(async () => ({ data: { ok: true } }))
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })])
    forceRegister(h.catalog, capability({ name: 'reset_password', permissionCode: 'system:user:update', riskLevel: 'sensitive', execute }))
    const result = await h.run(() => executeCapability(h.base, 'reset_password', {}))
    expect(result.ok).toBe(false)
    expect(execute).not.toHaveBeenCalled()
  })

  it('offers no way to override the denial from the request', async () => {
    const execute = vi.fn(async () => ({ data: { ok: true } }))
    const h = harness([capability({ name: 'list_users', permissionCode: 'system:user:list' })])
    forceRegister(h.catalog, capability({ name: 'create_user', permissionCode: 'system:user:create', riskLevel: 'write', execute }))
    const result = await h.run(() => executeCapability({ ...h.base, confirm: true } as never, 'create_user', { confirm: true }))
    expect(result.ok).toBe(false)
    expect(execute).not.toHaveBeenCalled()
  })

  it('still executes a prepare capability', async () => {
    const h = harness([capability({ name: 'prefill_user', permissionCode: 'system:user:list', riskLevel: 'prepare' })])
    const result = await h.run(() => executeCapability(h.base, 'prefill_user', {}))
    expect(result.ok).toBe(true)
  })
})
