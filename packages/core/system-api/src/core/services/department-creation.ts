import type { AppTx } from '@/db'
import type { CreateDeptReq } from '../schemas/department.js'
import type { DraftSubmission, DraftSubmissionFailure } from './user-creation.js'

/** Product-injected participant; department business and draft receipt commit in one transaction. */
export interface DepartmentCreationParticipant {
  claim(tx: AppTx, actorId: number, submission: DraftSubmission): Promise<
    { kind: 'create'; fields: Omit<CreateDeptReq, 'draftSubmission'> } | { kind: 'replay'; departmentId: number }
  >
  complete(tx: AppTx, actorId: number, submission: DraftSubmission, result: { id: number }): Promise<void>
  fail?(failure: DraftSubmissionFailure): Promise<void>
}
