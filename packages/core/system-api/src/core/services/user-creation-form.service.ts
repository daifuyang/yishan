/**
 * user-creation-form.service.ts — 新增用户表单的**只读**元数据与候选查询。
 *
 * 这两个入口是「原生表单」与「AI 助手」共同的字段/候选来源。它们只做两件事：
 *
 *   1. `getCreateForm()`：从**真实**的 `CreateUserReqSchema` 派生字段约束，
 *      而不是维护第二份字段表。约束（长度、正则、枚举、格式）直接读 schema，
 *      因此表单改契约，这里自动跟着改。
 *   2. `listCandidates()`：列出本次请求**真的可以授予**的部门与角色。
 *
 * 三条不可放宽的约束：
 *
 * - **候选是过滤后的便利，不是授权授予**。每个角色都要走一遍 Task 2 的
 *   `validateUserCreation`（按候选 deptIds 重算），出现在列表里也不等于提交会被放行；
 *   最终提交仍会重新校验。
 * - **不返回可执行渲染代码**。只返回字段名/标签/必填/约束/敏感标记和一个
 *   **选择器标识**（指向既有候选端点），不返回组件、表达式或任意 schema 片段。
 * - **`password` 只作为「需要在表单完成」被标记**，不进入可编辑字段集，也不进草稿。
 */
import type { AppQueryDb } from '@/db'
import { DeptRepository } from '@/core/repositories/dept.repository'
import { RoleRepository } from '@/core/repositories/role.repository'
import { DeptService } from '@/core/services/dept.service'
import { formatOf } from '@/core/services/draft-field-format'
import {
  validateUserCreation,
  resolveCreatableDeptScope,
  type UserCreationSubject,
} from '@/core/services/user-creation-policy'
import { UserErrorCode } from '@yishan/core-api/business-codes/user'
import { BusinessError } from '@yishan/core-api/errors'
import {
  CreateUserReqSchema,
  USER_CREATE_DRAFT_FIELD_KEYS,
  type UserCreateOptionsQuery as UserCreateOptionsQueryContract,
} from '@/core/schemas/user'
import type { SysDeptResp } from '@/core/schemas/department'

/**
 * 表单契约版本。
 *
 * 模型可以把上次拿到的 `schemaVersion` 存进草稿；版本对不上时必须重新读取表单定义，
 * 不能拿旧字段名去提交。
 */
export const USER_CREATE_FORM_SCHEMA_VERSION = 1

/** 单次返回给调用方的候选角色上限，与既有列表接口一致。 */
const MAX_CANDIDATE_PAGE_SIZE = 100
const DEFAULT_CANDIDATE_PAGE_SIZE = 20

/**
 * 字段标签。
 *
 * 只覆盖「标签不是字段名」的字段；其余直接用字段名本身。这里刻意**不**引入
 * i18n key —— 表单元数据是给模型读的稳定标识，不是要翻译的界面文案。
 */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  username: '用户名',
  email: '邮箱',
  password: '初始密码',
  phone: '手机号',
  realName: '真实姓名',
  nickname: '昵称',
  avatar: '头像',
  gender: '性别',
  birthDate: '出生日期',
  status: '状态',
  deptIds: '归属部门',
  roleIds: '角色',
}

/**
 * 选择器标识：指向**既有**的候选来源，而不是新的渲染模型。
 *
 * - `deptTree` / `roleOptions` 由 `create-options` 提供；
 * - 枚举字段由 `create-form` 自带的 `constraints.enum` 提供；
 * - 其余是自由文本，由调用方按 `constraints` 校验。
 */
const SELECTORS: Readonly<Record<string, string>> = {
  deptIds: 'deptTree',
  roleIds: 'roleOptions',
  gender: 'enum',
  status: 'enum',
  birthDate: 'date',
  email: 'email',
  password: 'password',
}

/**
 * **不是表单字段**的 schema 属性，必须从模型可见的字段集里剔除。
 *
 * `draftSubmission` 是助手提交草稿时用的内部控制标记（Task 5/6 消费），
 * 它出现在 `CreateUserReqSchema.properties` 里只是因为提交请求复用了同一 schema。
 * 让它出现在 `fields` 里，模型就会去向用户索要一个叫 "draftSubmission" 的东西 ——
 * 和 password 一样，它属于协议而不是表单。
 */
const NON_FORM_FIELDS = new Set(['draftSubmission'])

/**
 * 只从 schema 里挑出「值得表达的约束」，不整体倒出 schema 对象。
 *
 * `format` 取**联合类型的成员格式**（`birthDate` 是
 * `Union([String({ format: 'date' }), Literal('')])`，顶层没有 `format`）。
 * 少了这一步，草稿侧的 `not_a_date` 校验就永远不会触发 ——
 * 一个写不出来的日期会以「看起来合法」的形状躺在草稿里。
 */
function deriveConstraints(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (Array.isArray(schema.enum)) out.enum = [...(schema.enum as unknown[])]
  const format = formatOf(schema)
  if (format) out.format = format
  if (typeof schema.minLength === 'number') out.minLength = schema.minLength
  if (typeof schema.maxLength === 'number') out.maxLength = schema.maxLength
  if (typeof schema.pattern === 'string') out.pattern = schema.pattern
  if (Array.isArray(schema.anyOf)) out.anyOf = [...(schema.anyOf as unknown[])]
  if (Array.isArray(schema.oneOf)) out.oneOf = [...(schema.oneOf as unknown[])]
  return out
}

export interface UserCreateFormField {
  name: string
  label: string
  required: boolean
  /** 密码等：只能由用户在受保护的表单里输入，不进对话。 */
  sensitive: boolean
  /** 只允许固定取值集合的选择器标识（见 SELECTORS 注释）。 */
  selector: string
  /** 来自真实 create schema 的约束子集。 */
  constraints: Record<string, unknown>
}

export interface UserCreateFormMissingField {
  name: string
  label: string
  required: boolean
  sensitive: boolean
  /** 必须由用户在表单里完成（敏感字段永远为 true）。 */
  mustCompleteInForm: true
}

export interface UserCreateForm {
  schemaVersion: number
  fields: UserCreateFormField[]
  defaults: Record<string, unknown>
  /** 对话可以写入的字段白名单（= USER_CREATE_DRAFT_FIELD_KEYS）。 */
  editableFields: string[]
  /** 真实表单里有、但对话不该收集的字段。 */
  missingFields: UserCreateFormMissingField[]
}

/**
 * 候选查询参数。
 *
 * 直接从 TypeBox schema 派生，而不是另写一份 interface —— 手写副本一旦和 schema
 * 漂移，路由声明的 query 与服务实际读取的 query 就会静默不一致。
 */
export type UserCreateOptionsQuery = UserCreateOptionsQueryContract

/** 部门候选树节点（结构 = 既有部门树节点；`getDeptTree()` 的静态返回类型没带 children）。 */
export type DeptCandidateNode = SysDeptResp & { children?: DeptCandidateNode[] | null }

export interface UserCreateOption {
  id: number
  name: string
}

export interface UserCreateOptions {
  departments: DeptCandidateNode[]
  /** 按候选 deptIds 用 Task 2 策略过滤后的角色，按 id 区分（名字可重名）。 */
  roles: UserCreateOption[]
  total: number
  page: number
  pageSize: number
  /** 操作者在 system:user:create 上的范围是否至少能建一个用户。 */
  creatable: boolean
}

export interface ListUserCreateOptions {
  /** 注入 db（测试 / 事务级句柄）；生产路径走默认的 `drizzleDb`。 */
  db?: AppQueryDb
}

/** 从真实 schema 派生字段元数据。纯函数，不读库，因此助手可零成本重复调用。 */
function buildForm(): UserCreateForm {
  const properties = CreateUserReqSchema.properties as Record<
    string,
    Record<string, unknown>
  >
  const required = new Set(
    ((CreateUserReqSchema as { required?: readonly string[] }).required ?? []) as readonly string[],
  )
  const draftKeys = new Set<string>(USER_CREATE_DRAFT_FIELD_KEYS)

  const fields: UserCreateFormField[] = Object.keys(properties)
    .filter((name) => !NON_FORM_FIELDS.has(name))
    .map((name) => {
      const schema = properties[name]
      const enumValues = Array.isArray(schema.enum) ? (schema.enum as unknown[]) : []
      return {
        name,
        label: FIELD_LABELS[name] ?? name,
        required: required.has(name),
        sensitive: name === 'password',
        selector: SELECTORS[name] ?? (enumValues.length > 0 ? 'enum' : 'text'),
        constraints: deriveConstraints(schema),
      }
    })

  // 默认值取自 schema 上真实声明的 default（CreateUserReqSchema 已刻意不带 default，
  // 这里读到的会是空对象 —— 保留读取逻辑是为了将来 schema 加了 default 时自动跟随）。
  const defaults: Record<string, unknown> = {}
  for (const [name, schema] of Object.entries(properties)) {
    if (NON_FORM_FIELDS.has(name)) continue
    if (schema.default !== undefined) defaults[name] = schema.default
  }

  const missingFields = fields
    .filter((field) => !draftKeys.has(field.name))
    .map((field) => ({
      name: field.name,
      label: field.label,
      required: field.required,
      sensitive: field.sensitive,
      mustCompleteInForm: true as const,
    }))

  return {
    schemaVersion: USER_CREATE_FORM_SCHEMA_VERSION,
    fields,
    defaults,
    editableFields: [...USER_CREATE_DRAFT_FIELD_KEYS],
    missingFields,
  }
}

/** 在原树上裁剪：只保留授权部门。祖先节点保留以维持树的形状，与部门管理一致。 */
function pruneDeptTree(nodes: DeptCandidateNode[], allowed: Set<number>): DeptCandidateNode[] {
  const out: DeptCandidateNode[] = []
  for (const node of nodes) {
    const children = node.children ? pruneDeptTree(node.children, allowed) : null
    if (allowed.has(node.id) || (children && children.length > 0)) {
      out.push({ ...node, children })
    }
  }
  return out
}

/** 收集树上全部节点 id（部门候选是集合判断，不是形状判断）。 */
function collectDeptIds(nodes: DeptCandidateNode[], into: Set<number>): Set<number> {
  for (const node of nodes) {
    into.add(node.id)
    if (node.children) collectDeptIds(node.children, into)
  }
  return into
}

export class UserCreationFormService {
  /** 表单字段定义。约束来自真实 schema，不含任何可执行渲染代码。 */
  static getCreateForm(): UserCreateForm {
    return buildForm()
  }

  /**
   * 列出本次请求可授予的部门与角色。
   *
   * 角色候选逐个走 `validateUserCreation`（用本次候选的 deptIds），因此 deptIds 变化
   * 会重算 —— 服务端没有第二套「候选过滤」逻辑可以和最终校验产生分歧。
   */
  static async listCandidates(
    subject: UserCreationSubject,
    query: UserCreateOptionsQuery = {},
    options: ListUserCreateOptions = {},
  ): Promise<UserCreateOptions> {
    const db = options.db
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(
      MAX_CANDIDATE_PAGE_SIZE,
      Math.max(1, query.pageSize ?? DEFAULT_CANDIDATE_PAGE_SIZE),
    )
    const deptIds = [...new Set((query.deptIds ?? []).filter((id) => Number.isFinite(id) && id > 0))]

    // ---- 部门：按操作者范围过滤后的既有部门树 ------------------------------
    const tree = await DeptService.getDeptTree()
    const allDeptIds = collectDeptIds(tree, new Set<number>())
    // 候选部门必须真实存在且启用（与提交时同一条规则）。
    const enabledDeptIds = await DeptRepository.findEnabledIdsByIds(deptIds, db)
    const scopedDeptIds = deptIds.filter((id) => enabledDeptIds.includes(id))
    /**
     * **有效**的点名集合。调用方点了名、但每个 id 都不存在或已停用（模型编的 id，
     * 或一份存着已停用部门的旧草稿）时，它在事实上就是「没有点名」：既不能拿
     * 空数组去探测角色（受限操作者会退回空角色列表），也不能因为集合为空就
     * 退化成「未点名」从而放出整棵授权部门树——那样会得到「部门有、角色无」的
     * 自相矛盾结果。两个消费者因此共用同一份「有效点名集合」。
     */
    const effectiveNamedDeptIds = deptIds.length && scopedDeptIds.length ? scopedDeptIds : []

    // 允许关联的部门集合由 Task 2 的策略解析，不是「调用方说了什么」。
    // 用调用方传入的 deptIds 当过滤条件，等于让客户端自己声明哪些部门合法。
    const { scope, creatable } = await resolveCreatableDeptScope(subject, { db })

    // 范围之外、没有调用方点名、或已停用/不存在的部门，一律不进候选：
    // 一个越权的部门出现在列表里就是信息泄漏，即使提交时会被拒绝。
    // 注意 all 范围时这里确实是整棵树 —— 这是有意的：操作者在 system:user:create 上
    // 的范围就是「全部部门」，候选集与授权集因此相等，而不是授权被放宽。
    // 刻意**不**再叠加 `system:department:list`：规格 §7 要求不为候选查询额外要求
    // 无关的完整配置管理权限；能建号但看不到部门表单才是产品级的功能损坏。
    // 角色探测用的部门集合。**调用方没点名部门时不能传空数组**：受限范围下
    // 「必须选一个归属部门」会让每一次探测都失败，候选因此恒为空，而能力描述里
    // 「空候选」被读成「你没有建号权限」——一个只差先选部门的操作者被告知无权建号
    // （data_scope=2 的部门管理员曾稳定复现）。探测问的是「这个角色能不能被授予」，
    // 而任何合法提交都必然落在操作者自己的授权部门内，因此未点名时用
    // `resolveCreatableDeptScope` 的同一份集合——授权来自策略，不是来自调用方。
    const authorizedProbeDeptIds =
      creatable && scope.kind !== 'all' ? scope.deptIds : []
    // 授权集合里仍可能含停用/软删部门，而 validateUserCreation 会因它们整体拒绝；
    // 先按「候选部门必须真实存在且启用」这条同一规则过滤一次。
    const liveAuthorizedDeptIds = authorizedProbeDeptIds.length
      ? (await DeptRepository.findEnabledIdsByIds(authorizedProbeDeptIds, db)).filter(id =>
          authorizedProbeDeptIds.includes(id),
        )
      : []
    const probeDeptIds = effectiveNamedDeptIds.length ? effectiveNamedDeptIds : liveAuthorizedDeptIds
    const allowedDeptIds = creatable
      ? scope.kind === 'all'
        ? allDeptIds
        : new Set(scope.deptIds.filter((id) => !effectiveNamedDeptIds.length || effectiveNamedDeptIds.includes(id)))
      : new Set<number>()
    const departments = pruneDeptTree(tree, allowedDeptIds)

    // ---- 角色：按候选 deptIds 重算 -----------------------------------------
    const rows = await RoleRepository.list({
      keyword: query.keyword,
      status: 1,
      pageSize: 0,
    })
    const allowed: UserCreateOption[] = []
    for (const row of rows) {
      try {
        await validateUserCreation(subject, { roleIds: [row.id], deptIds: probeDeptIds }, { db })
        allowed.push({ id: row.id, name: row.name })
      } catch (error) {
        if (!isCreateForbidden(error)) throw error
      }
    }

    const start = (page - 1) * pageSize
    return {
      departments,
      roles: allowed.slice(start, start + pageSize),
      total: allowed.length,
      page,
      pageSize,
      creatable,
    }
  }
}

function isCreateForbidden(error: unknown): boolean {
  return error instanceof BusinessError && error.code === UserErrorCode.USER_CREATE_FORBIDDEN
}
