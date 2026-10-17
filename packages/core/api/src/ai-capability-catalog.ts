/**
 * ai-capability-catalog.ts — AI 能力注册中心。
 *
 * 形状照抄 `PermissionCatalog`：一个显式创建的注册表 + AsyncLocalStorage 作用域，
 * 「门面自身不持有任何定义」。这不是形式上的模仿——权限目录已经证明了
 * 「不扫描目录、只注册声明」是这个仓库的既有约束，AI 能力必须同样显式，
 * 否则就退化成「把所有接口一股脑丢给模型」，那正是规格明令禁止的。
 *
 * 依赖方向（不可反转）：
 *   core/api（本文件，注册中心）← core/system-api（注册 user/role/dept 能力）
 *                                ← ai 模块（消费）
 * system-api 不得依赖 ai 模块，否则 Core 反向依赖产品层。
 */

/** 风险等级。决定是否需要用户显式确认，以及审计记录的处置级别。 */
export type AiRiskLevel =
  /** 只读，不改任何数据 */
  | 'read'
  /** 预填表单 / 跳转，不落库 */
  | 'prepare'
  /** 会写业务数据 */
  | 'write'
  /** 触及敏感数据或不可逆操作 */
  | 'sensitive'

/**
 * 执行上下文。
 *
 * `actorId` 由调用方（fastify request）注入，**能力实现不得自行指定**——
 * AI 不能决定「以谁的身份执行」，也不允许用系统管理员代替当前用户。
 */
export interface AiCapabilityContext {
  /** 当前登录用户，AI 不可覆盖 */
  readonly actorId: number
  /** 本次请求的有效权限（已含 PAT scope 交集与超管哨兵） */
  readonly permissions: ReadonlySet<string>
  /** 请求级行级数据范围已就绪；能力实现复用现有 Service，因此自动继承 */
  readonly requestId: string
  /**
   * 本轮对话所属会话，由执行入口注入。
   *
   * 会话是草稿归属判定的一半（另一半是 `actorId`），因此它必须来自服务端：
   * 模型指定一个 `conversationId` 就能把草稿写进别人的会话，或让工具以为自己
   * 正处于一个它其实不在的会话里。没有会话上下文的上下文（单轮调用）一律按
   * 「无法判定归属」处理，能力应当拒绝而不是猜。
   */
  readonly conversationId?: string
  /**
   * 本次请求的 PAT scope 交集。能力要用身份做业务授权时必须原样透传，
   * 漏传等于把一个受限 token 提升成完整会话身份。
   */
  readonly tokenScope?: readonly string[]
}

/** 能力执行结果。结构化，不是聊天文本。 */
export interface AiCapabilityResult {
  /** 供模型理解的结构化结果 */
  readonly data: unknown
  /** 前端直接渲染的卡片类型，如 `user.table` / `form.prefill` */
  readonly render?: { readonly kind: string; readonly payload: unknown }
  /** 人类可读的一句话，不额外调模型生成 */
  readonly summary?: string
  /** 是否触发了数据变更，供审计与幂等判断 */
  readonly mutated?: boolean
}

/**
 * 一项 AI 能力。
 *
 * `permissionCode` 是**唯一**的授权依据：能力不自带权限判断，执行时按这个码
 * 重新走一遍 RBAC。`enabled` 只是开关，不是安全边界——执行链必须重新校验，
 * 不能因为「列表里没给模型看这个工具」就认为它安全。
 */
export interface AiCapability {
  readonly name: string
  /** 给模型看的用途描述；写清楚它**不做什么**比写它做什么更能抑制误用 */
  readonly description: string
  readonly moduleId: string
  /** 对应业务 API 的 operationId，便于追溯到既有接口而不是新造一套 */
  readonly operationId: string
  readonly permissionCode: string
  /** TypeBox schema，与现有 API schema 同源，避免两套校验 */
  readonly inputSchema: unknown
  readonly riskLevel: AiRiskLevel
  readonly enabled: boolean
  readonly execute: (
    context: AiCapabilityContext,
    input: unknown,
  ) => Promise<AiCapabilityResult>
}

/**
 * 模型可调用的判定。注册、清单与执行三处使用**同一个函数**——
 * 三份判断一旦分叉，就等于留了一条只有某一条路径没堵上的写操作口子。
 *
 * 条件写成字面量而不是查一张数组：查数组的写法会让后人以为
 * 「改这张表就能改闸门」，从而在第四个地方复制出第二种判定。
 *
 * `AiRiskLevel` 仍保留 write/sensitive：它们描述**业务操作**本身的风险，
 * 由人工提交路径与审计使用；只是不允许出现在模型可调用的目录里。
 */
export function isModelInvocableRiskLevel(riskLevel: AiRiskLevel): boolean {
  return riskLevel === 'read' || riskLevel === 'prepare'
}

export class AiCapabilityCatalog {
  private readonly definitions = new Map<string, AiCapability>()

  register(...definitions: readonly AiCapability[]): void {
    for (const definition of definitions) {
      if (!definition.name || !definition.moduleId || !definition.operationId || !definition.permissionCode) {
        throw new Error('ai capability declaration requires name, moduleId, operationId and permissionCode')
      }
      if (!isModelInvocableRiskLevel(definition.riskLevel)) {
        throw new Error(
          `ai capability ${definition.name} is not model-invocable: riskLevel must be read or prepare, got ${definition.riskLevel}`,
        )
      }
      if (this.definitions.has(definition.name)) {
        throw new Error(`duplicate ai capability declaration: ${definition.name}`)
      }
      this.definitions.set(definition.name, Object.freeze({ ...definition }))
    }
  }

  has(name: string): boolean {
    return this.definitions.has(name)
  }

  get names(): ReadonlySet<string> {
    return new Set(this.definitions.keys())
  }

  /** 单项能力；未注册返回 undefined，由执行链给出「不可用」而不是静默跳过。 */
  get(name: string): AiCapability | undefined {
    return this.definitions.get(name)
  }

  listCapabilities(): readonly AiCapability[] {
    return Object.freeze([...this.definitions.values()])
  }

  /**
   * 列出当前用户**可以尝试**调用的能力。
   *
   * 这只是给模型的提示清单，用于减少无谓的失败尝试；**不是授权**。
   * 执行时必须重新完整校验（权限、数据范围、业务规则），因为两次调用之间
   * 权限可能已被回收。
   */
  listFor(permissions: ReadonlySet<string>): readonly AiCapability[] {
    return this.listCapabilities().filter(
      (capability) =>
        isModelInvocableRiskLevel(capability.riskLevel) &&
        capability.enabled &&
        (permissions.has('__super_admin__') || permissions.has(capability.permissionCode)),
    )
  }
}
