import type { UserIdentity } from './auth'

export interface UserMutation {
  readonly operation: 'create' | 'update'
  readonly userId?: number
  readonly actorId: number
  readonly fields: Readonly<Record<string, unknown>>
}

export interface UserLifecycleEvent {
  readonly type: 'user.created' | 'user.updated'
  readonly actorId: number
  readonly user: UserIdentity
}

/** Validation runs before persistence; lifecycle notification runs after success. */
export interface UserExtension {
  readonly id: string
  validate?(mutation: UserMutation): Promise<void>
  onEvent?(event: UserLifecycleEvent): Promise<void>
  profile?(user: UserIdentity): Promise<Readonly<Record<string, unknown>>>
}
