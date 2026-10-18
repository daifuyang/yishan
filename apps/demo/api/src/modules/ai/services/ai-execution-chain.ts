/**
 * ai-execution-chain.ts — AI 能力的唯一执行入口。
 *
 * 模型能看到的工具清单由本文件裁剪，但**裁剪不是授权**。每次执行都重走一遍：
 *
 *   1. Resolve Actor       —— actorId 来自 JWT/PAT，模型无法指定
 *   2. Resolve Module      —— 可选业务模块必须启用；system 是始终挂载的核心模块
 *   3. Check Permissions   —— 按 capability.permissionCode 重算有效权限（含 PAT scope 交集）
 *   3b. Establish DataScope—— 用**本能力自己的 permissionCode** 建立行级数据范围
 *   4. Validate Input      —— TypeBox 校验，用的是与 REST 共用的同一份 schema
 *   5. Apply Business Rules—— 能力内部调用既有 Service（含 dataScope 行级过滤）
 *   6. Record Audit        —— 无论成败都写 ai_audit
 *
 * 第 3 步必须重算而不是复用第「清单」那次的结论：两次调用之间权限可能被回收，
 * 而且提示清单只是给模型的提示，不是安全边界。
 *
 * 第 3b 步是**行级**授权：垂直权限通过只说明「能调这个能力」，能看到哪些行由
 * sys_role.data_scope 决定。两者共享 `establishDataScopeFor` —— 与 REST 的路由
 * preHandler 走同一份范围解析实现，不维护第二套过滤规则。范围上下文只在这段
 * 执行期间存在，因此并发请求与流式工具调用各自持有自己的身份，不会串用。
 */
import { Value } from '@sinclair/typebox/value'
import { FormatRegistry } from '@sinclair/typebox'
import type { TSchema } from '@sinclair/typebox'
import { getAiCapability, isModelInvocableRiskLevel, listAiCapabilitiesFor, type AiCapability, type AiCapabilityContext } from '@yishan/core-api/ai-capabilities/catalog'
import { PERMISSION_CODES } from '@yishan/core-api/permissions/catalog'
import { computeEffectivePerms, establishDataScopeFor, hasPermission, SUPER_ADMIN_BYPASS, PermissionService } from '@yishan/core-system-api'
import type { SystemRuntime } from '@yishan/core-system-api'
import { digestInput, summarizeError, type AiAuditStore } from '../repositories/ai-audit.repository.js'

/** 单轮对话允许的最大工具调用次数。超限即中止本轮，防止模型绕圈烧钱。 */
export const MAX_TOOL_CALLS_PER_TURN = 12

export interface AiActor {
  readonly userId: number
  readonly roleIds: number[]
  /** 本人的部门归属。服务端从认证结果取得，模型与工具入参都无法覆盖。 */
  readonly deptIds: number[]
  readonly tokenScope?: string[]
}

export interface AiExecutionRequest {
  readonly requestId: string
  readonly conversationId?: string
  readonly sessionId?: string
  readonly actor: AiActor
  readonly runtime: SystemRuntime
  readonly audit: AiAuditStore
}

// TypeBox Value does not install JSON Schema formats automatically like Fastify Ajv.
if (!FormatRegistry.Has('email')) FormatRegistry.Set('email', value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
if (!FormatRegistry.Has('date')) FormatRegistry.Set('date', value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00.000Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
})

/** 执行链的对外结果。失败也是结构化的，模型据此调整而不是看到一句 500。 */
export type AiExecutionOutcome =
  | { readonly ok: true; readonly result: Awaited<ReturnType<AiCapability['execute']>> }
  | { readonly ok: false; readonly error: string }

/**
 * 计算本次请求的有效权限。
 *
 * 走 `computeEffectivePerms` 而不是直接用角色权限：PAT 的 `scopes` 必须在
 * 这里生效，否则一个只读 token 能通过 AI 拿到写能力。
 */
export async function resolveEffectivePermissions(actor: AiActor): Promise<Set<string>> {
  const { perms } = await PermissionService.loadForRoleIds(actor.roleIds)
  return computeEffectivePerms(perms, actor.tokenScope, PERMISSION_CODES)
}

/** 给模型看的工具定义。已禁用或无权的能力**不出现在清单里**，也不要泄露错误原因。 */
export async function toolsForActor(actor: AiActor): Promise<{ permissions: Set<string>; capabilities: readonly AiCapability[] }> {
  const permissions = await resolveEffectivePermissions(actor)
  return { permissions, capabilities: listAiCapabilitiesFor(permissions) }
}

export async function executeCapability(request: AiExecutionRequest, name: string, input: unknown): Promise<AiExecutionOutcome> {
  const { actor, runtime, audit } = request
  const startedAt = Date.now()
  const capability = getAiCapability(name)

  if (!capability || !capability.enabled) {
    // 未知能力与已禁用能力都不进审计「谁想调用什么」——但仍要留痕，
    // 否则模型幻觉出一个能力名时我们就看不出它在试探什么。
    await audit.write({
      requestId: request.requestId, conversationId: request.conversationId, actorId: actor.userId,
      sessionId: request.sessionId, capabilityName: name, operationId: capability?.operationId ?? 'unknown',
      riskLevel: capability?.riskLevel ?? 'read', permissionDecision: 'denied', executionStatus: 'denied',
      durationMs: Date.now() - startedAt,
    })
    return { ok: false, error: `能力 ${name} 不可用` }
  }

  const base = {
    requestId: request.requestId, conversationId: request.conversationId, actorId: actor.userId,
    sessionId: request.sessionId, capabilityName: capability.name, operationId: capability.operationId,
    riskLevel: capability.riskLevel as string, durationMs: Date.now() - startedAt,
  }

  // 3. 风险等级闸门。与 Catalog.register / listFor / 门面的 listAiCapabilities
  //    共用同一个 isModelInvocableRiskLevel——所有把能力交给模型的出口都收敛到
  //    这一个判定上。执行侧仍要再判一次，因为注册期校验可以被绕过
  //    （构造期反射、旧代码、误改）。模型工具面**不包含**任何写操作：
  //    写业务数据必须走人工提交路径，不经过本文件。
  //    不提供任何用户可覆盖的「确认」参数——那等价于把写操作交给模型决定。
  if (!isModelInvocableRiskLevel(capability.riskLevel)) {
    await audit.write({
      ...base, inputDigest: digestInput(input),
      permissionDecision: 'denied', executionStatus: 'denied',
      errorSummary: `capability ${capability.name} is not model-invocable (riskLevel=${capability.riskLevel})`,
    })
    return { ok: false, error: `能力 ${name} 不可用` }
  }

  // system 的路由前缀为空，按公共装配契约不进入可启停模块表。
  // 可选业务模块仍必须启用，不能因持有权限而绕过模块开关。
  const enabledModules = await runtime.moduleState.enabledIds()
  if (capability.moduleId !== 'system' && !enabledModules.has(capability.moduleId)) {
    await audit.write({ ...base, inputDigest: digestInput(input), permissionDecision: 'denied', executionStatus: 'denied' })
    return { ok: false, error: `能力 ${name} 不可用` }
  }

  // 3. 权限重算。
  const permissions = await resolveEffectivePermissions(actor)
  if (!hasPermission(permissions, capability.permissionCode)) {
    await audit.write({ ...base, inputDigest: digestInput(input), permissionDecision: 'denied', executionStatus: 'denied' })
    return { ok: false, error: `没有权限执行该操作` }
  }

  // 4. 入参校验。用与 REST 同一份 TypeBox schema，避免两套校验规则漂移。
  if (capability.inputSchema && !Value.Check(capability.inputSchema as TSchema, input)) {
    const details = [...Value.Errors(capability.inputSchema as TSchema, input)]
      .slice(0, 5)
      .map(error => `${error.path || '/'} ${error.message}`)
      .join('; ')
    await audit.write({ ...base, inputDigest: digestInput(input), permissionDecision: 'allowed', executionStatus: 'rejected', errorSummary: details.slice(0, 512) })
    return { ok: false, error: `参数不合法：${details}` }
  }

  // 5. 执行。actorId 由这里注入，能力实现拿不到「换一个用户执行」的口子。
  //    行级数据范围按**本能力自己的** permissionCode 建立——不能用聊天接口的
  //    `ai:chat:use` 代替，否则一个只有聊天权限的角色会按错档位解析范围。
  const context: AiCapabilityContext = {
    actorId: actor.userId,
    permissions,
    requestId: request.requestId,
    // 会话与 PAT scope 同样来自服务端。草稿类能力靠 conversationId 判定归属，
    // 业务授权靠 tokenScope 保留收窄语义 —— 两者都不能由模型入参决定。
    conversationId: request.conversationId,
    tokenScope: actor.tokenScope,
  }
  try {
    const result = await establishDataScopeFor(
      {
        userId: actor.userId,
        roleIds: actor.roleIds,
        deptIds: actor.deptIds,
        tokenScope: actor.tokenScope,
        // 第 3 步已经算过一遍有效权限（含 PAT 交集），直接复用，避免第二次查询
        // 与第二个「超管判定」实现来源。
        superAdmin: permissions.has(SUPER_ADMIN_BYPASS),
      },
      capability.permissionCode,
      () => capability.execute(context, input),
    )
    await audit.write({
      ...base, inputDigest: digestInput(input), permissionDecision: 'allowed',
      executionStatus: 'success', durationMs: Date.now() - startedAt,
      targetType: capability.moduleId,
    })
    return { ok: true, result }
  } catch (error) {
    await audit.write({
      ...base, inputDigest: digestInput(input), permissionDecision: 'allowed',
      executionStatus: 'failed', durationMs: Date.now() - startedAt,
      errorSummary: summarizeError(error),
    })
    return { ok: false, error: summarizeError(error) }
  }
}

/** 供审计/告警使用：超管哨兵是否在本请求内。 */
export function isSuperAdmin(permissions: ReadonlySet<string>): boolean {
  return permissions.has(SUPER_ADMIN_BYPASS)
}
