/**
 * user-creation-policy.ts — 用户创建的**唯一**授权规则集。
 *
 * 这份规则是同源的：`UserService.createUser`（普通后台新增用户）与后续 AI 助手的
 * 草稿工具走同一个 `validateUserCreation`，不允许任何一条路径自带一份「宽松版本」。
 *
 * 三条规则（已由用户确认，见设计文档 §8）：
 *
 * 1. **角色**：非超管只能分配「权限码 ⊆ 操作者本次请求有效权限」的角色；并且对每个
 *    带数据范围的操作，被授予范围必须被操作者该操作的范围包含。
 * 2. **组合**：比较的是**所选角色组合**授予目标用户的范围，不是逐个角色分别比。
 *    两个窄角色叠在一起可能宽过一个角色，因此只能整体算。
 * 3. **部门**：可选部门由 `system:user:create` 的现有范围解析给出。全范围可省略；
 *    任何受限范围至少选一个且全部在范围内；「仅本人」禁止创建。候选部门必须真实
 *    存在且启用。
 *
 * 三条实现约束：
 *
 * - **服务端重载**：操作者的角色、部门、有效权限每次检查都重新读库，绝不接受模型
 *   或客户端传入。权限加载用 `ttlMs: 0` 关闭 30 秒缓存（现有能力，不新增旁路），
 *   否则一个刚被回收权限的角色还能在缓存窗口内继续授权。
 * - **只经 repository 读库**，Service 层不碰 `drizzleDb`。
 * - **无法证明包含关系就拒绝**。「仅本人」的主体是 actor 自己：新用户的 ID 尚未
 *   生成，因此目标侧的「仅本人」不可能落在操作者范围内 —— 这里用一个不可能与任何
 *   真实 userId 相等的哨兵来表达，绝不因为「ID 还不存在」就退化成无限制。
 */
import { PERMISSION_CODES } from '@yishan/core-api/permissions/catalog'
import { UserErrorCode } from '@yishan/core-api/business-codes/user'
import { BusinessError } from '@yishan/core-api/errors'
import type { AppQueryDb } from '@/db'
import { drizzleDb } from '@/db'
import { ROLE_CODES } from '@/constants/permission-codes.js'
import { resolveDataScope, type DataScopeFilter, type DataScopeSubject } from '@/core/auth/data-scope'
import { computeEffectivePerms, SUPER_ADMIN_BYPASS } from '@/core/auth/effective-permissions'
import { PermissionRepository } from '@/core/repositories/permission.repository'
import { UserRepository } from '@/core/repositories/user.repository'
import { DeptRepository } from '@/core/repositories/dept.repository'
import { PermissionService } from '@/core/services/permission.service'
import type { UserCreateDraftFields } from '@/core/schemas/user'

/** 创建用户对应的权限码：范围解析与「操作者有没有这个操作」都以它为准。 */
export const USER_CREATE_PERMISSION = 'system:user:create'

/**
 * 目标用户在创建瞬间的「主体 ID」。
 *
 * 创建时新用户还没有 ID，而 `DATA_SCOPE_SELF` 的语义是「主体自身的行」。用一个
 * 不可能与任何真实 userId 相等的负数表达「这个主体还不存在」：解析结果是
 * `selfUserId = -1`，包含判定必然失败 —— 不会因为 ID 缺失而被当成无限制。
 */
const PENDING_TARGET_USER_ID = -1

/** 助手与后台都能表达的身份输入。角色/部门/权限一律由服务端重载，不接受传入。 */
export type UserCreationSubject = {
  actorId: number;
  /** PAT 授权的权限码；JWT/cookie 路径为 undefined。 */
  tokenScope?: readonly string[];
};

export interface ValidateUserCreationOptions {
  /** 注入 db（测试用）；生产路径走默认的 `drizzleDb`。 */
  db?: AppQueryDb;
}

function forbidden(reason: string): never {
  throw new BusinessError(UserErrorCode.USER_CREATE_FORBIDDEN, reason)
}

function uniq(values: readonly number[] | undefined): number[] {
  return [...new Set((values ?? []).map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0))]
}

/**
 * `operator` 的范围是否真的包含 `target` 的范围。
 *
 * 两条 fail closed：
 *   - 操作者受限而目标全范围 → 不包含（操作者永远不能授予「全部数据」）。
 *   - 目标带「仅本人」且该主体不是操作者本人 → 不包含。创建场景下目标主体恒为
 *     待创建用户，因此这条几乎总是拒绝 —— 这正是「仅本人不能建号」的含义。
 */
function scopeContains(operator: DataScopeFilter, target: DataScopeFilter, actorId: number): boolean {
  if (operator.kind === 'all') return true
  if (target.kind === 'all') return false
  if (target.selfUserId !== null && target.selfUserId !== actorId) return false
  const operatorDepts = new Set(operator.deptIds)
  return target.deptIds.every((deptId) => operatorDepts.has(deptId))
}

/** 解析操作者在某项操作下的范围。 */
function operatorScope(
  subject: UserCreationSubject,
  roleIds: number[],
  deptIds: number[],
  permissionCode: string,
  db: AppQueryDb,
): Promise<DataScopeFilter> {
  const actor: DataScopeSubject = {
    userId: subject.actorId,
    roleIds,
    deptIds,
    // 超管已在上游短路返回；这里显式 false，避免范围解析内部再算一次超管。
    superAdmin: false,
    tokenScope: subject.tokenScope ? [...subject.tokenScope] : undefined,
    permissionCode,
  }
  return resolveDataScope(actor, db)
}

/** 解析「所选角色组合 + 拟关联部门」实际授予目标用户的范围。 */
function targetScope(
  roleIds: number[],
  deptIds: number[],
  permissionCode: string,
  db: AppQueryDb,
): Promise<DataScopeFilter> {
  const target: DataScopeSubject = {
    userId: PENDING_TARGET_USER_ID,
    roleIds,
    deptIds,
    superAdmin: false,
    tokenScope: undefined,
    permissionCode,
  }
  return resolveDataScope(target, db)
}

/**
 * 操作者侧的重载结果。
 *
 * 单独抽出来是因为「候选查询」也需要同一份身份：`validateUserCreation` 与
 * `resolveCreatableDeptScope` 必须看到完全相同的角色/部门/权限，否则候选列表会和
 * 最终校验对不上。两处各算一次就等于出现了两份授权推导。
 */
interface ActorReloaded {
  actorRoleIds: number[]
  actorDeptIds: number[]
  actorPerms: Set<string>
}

async function reloadActor(subject: UserCreationSubject, db: AppQueryDb): Promise<ActorReloaded> {
  const actorRoleIds = await PermissionRepository.loadActiveRoleIdsByUserId(subject.actorId, db)
  const actorDeptIds = await UserRepository.loadActiveDeptIdsByUserId(subject.actorId, db)
  // ttlMs: 0 —— 授权判定必须看到最新权限，30 秒缓存窗口会让刚被回收的权限继续生效。
  // db 一并透传：注入事务级句柄时，权限与范围必须读同一份数据，判定才可复现。
  const { perms: actorRolePerms } = await PermissionService.loadForRoleIds(actorRoleIds, { ttlMs: 0, db })
  const actorPerms = computeEffectivePerms(actorRolePerms, subject.tokenScope, PERMISSION_CODES)
  return { actorRoleIds, actorDeptIds, actorPerms }
}

/**
 * 操作者在「新增用户」这一项上的数据范围，以及他到底能不能建号。
 *
 * 这是候选部门列表的**唯一**来源：`listCandidates` 用它裁剪部门树，而不是用调用方
 * 已经声明的 `deptIds`（那等于让客户端自己告诉我哪些部门合法）。
 *
 * `creatable` 只在「确实建不了」时为 false —— 受限范围但有授权部门（`deptIds` 非空）
 * 是**能**建号的，只是必须先选部门；`all` 范围当然也能。fail closed 的判据是
 * `restricted` 且授权部门为空集：那时新用户无处安放，「仅本人」范围正是如此。
 */
export interface CreatableDeptScope {
  scope: DataScopeFilter
  creatable: boolean
}

export async function resolveCreatableDeptScope(
  subject: UserCreationSubject,
  options: ValidateUserCreationOptions = {},
): Promise<CreatableDeptScope> {
  const db = options.db ?? drizzleDb
  const actor = await reloadActor(subject, db)

  if (actor.actorPerms.has(SUPER_ADMIN_BYPASS)) return { scope: { kind: 'all' }, creatable: true }
  if (!actor.actorPerms.has(USER_CREATE_PERMISSION)) {
    forbidden('你没有新增用户的权限')
  }

  const scope = await operatorScope(
    subject,
    actor.actorRoleIds,
    actor.actorDeptIds,
    USER_CREATE_PERMISSION,
    db,
  )
  const creatable = scope.kind === 'all' || scope.deptIds.length > 0
  return { scope, creatable }
}

/**
 * 校验一次用户创建。抛 `BusinessError(USER_CREATE_FORBIDDEN)` 表示拒绝。
 *
 * 传入的 `fields` 只是「想怎么建」，操作者身份完全由 `subject.actorId` + 服务端
 * 重载决定：模型无法通过多传 roleIds / deptIds 抬高自己的权限。
 */
export async function validateUserCreation(
  subject: UserCreationSubject,
  // **只有 roleIds / deptIds 参与授权判定**，其余键（手机号、密码、昵称…）在这里
  // 完全不被读取、也不被校验 —— 别把它当成一次业务校验来读：手机号格式、密码强度等
  // 由 `CreateUserReqSchema` 与 createUser 负责。之所以接受 Partial，是因为候选查询
  // 在还不知道手机号时就要用同一套规则判定。
  fields: Partial<UserCreateDraftFields>,
  options: ValidateUserCreationOptions = {},
): Promise<void> {
  const db = options.db ?? drizzleDb
  const requestedRoleIds = uniq(fields.roleIds)
  const requestedDeptIds = uniq(fields.deptIds)

  // ---- 操作者身份：全部服务端重载 ------------------------------------------
  const { actorRoleIds, actorDeptIds, actorPerms } = await reloadActor(subject, db)

  // 超管（按**本次请求**的有效权限判定，PAT 收窄在内）可以分配任何角色与部门。
  if (actorPerms.has(SUPER_ADMIN_BYPASS)) return

  if (!actorPerms.has(USER_CREATE_PERMISSION)) {
    forbidden('你没有新增用户的权限')
  }

  // ---- 规则 1/2：角色组合的权限码 ------------------------------------------
  // 逐角色取权限码再合并：合并后的集合就是「组合授予什么」。禁用/已删角色不在
  // 矩阵里，权限回收后也不在其中 —— 两者都不会再授权。
  const candidateMatrix = await PermissionRepository.loadPermissionsByRole(requestedRoleIds, db)
  const candidatePerms = new Set<string>()
  for (const entry of candidateMatrix.values()) {
    if (entry.code === ROLE_CODES.SUPER_ADMIN) candidatePerms.add(SUPER_ADMIN_BYPASS)
    for (const code of entry.perms) candidatePerms.add(code)
  }

  for (const code of candidatePerms) {
    if (code === SUPER_ADMIN_BYPASS) {
      forbidden('只有超级管理员才能分配超级管理员角色')
    }
    if (!actorPerms.has(code)) {
      forbidden(`所选角色包含你没有的权限：${code}`)
    }
  }

  // ---- 规则 3：逐操作比较范围（按组合，而不是按单个角色）-------------------
  for (const code of candidatePerms) {
    const [operator, target] = await Promise.all([
      operatorScope(subject, actorRoleIds, actorDeptIds, code, db),
      targetScope(requestedRoleIds, requestedDeptIds, code, db),
    ])
    if (!scopeContains(operator, target, subject.actorId)) {
      forbidden(`所选角色组合在「${code}」上授予的数据范围超出了你的范围`)
    }
  }

  // ---- 规则 3：部门关联 -----------------------------------------------------
  const creatable = await operatorScope(subject, actorRoleIds, actorDeptIds, USER_CREATE_PERMISSION, db)
  if (creatable.kind !== 'all') {
    if (requestedDeptIds.length === 0) {
      // 受限范围（含「仅本人」）下不选部门就是建一个谁都看不到、也无处安放的用户。
      forbidden('你的数据范围受限，新增用户必须选择归属部门')
    }
    const allowed = new Set(creatable.deptIds)
    for (const deptId of requestedDeptIds) {
      if (!allowed.has(deptId)) {
        forbidden(`部门 ${deptId} 不在你的数据范围内`)
      }
    }
  }

  // 范围算的是 ID 集合；停用/软删的部门 ID 仍可能落在集合里，所以还要确认它可用。
  const existingDeptIds = await DeptRepository.findEnabledIdsByIds(requestedDeptIds, db)
  if (existingDeptIds.length !== requestedDeptIds.length) {
    forbidden('选择的部门不存在或已被停用')
  }
}
