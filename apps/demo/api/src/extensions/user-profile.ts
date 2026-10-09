import type { UserExtension, UserLifecycleEvent } from '@yishan/core-contracts'
import { BusinessError } from '@yishan/core-api/errors'
import { ValidationErrorCode } from '@yishan/core-api/business-codes/validation'

export interface DemoProfileEvents {
  recordEvent(event: UserLifecycleEvent): Promise<void>
}

export function createDemoUserExtension(profiles: DemoProfileEvents): UserExtension {
  return {
    id: 'demo_user_profile',
    async validate(mutation) {
      if (mutation.fields.username === 'demo_service') {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, 'demo_service is reserved for Demo automation')
      }
    },
    async onEvent(event) { await profiles.recordEvent(event) },
  }
}
