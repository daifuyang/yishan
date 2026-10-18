export interface PermissionRef {
  readonly code: string
  readonly label: string
  readonly group: string
  readonly description?: string
}

export interface UserIdentity {
  readonly id: number
  readonly username: string | null
  readonly realName: string | null
  readonly nickname: string | null
  readonly status: string
  readonly roleIds: readonly number[]
  readonly deptIds: readonly number[]
}

export interface UserDirectory {
  /** Internal identity lookup, independent of business data scope. Callers must authorize the target. */
  findById(id: number): Promise<UserIdentity | null>
  /** Internal identity lookup for authorized references and history display, not a visible-user search. */
  findByIds(ids: readonly number[], options?: { includeDeleted?: boolean }): Promise<ReadonlyMap<number, UserIdentity>>
}
