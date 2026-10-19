import { CreateDeptFieldsSchema, type CreateDeptReq, type DepartmentCreationParticipant, type DraftSubmission } from '@yishan/core-system-api'
import type { AppTx } from '@yishan/core-system-api/database'
import { AiUserCreationParticipant, type AiUserCreationParticipantOptions } from './user-creation-participant.js'
import type { ActionDraftService } from './action-draft.service.js'
import type { AiAuditRepository } from '../repositories/ai-audit.repository.js'

/** Reuses the existing lock, CAS, expiry, replay and audit protocol without another state machine. */
export class AiDepartmentCreationParticipant implements DepartmentCreationParticipant {
  private readonly participant: AiUserCreationParticipant<Omit<CreateDeptReq, 'draftSubmission'>>
  constructor(drafts: ActionDraftService, audit: AiAuditRepository, options: AiUserCreationParticipantOptions = {}) {
    this.participant = new AiUserCreationParticipant(drafts, audit, { ...options, action: 'department.create', targetType: 'sys_dept', fieldKeys: Object.keys(CreateDeptFieldsSchema.properties) })
  }
  async claim(tx: AppTx, actorId: number, submission: DraftSubmission) {
    const result = await this.participant.claim(tx, actorId, submission)
    return result.kind === 'replay' ? { kind: 'replay' as const, departmentId: result.userId } : result
  }
  complete(...args: Parameters<DepartmentCreationParticipant['complete']>) { return this.participant.complete(...args) }
  fail(...args: Parameters<NonNullable<DepartmentCreationParticipant['fail']>>) { return this.participant.fail(...args) }
}
