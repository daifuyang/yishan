export interface ResourceLifecycle {
  connect?(): Promise<void>
  close(): Promise<void>
}

export interface ApplicationContext {
  readonly applicationId: string
}
