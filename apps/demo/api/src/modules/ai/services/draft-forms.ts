import { CreateDeptFieldsSchema, UserCreateDraftFieldsSchema, UserCreationFormService, DepartmentCreationFormService, validateUserCreation, PermissionService, computeEffectivePerms, hasPermission, establishDataScopeFor, userDirectory, SUPER_ADMIN_BYPASS, DeptService, type UserCreateForm, type UserCreationSubject } from '@yishan/core-system-api'
import { PERMISSION_CODES } from '@yishan/core-api/permissions/catalog'
import type { TSchema } from '@sinclair/typebox'
import { aiError } from '../ai-chat-error.js'

/** Business adapters provide only metadata and existing service calls; the draft state machine is shared. */
export function draftFieldSchemas(action: string): Record<string, TSchema> {
  if (action === 'department.create') return CreateDeptFieldsSchema.properties
  if (action === 'user.create') return UserCreateDraftFieldsSchema.properties
  throw aiError(400, '不支持的表单目标')
}

export function draftForm(action: string): UserCreateForm {
  if (action === 'user.create') return UserCreationFormService.getCreateForm()
  if (action === 'department.create') return DepartmentCreationFormService.getCreateForm()
  throw aiError(400, '不支持的表单目标')
}

export async function authorizeDraft(action: string, subject: UserCreationSubject, fields: Record<string, unknown>): Promise<void> {
  if (action === 'user.create') return validateUserCreation(subject, fields)
  if (action !== 'department.create') throw aiError(400, '不支持的表单目标')
  const roles = await PermissionService.loadRoleIdsForUser(subject.actorId)
  const { perms } = await PermissionService.loadForRoleIds(roles, { ttlMs: 0 })
  const effective = computeEffectivePerms(perms, subject.tokenScope, PERMISSION_CODES)
  if (!hasPermission(effective, 'system:department:create')) throw aiError(400, '没有新增部门的权限')
  const identity = await userDirectory.findById(subject.actorId)
  if (!identity || identity.status !== '1') throw aiError(400, '当前用户身份不可用')
  await establishDataScopeFor({ userId: subject.actorId, roleIds: roles, deptIds: identity.deptIds, tokenScope: subject.tokenScope ? [...subject.tokenScope] : undefined, superAdmin: effective.has(SUPER_ADMIN_BYPASS) }, 'system:department:create', () => DeptService.validateCreateReferences(fields))
}
