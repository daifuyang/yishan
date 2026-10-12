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

/** Platform-independent registration contract; the host owns its router type. */
export interface YishanModule<Router, Context = unknown> extends ModuleMetadata {
  readonly contractVersion: 2
  readonly prefix?: string
  readonly dependencies?: readonly ModuleDependency[]
  readonly migrations?: MigrationSource
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
