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
  findById(id: number): Promise<UserIdentity | null>
  findByIds(ids: readonly number[], options?: { includeDeleted?: boolean }): Promise<ReadonlyMap<number, UserIdentity>>
}
