import { Type, type TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import type { AiCapability } from '@yishan/core-api/ai-capabilities/catalog'
import type { AiExecutionEnv } from './ai-chat.service.js'

const operationId = Type.String({ minLength: 1, maxLength: 100 })
const schemas = {
  discover_operations: Type.Object({ module: Type.Optional(Type.String({ maxLength: 64 })), keyword: Type.Optional(Type.String({ maxLength: 100 })) }, { additionalProperties: false }),
  describe_operation: Type.Object({ operationId }, { additionalProperties: false }),
  query_business_data: Type.Object({ operationId, params: Type.Object({}, { additionalProperties: true }) }, { additionalProperties: false }),
  update_form_draft: Type.Object({ operationId, values: Type.Object({}, { additionalProperties: true }), draftId: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })), draftVersion: Type.Optional(Type.Integer({ minimum: 1 })), schemaVersion: Type.Optional(Type.Integer({ minimum: 1 })) }, { additionalProperties: false }),
}

/** Discovery is a projection of explicitly registered, authorized capabilities, never OpenAPI execution. */
export function createOperationTools(execution: AiExecutionEnv): AiExecutionEnv {
  const supported = execution.capabilities.filter(c => c.enabled && c.operation && (c.riskLevel === 'read' || c.riskLevel === 'prepare'))
  const succeed = (data: unknown) => ({ ok: true as const, result: { data, mutated: false } })
  const unavailable = () => ({ ok: false as const, error: '操作不可用，请重新发现当前可用操作' })
  const definitions = Object.entries(schemas).map(([name, inputSchema]): AiCapability => ({
    name, moduleId: 'ai', operationId: name, permissionCode: 'ai:chat:use', riskLevel: 'read', enabled: true,
    description: {
      discover_operations: '按业务模块或关键词发现当前用户获授权的操作。先发现，再描述；不返回全量接口。',
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
      const keyword = typeof raw.keyword === 'string' ? raw.keyword.toLowerCase() : ''
      const operations = supported.filter(c => (!raw.module || c.moduleId === raw.module || c.operation!.id.startsWith(String(raw.module) + '.')) && (!keyword || `${c.operation!.id} ${c.operation!.name} ${c.description}`.toLowerCase().includes(keyword)))
        .slice(0, 20).map(c => ({ ...c.operation, module: c.moduleId }))
      return succeed({ operations })
    }
    const capability = supported.find(c => c.operation!.id === raw.operationId)
    if (!capability) return unavailable()
    if (name === 'describe_operation') {
      const describe = capability.operation!.describeCapability
      if (describe) {
        if (!execution.capabilities.some(c => c.name === describe)) return unavailable()
        const described = await execution.execute(describe, {})
        if (!described.ok) return described
        return succeed({ ...capability.operation, module: capability.moduleId, form: described.result.data, description: capability.description })
      }
      return succeed({ ...capability.operation, module: capability.moduleId, inputSchema: capability.inputSchema, description: capability.description })
    }
    if (name === 'query_business_data') {
      if (capability.riskLevel !== 'read' || capability.operation!.type !== 'query') return unavailable()
      return execution.execute(capability.name, raw.params)
    }
    if (capability.riskLevel !== 'prepare' || !capability.operation!.formKey) return unavailable()
    const values = raw.values as Record<string, unknown>
    if (['draftId', 'draftVersion', 'schemaVersion', 'module', 'action', 'actorId', 'ownerId', 'conversationId'].some(key => key in values)) return { ok: false as const, error: '草稿字段中不允许携带身份或控制参数' }
    const patch = { ...values, ...(raw.draftId ? { draftId: raw.draftId } : {}), ...(raw.draftVersion ? { draftVersion: raw.draftVersion } : {}), ...(raw.schemaVersion ? { schemaVersion: raw.schemaVersion } : {}) }
    return execution.execute(capability.name, patch)
  }
  return { capabilities: definitions, execute }
}
