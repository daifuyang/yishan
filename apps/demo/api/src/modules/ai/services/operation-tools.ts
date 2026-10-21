import { Type, type TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import type { AiCapability } from '@yishan/core-api/ai-capabilities/catalog'
import type { AiToolProgress } from '@yishan/core-contracts'
import type { AiExecutionEnv } from './ai-chat.service.js'
import type { AiExecutionOutcome } from './ai-execution-chain.js'

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export function operationProgress(outcome: AiExecutionOutcome, capability: AiCapability, action: 'query' | 'draft', values: Record<string, unknown>): AiExecutionOutcome {
  if (!outcome.ok || !capability.operation) return outcome
  const operation = capability.operation
  const data = record(outcome.result.data)
  const kind = operation.presentation?.kind ?? 'operation'
  const items = Array.isArray(data.items) ? data.items : undefined
  const count = items
    ? typeof data.total === 'number' && Number.isSafeInteger(data.total) && data.total >= items.length
      ? data.total
      : items.length
    : undefined
  const saved = action === 'draft' && typeof data.draftId === 'string' && data.draftId.length > 0
  const formFields = capability.draftAdapter?.form().fields ?? []
  const properties = record(record(capability.inputSchema).properties)
  const fieldLabels = saved
    ? Object.keys(values).flatMap(key => {
      const field = formFields.find(field => field.name === key)
      if (field?.sensitive || /password|token|secret|privateKey/i.test(key)) return []
      const label = field?.label ?? record(properties[key]).title
      return typeof label === 'string' ? [label] : []
    })
    : undefined
  const missingLabels = saved && Array.isArray(data.missingFields)
    ? data.missingFields.flatMap(field => {
      const label = record(field).label
      return typeof label === 'string' ? [label] : []
    })
    : []
  const progress: AiToolProgress = {
    action, kind, subject: operation.presentation?.subject ?? operation.name,
    outcome: saved ? 'saved' : count === 0 ? 'empty' : 'ready',
    ...(count !== undefined ? { count, returnedCount: items?.length } : {}),
    ...(saved ? { fieldLabels, missingLabels } : {}),
  }
  return { ...outcome, result: { ...outcome.result, progress } }
}

const operationId = Type.String({ minLength: 1, maxLength: 100 })
const schemas = {
  discover_operations: Type.Object({ module: Type.Optional(Type.String({ maxLength: 64 })), keyword: Type.Optional(Type.String({ maxLength: 100 })) }, { additionalProperties: false }),
  describe_operation: Type.Object({ operationId }, { additionalProperties: false }),
  query_business_data: Type.Object({ operationId, params: Type.Object({}, { additionalProperties: true }) }, { additionalProperties: false }),
  update_form_draft: Type.Object({ operationId, values: Type.Object({}, { additionalProperties: true }), draftId: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })), draftVersion: Type.Optional(Type.Integer({ minimum: 1 })), schemaVersion: Type.Optional(Type.Integer({ minimum: 1 })) }, { additionalProperties: false }),
}

/**
 * 模型把数字参数写成字符串时的归一。
 *
 * 模型经常把 `pageSize: 20` 写成 `pageSize: "20"`。执行链用的是**与 REST 同一份
 * TypeBox schema** 校验，`Type.Integer()` 收到字符串就报
 * `参数不合法：/pageSize Expected integer` —— 模型拿到这个错误后往往**用同样的
 * 写法再试一遍**，于是一次提问能连续失败四五轮，助手卡在工具循环里出不来。
 *
 * 这里只做**无损**归一：字符串必须整体是一个数字字面量，且落在 schema 声明的
 * number/integer 类型上，才转成数字。转换不了就原样保留，让既有的校验通道照旧
 * 报错 —— 不在这里放宽任何约束。
 */
function coerceNumericParams(values: Record<string, unknown>, schema: TSchema): Record<string, unknown> {
  const properties = (schema as { properties?: Record<string, TSchema> }).properties
  if (!properties) return values
  const result: Record<string, unknown> = { ...values }
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string') continue
    const source = properties[key]
    if (!source) continue
    const variants: TSchema[] = source.anyOf ?? [source]
    const nonNull = variants.filter(item => item.type !== 'null')
    if (!nonNull.length) continue
    const wantsNumber = nonNull.some(item => item.type === 'number' || item.type === 'integer')
    if (!wantsNumber) continue
    if (!/^-?\d+(\.\d+)?$/.test(value.trim())) continue
    const parsed = Number(value.trim())
    if (!Number.isFinite(parsed)) continue
    if (nonNull.some(item => item.type === 'integer') && !Number.isInteger(parsed)) continue
    result[key] = parsed
  }
  return result
}

/** Discovery is a projection of explicitly registered, authorized capabilities, never OpenAPI execution. */
export function createOperationTools(execution: AiExecutionEnv): AiExecutionEnv {
  const supported = execution.capabilities.filter(c => c.enabled && c.operation && (c.riskLevel === 'read' || c.riskLevel === 'prepare'))
  const succeed = (data: unknown, progress: AiToolProgress) => ({ ok: true as const, result: { data, progress, mutated: false } })
  const unavailable = () => ({ ok: false as const, error: '操作不可用，请重新发现当前可用操作' })
  const definitions = Object.entries(schemas).map(([name, inputSchema]): AiCapability => ({
    name, moduleId: 'ai', operationId: name, permissionCode: 'ai:chat:use', riskLevel: 'read', enabled: true,
    description: {
      discover_operations: '按业务对象或操作名称发现当前用户获授权的操作，支持业务注册的别名，例如新建、创建、添加。优先提供简短业务关键词。先发现，再描述；不返回全量接口。',
      describe_operation: '读取操作的真实输入字段、必填约束、原生表单和引用数据源。',
      query_business_data: '按已发现的查询操作读取业务数据或表单候选，params遵守该操作Schema。',
      update_form_draft: '创建或增量更新当前会话持久化表单草稿，不保存正式业务记录。变更已有值必须带上读到的draftVersion；密码只在原生表单输入。',
    }[name] ?? name,
    inputSchema,
    async execute(_context, input) {
      const outcome = await execute(name, input)
      if (!outcome.ok) throw new Error(outcome.error)
      return outcome.result
    },
  }))

  async function execute(name: string, input: unknown) {
    const schema = schemas[name as keyof typeof schemas] as TSchema | undefined
    if (!schema || !Value.Check(schema, input)) return { ok: false as const, error: '操作参数格式不正确' }
    const raw = input as Record<string, unknown>
    if (name === 'discover_operations') {
      const keyword = typeof raw.keyword === 'string' ? raw.keyword.trim().toLowerCase() : ''
      const operations = supported.filter(c => (!raw.module || c.moduleId === raw.module || c.operation!.id.startsWith(String(raw.module) + '.')) && (!keyword || [c.operation!.id, c.operation!.name, c.description, ...(c.operation!.aliases ?? [])].some(value => value.toLowerCase().includes(keyword))))
        .slice(0, 20).map(c => ({ ...c.operation, module: c.moduleId }))
      return succeed({ operations }, { action: 'discover', kind: 'operations', subject: String(raw.keyword ?? raw.module ?? '已授权业务'), outcome: operations.length ? 'ready' : 'empty', count: operations.length })
    }
    const capability = supported.find(c => c.operation!.id === raw.operationId)
    if (!capability) return unavailable()
    if (name === 'describe_operation') {
      const progress: AiToolProgress = { action: 'describe', kind: capability.operation!.formKey || capability.operation!.presentation?.kind === 'form' ? 'form' : 'operation', subject: capability.operation!.presentation?.subject ?? capability.operation!.name, outcome: 'ready' }
      const describe = capability.operation!.describeCapability
      if (describe) {
        if (!execution.capabilities.some(c => c.name === describe)) return unavailable()
        const described = await execution.execute(describe, {})
        if (!described.ok) return described
        return succeed({ ...capability.operation, module: capability.moduleId, form: described.result.data, inputSchema: capability.inputSchema, description: capability.description }, progress)
      }
      return succeed({ ...capability.operation, module: capability.moduleId, inputSchema: capability.inputSchema, description: capability.description }, progress)
    }
    if (name === 'query_business_data') {
      if (capability.riskLevel !== 'read' || capability.operation!.type !== 'query') return unavailable()
      return operationProgress(await execution.execute(capability.name, coerceNumericParams(raw.params as Record<string, unknown>, capability.inputSchema as TSchema)), capability, 'query', {})
    }
    if (capability.riskLevel !== 'prepare' || !capability.operation!.formKey) return unavailable()
    const values = raw.values as Record<string, unknown>
    if (['draftId', 'draftVersion', 'schemaVersion', 'module', 'action', 'actorId', 'ownerId', 'conversationId'].some(key => key in values)) return { ok: false as const, error: '草稿字段中不允许携带身份或控制参数' }
    const fields = (capability.inputSchema as { properties?: Record<string, TSchema> }).properties ?? {}
    const normalized = coerceNumericParams(values, capability.inputSchema as TSchema)
    for (const [key, value] of Object.entries(values)) {
      const source = fields[key]
      const variants: TSchema[] = source?.anyOf ?? (source ? [source] : [])
      const nonNull = variants.filter(schema => schema.type !== 'null')
      // Models can emit digit-only text as a number. Preserve IDs/arrays and reject lossy numbers later.
      if (typeof value === 'number' && Number.isSafeInteger(value) && nonNull.length && nonNull.every(schema => schema.type === 'string')) normalized[key] = String(value)
    }
    const patch = { ...normalized, ...(raw.draftId ? { draftId: raw.draftId } : {}), ...(raw.draftVersion ? { draftVersion: raw.draftVersion } : {}), ...(raw.schemaVersion ? { schemaVersion: raw.schemaVersion } : {}) }
    return operationProgress(await execution.execute(capability.name, patch), capability, 'draft', values)
  }
  return { capabilities: definitions, execute }
}
