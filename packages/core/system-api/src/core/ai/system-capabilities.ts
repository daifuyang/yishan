/**
 * system-capabilities.ts — 系统管理域开放的 AI 能力（第一批）。
 *
 * 约束（来自规格，不可放宽）：
 * - **第一阶段没有任何 write 能力**。用户/角色/部门一律只读或「预填表单」，预填只产生
 *   前端一次性暂存，落库仍然由用户在真实表单里点保存完成，AI 不代劳。
 * - 能力实现**只调用现有 Service**，不新建查询、不碰 repository、不碰 sys_* 表。
 *   用户查询继承 Service 的数据范围；角色、部门等系统配置按各自接口权限控制。
 * - `actorId` 来自执行上下文，能力只用于审计与归属，**不允许被模型指定**。
 * - 每次执行前执行链会按 `permissionCode` 重走一遍 RBAC；`enabled` 只是开关，不是安全边界。
 */
import { Type, type Static } from '@sinclair/typebox'
import { registerAiCapabilities, type AiCapability, type AiCapabilityContext, type AiCapabilityResult } from '@yishan/core-api/ai-capabilities/catalog'
import { UserService } from '../services/user.service.js'
import { RoleService } from '../services/role.service.js'
import { DeptService } from '../services/dept.service.js'
import { UserCreationFormService } from '../services/user-creation-form.service.js'
import type { UserCreationSubject } from '../services/user-creation-policy.js'
import { UserListQuerySchema, type UserListQuery } from '../schemas/user.js'
import { RoleListQuerySchema, type RoleListQuery } from '../schemas/role.js'
import { DeptListQuerySchema, type DeptListQuery } from '../schemas/department.js'

const SYSTEM_MODULE = 'system'

/**
 * 单次返回给模型的最大行数。
 * 硬上限而非提示：一次把全量用户灌进上下文既贵又会把无关数据带出去，
 * 需要更多结果由模型带着 keyword/status 继续查。
 */
const MAX_ROWS = 20

const IdInput = Type.Object({ id: Type.Integer({ minimum: 1, description: '记录 ID' }) }, { additionalProperties: false })

function page<T extends { page?: number; pageSize?: number }>(query: T): { page: number; pageSize: number } {
  return { page: Math.max(1, query.page ?? 1), pageSize: Math.min(MAX_ROWS, Math.max(1, query.pageSize ?? MAX_ROWS)) }
}

/**
 * 列表结果统一带上 `truncated`，让模型知道「还有更多」而不是把 20 条当成全部。
 * 不静默截断——静默截断会让模型给出错误的全量结论。
 */
function listResult<T extends { list: unknown[]; total: number }>(result: T, render: string) {
  const shown = result.list.slice(0, MAX_ROWS)
  const data = { items: shown, total: result.total, returned: shown.length, truncated: result.total > shown.length }
  return { data, render: { kind: render, payload: data }, mutated: false } satisfies AiCapabilityResult
}

/** 预填能力的统一形状：不落库，只把字段交给前端一次性暂存。 */
function prefill(fields: Record<string, unknown>, missing: string[], target: 'user.create' | 'user.update' | 'department.create') {
  const payload = { target, fields, missing, route: PREFILL_ROUTES[target] }
  return {
    data: payload,
    render: { kind: 'form.prefill', payload },
    summary: missing.length ? `已提取 ${Object.keys(fields).length} 个字段，还需补充：${missing.join('、')}` : '字段已全部提取，可直接打开表单确认。',
    mutated: false,
  } satisfies AiCapabilityResult
}

/** 预填目标对应的真实后台路由。前端白名单会独立校验，这里只是告诉前端跳哪。 */
const PREFILL_ROUTES = {
  'user.create': '/system/user',
  'user.update': '/system/user',
  'department.create': '/system/department',
} as const

/** 用户表单必填项。缺失时返回给模型，让它主动追问而不是硬凑一个空值。 */
const USER_REQUIRED = ['username', 'realName'] as const
const DEPT_REQUIRED = ['name'] as const

/**
 * 新增用户表单的**只读**能力。
 *
 * 字段与候选来自 `UserCreationFormService` —— 与原生表单同一份定义、同一套授权。
 * 这里不再保留任何 `prepare_create_user`：草稿写入是 AI 模块的事（它拥有草稿表），
 * System 侧只负责「表单长什么样、哪些候选可选」。这样 System 永远不需要依赖 AI，
 * 也不会出现第二份字段常量。
 *
 * 两项都是 `read`：它们不改任何数据，也**不持有**任何敏感字段内容。
 */
const userCreationReadCapabilities: readonly AiCapability[] = [
  {
    name: 'get_user_create_form',
    description: '读取「新增用户」表单的真实字段定义：字段名、标签、是否必填、可写白名单与取值约束。字段定义随真实表单一起变化，不要凭记忆猜字段名。密码等敏感字段只会出现在 mustCompleteInForm 里——必须由用户在表单中输入。',
    moduleId: SYSTEM_MODULE,
    operationId: 'adminUsersCreate',
    permissionCode: 'system:user:create',
    inputSchema: Type.Object({}, { additionalProperties: false }),
    riskLevel: 'read',
    enabled: true,
    async execute(_context: AiCapabilityContext, _input: unknown) {
      const form = UserCreationFormService.getCreateForm()
      // 敏感字段连约束都不出：它的存在只需要以「必须在表单完成」的形式告知。
      const data = {
        schemaVersion: form.schemaVersion,
        editableFields: [...form.editableFields],
        fields: form.fields.filter(field => !field.sensitive),
        defaults: pick(form.defaults, form.editableFields),
        missingFields: form.missingFields,
      }
      return {
        data,
        render: { kind: 'form.schema', payload: data },
        summary: `新增用户表单共 ${data.fields.length} 个可填写字段，其中 ${data.editableFields.length} 个可以由对话收集。`,
        mutated: false,
      } satisfies AiCapabilityResult
    },
  },
  {
    name: 'get_user_create_options',
    description: '列出当前操作者**确实可以授予**的部门与角色候选。角色可能重名，选择时必须使用返回的 id 而不是名字。没有任何候选通常意味着当前范围不足以创建用户，应如实告知而不是自行编造一个部门。',
    moduleId: SYSTEM_MODULE,
    operationId: 'adminUsersCreate',
    permissionCode: 'system:user:create',
    inputSchema: Type.Object({
      deptIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }), { description: '已确定的归属部门，用于按该部门集合重算可授予角色' })),
      keyword: Type.Optional(Type.String({ maxLength: 64, description: '角色关键词' })),
      page: Type.Optional(Type.Integer({ minimum: 1 })),
      pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    }, { additionalProperties: false }),
    riskLevel: 'read',
    enabled: true,
    async execute(context: AiCapabilityContext, input: unknown) {
      const query = (input ?? {}) as { deptIds?: number[]; keyword?: string; page?: number; pageSize?: number }
      // 身份来自执行上下文：模型无法指定「以谁的范围查候选」，PAT 收窄也原样透传。
      const subject: UserCreationSubject = { actorId: context.actorId, tokenScope: context.tokenScope }
      const data = await UserCreationFormService.listCandidates(subject, query)
      return {
        data,
        render: { kind: 'form.options', payload: data },
        summary: data.creatable
          ? `可选部门 ${data.departments.length} 个、可授予角色 ${data.total} 个。`
          : '当前权限范围不足以创建用户，请联系管理员调整数据范围。',
        mutated: false,
      } satisfies AiCapabilityResult
    },
  },
]

/** 导出供装配层与测试直接注册；`setup.ts` 会把它们一起注册进运行时的能力目录。 */
export function systemCapabilitiesForUserCreation(): readonly AiCapability[] {
  return userCreationReadCapabilities
}

function pick(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}

/** 只把预填允许的字段交给前端，杜绝模型顺手注入 roleIds 之类的授权字段。 */
const USER_PREFILL_FIELDS = ['username', 'realName', 'nickname', 'email', 'phone', 'gender', 'status', 'deptId', 'deptIds', 'roleIds', 'positionIds', 'birthDate'] as const
const DEPT_PREFILL_FIELDS = ['name', 'parentId', 'status', 'sortOrder', 'description', 'leaderId'] as const

function missingFields(fields: Record<string, unknown>, required: readonly string[]): string[] {
  return required.filter(key => fields[key] === undefined)
}

/** 明确拒绝密码类字段：AI 不传递、也不持有敏感凭据。 */
const FORBIDDEN_INPUT_KEYS = new Set(['password', 'oldPassword', 'newPassword', 'token', 'secret', 'privateKey'])

function assertNoSecrets(input: unknown): void {
  if (!input || typeof input !== 'object') return
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (FORBIDDEN_INPUT_KEYS.has(key)) {
      throw new Error(`字段 ${key} 不允许通过 AI 传递`)
    }
  }
}

export function registerSystemAiCapabilities(): void {
  registerAiCapabilities(
    {
      name: 'list_users',
      description: '按关键词/状态分页查询系统用户。返回受当前用户数据范围限制的可见用户。不返回密码、令牌等敏感信息，也不能创建或修改用户。',
      moduleId: SYSTEM_MODULE,
      operationId: 'adminUsersList',
      permissionCode: 'system:user:list',
      inputSchema: UserListQuerySchema,
      riskLevel: 'read',
      enabled: true,
      async execute(_context: AiCapabilityContext, input: unknown) {
        const query = input as UserListQuery
        assertNoSecrets(query)
        return listResult(await UserService.getUserList({ ...query, ...page(query) }), 'user.table')
      },
    },
    {
      name: 'get_user',
      description: '按 ID 读取单个用户详情。若该用户不在当前用户的数据范围内，返回「不存在」而不是报错。',
      moduleId: SYSTEM_MODULE,
      operationId: 'adminUsersDetail',
      permissionCode: 'system:user:list',
      inputSchema: IdInput,
      riskLevel: 'read',
      enabled: true,
      async execute(_context: AiCapabilityContext, input: unknown) {
        const { id } = input as Static<typeof IdInput>
        const user = await UserService.getUserById(id)
        if (!user) throw new Error(`用户 ${id} 不存在或不在你的数据范围内`)
        const data = { user }
        return { data, render: { kind: 'user.detail', payload: data }, mutated: false } satisfies AiCapabilityResult
      },
    },
    ...userCreationReadCapabilities,
    {
      name: 'prepare_update_user',
      description: '抽取要修改的用户字段并预填到「编辑用户」表单。**不会保存修改**。必须先调用 get_user 或 list_users 确认目标用户，再把用户提到的字段合并进来。',
      moduleId: SYSTEM_MODULE,
      operationId: 'adminUsersUpdate',
      permissionCode: 'system:user:update',
      inputSchema: Type.Object({
        id: Type.Optional(Type.Integer({ minimum: 1, description: '目标用户 ID；不确定时先查询' })),
        realName: Type.Optional(Type.String()),
        nickname: Type.Optional(Type.String()),
        email: Type.Optional(Type.String()),
        phone: Type.Optional(Type.String()),
        status: Type.Optional(Type.Union([Type.Literal('0'), Type.Literal('1'), Type.Literal('2')])),
        deptId: Type.Optional(Type.Integer()),
        roleIds: Type.Optional(Type.Array(Type.Integer())),
      }, { additionalProperties: false }),
      riskLevel: 'prepare',
      enabled: true,
      async execute(_context: AiCapabilityContext, input: unknown) {
        assertNoSecrets(input)
        const raw = (input ?? {}) as Record<string, unknown>
        const id = typeof raw.id === 'number' ? raw.id : undefined
        if (id === undefined) throw new Error('缺少目标用户 ID，请先查询确认用户后再预填')
        // 读一次目标用户，确认它落在当前用户的数据范围内；同时把未提及的现有值带进预填。
        const existing = await UserService.getUserById(id)
        if (!existing) throw new Error(`用户 ${id} 不存在或不在你的数据范围内`)
        const fields = {
          id,
          realName: existing.realName,
          phone: existing.phone,
          ...pick(raw, USER_PREFILL_FIELDS),
        }
        return prefill(fields, missingFields(fields, USER_REQUIRED), 'user.update')
      },
    },
    {
      name: 'list_roles',
      description: '按关键词/状态分页查询系统角色。需要角色列表权限，角色配置不按用户数据范围过滤。',
      moduleId: SYSTEM_MODULE,
      operationId: 'adminRolesList',
      permissionCode: 'system:role:list',
      inputSchema: RoleListQuerySchema,
      riskLevel: 'read',
      enabled: true,
      async execute(_context: AiCapabilityContext, input: unknown) {
        const query = input as RoleListQuery
        const result = await RoleService.getRoleList({ ...query, ...page(query) })
        // 列表态的 mapper 本就不返回 permissionCodes，这里再明确剔除，防止后续 mapper 变更把授权面带进模型上下文。
        const trimmed = { ...result, list: result.list.map(({ menuIds: _m, appMenuIds: _a, permissionCodes: _p, ...rest }) => rest) }
        return listResult(trimmed, 'role.table')
      },
    },
    {
      name: 'get_role',
      description: '按 ID 读取单个角色详情，包含其数据范围档位与授权的权限码。需要角色列表权限。',
      moduleId: SYSTEM_MODULE,
      operationId: 'adminRolesDetail',
      permissionCode: 'system:role:list',
      inputSchema: IdInput,
      riskLevel: 'read',
      enabled: true,
      async execute(_context: AiCapabilityContext, input: unknown) {
        const { id } = input as Static<typeof IdInput>
        const role = await RoleService.getRoleById(id)
        if (!role) throw new Error(`角色 ${id} 不存在或不在你的数据范围内`)
        const data = { role }
        return { data, render: { kind: 'role.detail', payload: data }, mutated: false } satisfies AiCapabilityResult
      },
    },
    {
      name: 'list_departments',
      description: '按关键词/上级部门分页查询部门。需要部门列表权限，当前部门配置不按用户数据范围过滤。',
      moduleId: SYSTEM_MODULE,
      operationId: 'adminDepartmentsList',
      permissionCode: 'system:department:list',
      inputSchema: DeptListQuerySchema,
      riskLevel: 'read',
      enabled: true,
      async execute(_context: AiCapabilityContext, input: unknown) {
        const query = input as DeptListQuery
        return listResult(await DeptService.getDeptList({ ...query, ...page(query) }), 'department.table')
      },
    },
    {
      name: 'get_department',
      description: '按 ID 读取单个部门详情（含上级部门名称）。',
      moduleId: SYSTEM_MODULE,
      operationId: 'adminDepartmentsDetail',
      permissionCode: 'system:department:list',
      inputSchema: IdInput,
      riskLevel: 'read',
      enabled: true,
      async execute(_context: AiCapabilityContext, input: unknown) {
        const { id } = input as Static<typeof IdInput>
        const department = await DeptService.getDeptById(id)
        if (!department) throw new Error(`部门 ${id} 不存在`)
        const data = { department }
        return { data, render: { kind: 'department.detail', payload: data }, mutated: false } satisfies AiCapabilityResult
      },
    },
    {
      name: 'prepare_create_department',
      description: '抽取部门字段并预填到「新增部门」表单。**不会创建部门**。缺少部门名时应追问用户。',
      moduleId: SYSTEM_MODULE,
      operationId: 'adminDepartmentsCreate',
      permissionCode: 'system:department:create',
      inputSchema: Type.Object({
        name: Type.Optional(Type.String({ description: '部门名称' })),
        parentId: Type.Optional(Type.Integer({ description: '上级部门 ID' })),
        status: Type.Optional(Type.Union([Type.Literal('0'), Type.Literal('1')], { description: '0-停用 1-正常' })),
        sortOrder: Type.Optional(Type.Integer()),
        description: Type.Optional(Type.String()),
        leaderId: Type.Optional(Type.Integer({ description: '负责人用户 ID' })),
      }, { additionalProperties: false }),
      riskLevel: 'prepare',
      enabled: true,
      async execute(_context: AiCapabilityContext, input: unknown) {
        assertNoSecrets(input)
        const fields = pick((input ?? {}) as Record<string, unknown>, DEPT_PREFILL_FIELDS)
        return prefill(fields, missingFields(fields, DEPT_REQUIRED), 'department.create')
      },
    },
  )
}
