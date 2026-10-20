export interface ModuleMetadata {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly tablePrefix: string
}

export interface ModuleDependency {
  readonly id: string
  readonly version?: string
}

export interface MigrationSource {
  readonly id: string
  readonly folder: string
  readonly historyTable: string
}

/**
 * 模块贡献的 AI 能力声明（可选）。
 *
 * 契约里只放**窄结构类型**：Core 不 import 任何 AI 运行时类型，也不执行能力，
 * 只负责把声明交给能力注册中心。能力实现的类型由注册方自行满足。
 */
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

export interface AiDraftSubject {
  actorId: number
  tokenScope?: readonly string[]
}

export interface AiDraftForm {
  schemaVersion: number
  fields: { name: string; label: string; required: boolean; sensitive: boolean; selector: string; constraints: Record<string, unknown> }[]
  defaults: Record<string, unknown>
  editableFields: string[]
  missingFields: { name: string; label: string; required: boolean; sensitive: boolean; mustCompleteInForm: true }[]
}

export interface AiDraftQuestion {
  field: string
  title: string
  multiple: boolean
  options: readonly { value: number; label: string; description?: string }[]
  allowEmpty?: boolean
  truncated?: boolean
}

/** Business-owned metadata and authorization; registration never grants permission. */
export interface AiDraftAdapter {
  action: string
  moduleId: string
  name: string
  prepareCapabilityName: string
  legacyPrepareCapabilityNames?: readonly string[]
  operationId: string
  permissionCode: string
  describeCapability?: string
  references?: Readonly<Record<string, string>>
  questionFields?: readonly string[]
  fieldSchemas: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  form(): AiDraftForm
  authorize(subject: AiDraftSubject, fields: Record<string, unknown>): Promise<void>
  questions?(subject: AiDraftSubject, fields: Record<string, unknown>): Promise<readonly AiDraftQuestion[]>
}

export interface AiCapabilityDeclaration {
  readonly draftAdapter?: AiDraftAdapter
  readonly operation?: {
    readonly id: string
    readonly name: string
    readonly type: 'query' | 'create' | 'update' | 'delete' | 'describe'
    readonly formKey?: string
    readonly describeCapability?: string
    readonly references?: Readonly<Record<string, string>>
  }
  readonly name: string
  readonly description: string
  /** 所属业务操作的 operationId，用于追溯到既有 API 而非另造一套 */
  readonly operationId: string
  /** 授权依据。执行时按这个码重新走 RBAC，能力自身不带权限判断 */
  readonly permissionCode: string
  readonly inputSchema: unknown
  readonly riskLevel: 'read' | 'prepare' | 'write' | 'sensitive'
  readonly enabled: boolean
  readonly execute: (context: AiCapabilityContext, input: unknown) => Promise<AiCapabilityResult>
}

/** Platform-independent registration contract; the host owns its router type. */
export interface YishanModule<Router, Context = unknown> extends ModuleMetadata {
  readonly contractVersion: 2
  readonly prefix?: string
  readonly dependencies?: readonly ModuleDependency[]
  readonly migrations?: MigrationSource
  /** 显式声明本模块开放的 AI 能力。不声明 = 不开放，绝不扫描推断。 */
  readonly capabilities?: readonly AiCapabilityDeclaration[]
  readonly register: (router: Router, context: Context) => Promise<void>
  readonly initialize?: (context: Context) => Promise<void>
  readonly close?: (context: Context) => Promise<void>
  readonly seed?: (context: Context) => Promise<void>
}

export interface ModuleStateStore {
  sync(modules: readonly ModuleMetadata[]): Promise<void>
  enabledIds(): Promise<ReadonlySet<string>>
  invalidate?(): Promise<void>
}
