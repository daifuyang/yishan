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
export interface AiCapabilityDeclaration {
  readonly name: string
  readonly description: string
  /** 所属业务操作的 operationId，用于追溯到既有 API 而非另造一套 */
  readonly operationId: string
  /** 授权依据。执行时按这个码重新走 RBAC，能力自身不带权限判断 */
  readonly permissionCode: string
  readonly inputSchema: unknown
  readonly riskLevel: 'read' | 'prepare' | 'write' | 'sensitive'
  readonly enabled: boolean
  readonly execute: (context: unknown, input: unknown) => Promise<unknown>
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
