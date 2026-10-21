import type { AiDraftAdapter, AiDraftQuestion } from '@yishan/core-api/ai-capabilities/catalog'
import { PERMISSION_CODES } from '@yishan/core-api/permissions/catalog'
import { CreateDeptFieldsSchema } from '../schemas/department.js'
import { UserCreateDraftFieldsSchema } from '../schemas/user.js'
import { UserCreationFormService, type DeptCandidateNode } from '../services/user-creation-form.service.js'
import { DepartmentCreationFormService } from '../services/department-creation-form.service.js'
import { validateUserCreation } from '../services/user-creation-policy.js'
import { PermissionService } from '../services/permission.service.js'
import { computeEffectivePerms, hasPermission, SUPER_ADMIN_BYPASS } from '../auth/effective-permissions.js'
import { establishDataScopeFor } from '../auth/index.js'
import { userDirectory } from '../../users.js'
import { DeptService } from '../services/dept.service.js'

export const userDraftAdapter: AiDraftAdapter = {
  aliases: ['新建用户', '创建用户', '添加用户'],
  action: 'user.create', moduleId: 'system', name: '新增用户', prepareCapabilityName: 'prepare_user_form_draft', legacyPrepareCapabilityNames: ['prepare_create_user'], operationId: 'createUser', permissionCode: 'system:user:create',
  questionFields: ['deptIds', 'roleIds'],
  describeCapability: 'get_user_create_form', references: { deptIds: 'user.create.options', roleIds: 'user.create.options' },
  fieldSchemas: UserCreateDraftFieldsSchema.properties,
  form: () => UserCreationFormService.getCreateForm(),
  authorize: (subject, fields) => validateUserCreation(subject, fields),
  async questions(subject, fields) {
    if ('deptIds' in fields && 'roleIds' in fields) return []
    const deptIds = Array.isArray(fields.deptIds) ? fields.deptIds as number[] : undefined
    const candidates = await UserCreationFormService.listCandidates(subject, { deptIds, page: 1, pageSize: 100 })
    if (!candidates.creatable) return []
    if (!('deptIds' in fields)) {
      const options: { value: number; label: string; parentValue?: number }[] = []
      const visit = (nodes: readonly DeptCandidateNode[], parentValue?: number) => {
        for (const node of nodes) {
          options.push({ value: node.id, label: node.name, ...(parentValue === undefined ? {} : { parentValue }) })
          if (node.children) visit(node.children, node.id)
        }
      }
      visit(candidates.departments)
      let allowEmpty = false
      try { await validateUserCreation(subject, { ...fields, deptIds: [] }); allowEmpty = true } catch {}
      return [{ field: 'deptIds', title: '选择归属部门', multiple: true, options: options.slice(0, 100), allowEmpty, truncated: options.length > 100 }] satisfies AiDraftQuestion[]
    }
    let allowEmpty = false
    try { await validateUserCreation(subject, { ...fields, roleIds: [] }); allowEmpty = true } catch {}
    return [{ field: 'roleIds', title: '选择用户角色', multiple: true, options: candidates.roles.map(role => ({ value: role.id, label: role.name })), allowEmpty, truncated: candidates.total > candidates.roles.length }] satisfies AiDraftQuestion[]
  },
}

export const departmentDraftAdapter: AiDraftAdapter = {
  aliases: ['新建部门', '创建部门', '添加部门'],
  action: 'department.create', moduleId: 'system', name: '新增部门', prepareCapabilityName: 'prepare_department_form_draft', operationId: 'createDept', permissionCode: 'system:department:create',
  describeCapability: 'get_department_create_form', references: { parentId: 'department.list', leaderId: 'user.list' },
  fieldSchemas: CreateDeptFieldsSchema.properties,
  form: () => DepartmentCreationFormService.getCreateForm(),
  async authorize(subject, fields) {
    const roles = await PermissionService.loadRoleIdsForUser(subject.actorId)
    const { perms } = await PermissionService.loadForRoleIds(roles, { ttlMs: 0 })
    const effective = computeEffectivePerms(perms, subject.tokenScope, PERMISSION_CODES)
    if (!hasPermission(effective, 'system:department:create')) throw new Error('没有新增部门的权限')
    const identity = await userDirectory.findById(subject.actorId)
    if (!identity || identity.status !== '1') throw new Error('当前用户身份不可用')
    await establishDataScopeFor({ userId: subject.actorId, roleIds: roles, deptIds: identity.deptIds, tokenScope: subject.tokenScope ? [...subject.tokenScope] : undefined, superAdmin: effective.has(SUPER_ADMIN_BYPASS) }, 'system:department:create', () => DeptService.validateCreateReferences(fields))
  },
}
