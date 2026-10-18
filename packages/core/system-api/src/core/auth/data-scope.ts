/**
 * data-scope.ts — 行级数据权限（sys_role.data_scope）的解析与应用。
 *
 * 此前 `data_scope` 可写、可展示（RoleForm 的 DATA_SCOPE_OPTIONS、列表页的
 * DataScopeTag），但全系统没有任何查询读取它：任何持有 `system:user:list` 的人
 * 都能看到全部未删除用户。本文件补上这条缺失的执行链。
 *
 * ## 档位编号
 *
 * 编号沿用**本仓库既有约定**（`packages/core/system-admin/src/pages/role/index.tsx`
 * 的 DATA_SCOPE_OPTIONS，以及 `SysRoleSchema.dataScope` 的枚举），不是照抄 RuoYi 的
 * 常量定义：
 *
 *   1 全部数据 / 2 本部门 / 3 本部门及子部门 / 4 仅本人 / 5 自定义
 *
 * 语义对齐 RuoYi 的 `@DataScope` 五档，但本仓库是显式的范围对象而不是切面注入的
 * SQL 片段——业务代码不写过滤，过滤在共用 repository 层合成，因此 `list` / `count` /
 * 详情读同范围。
 *
 * ## 合并语义（关键，且此前是错的）
 *
 * 早期实现按「档位宽度取最宽」合并，这有两处硬伤：
 *   1. 一个与本次操作无关的角色的「全部数据」会放大所有操作的范围；
 *   2. 「取最宽」会在存在部门档位时把「仅本人」整条丢掉。
 *
 * 正确表达只有两种：
 *   - `all`（某个**授予本次操作权限**的启用角色是全部数据）
 *   - `restricted` = 授权部门集合 ∪ 本人
 *
 * 因此 DataScopeFilter 不再是「三选一」，而是 all / (deptIds, selfUserId) 二选一。
 *
 * ## 覆盖范围（有意为之，不是遗漏）
 *
 * | 实体 | 归属维度 | 处理 |
 * |---|---|---|
 * | `sys_user` | `sys_user_dept` | ✅ `userDataScopeCondition`（exists 子查询） |
 * | `sys_login_log` | `user_id` | ✅ `userIdInScopeCondition`（IN 子查询） |
 * | `sys_dept` | — | ❌ 见下 |
 * | `sys_role` / `sys_post` / `sys_attachment` | 仅 `creator_id` | ❌ 见下 |
 * | `sys_menu` / `sys_dict_*` / `sys_enum` | 仅 `creator_id` | ❌ 见下 |
 * | `sys_region` / `sys_module` / `sys_*_menu` 关联表 | 无 | ❌ 不加过滤 |
 *
 * 「不加过滤」的理由分三类，都不是省事：
 *   - **`sys_dept`**：当前部门管理按接口权限控制，尚未定义业务行级范围。
 *     内部计算子树使用独立查询，不依赖部门管理接口；这不要求业务接口全量开放。
 *   - **`sys_role` / `sys_menu` / `sys_dict_*` / `sys_enum`**：它们是系统配置，
 *     非超管也必须能读到（角色选择框、状态标签、下拉框全靠它们）。限制成「仅创建人」
 *     会让所有普通管理员看到空列表——那不是收紧，是把功能改坏。
 *   - **`sys_post` / `sys_attachment`**：本仓库这两张表**没有 dept 列**，无法直接构造
 *     部门类档位。在没有明确归属规则的
 *     情况下按「仅创建人」降级是凭空发明的规则，已撤掉；这是待确认的产品规则，
 *     见交付说明。
 *
 * 后续若引入行级归属，先确定业务规则；可以使用归属部门或可靠的关联实体，
 * 需要新增字段时再配迁移，不默认把创建人等同于归属人。
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { and, eq, inArray, isNull, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm'
import { PERMISSION_CODES } from '@yishan/core-api/permissions/catalog'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysDept, sysRole, sysRoleDept, sysUser, sysUserDept } from '@/db/schema'
import { PermissionRepository } from '@/core/repositories/permission.repository'
import { ROLE_CODES } from '@/constants/permission-codes.js'
import { computeEffectivePerms, SUPER_ADMIN_BYPASS } from '@/core/auth/effective-permissions'

export const DATA_SCOPE_ALL = 1
export const DATA_SCOPE_DEPT = 2
export const DATA_SCOPE_DEPT_AND_CHILD = 3
export const DATA_SCOPE_SELF = 4
export const DATA_SCOPE_CUSTOM = 5

/**
 * 归一化后的范围。
 *
 * - `all`：不施加任何行级过滤。
 * - `restricted`：**授权部门集合 OR 本人**。两者可以同时为空，此时不返回任何行
 *   （而不是回退到「本人」——回退等于凭空授权）。
 */
export type DataScopeFilter =
  | { kind: 'all' }
  | { kind: 'restricted'; deptIds: number[]; selfUserId: number | null }

/** 请求级的身份输入。AI 能力同样走这里——AI 不得自行指定 actorId。 */
export interface DataScopeSubject {
  userId: number
  roleIds: number[]
  deptIds: number[]
  /** 本次请求的有效权限里持有 `__super_admin__` 哨兵（须已与 PAT scope 求交） */
  superAdmin: boolean
  /** PAT 授权的权限码；JWT/cookie 路径为 undefined。 */
  tokenScope?: string[]
  /**
   * 本次操作对应的权限码。
   *
   * 只有**授予该权限码**的角色才参与本次范围计算。这条是「无关角色的全部数据
   * 不能扩大当前操作范围」的唯一实现点。
   */
  permissionCode?: string
}

const scope = new AsyncLocalStorage<DataScopeSubject>()
const bypass = new AsyncLocalStorage<boolean>()

/** 在给定身份下执行。repository 层据此施加行级过滤。 */
export function runWithDataScope<T>(subject: DataScopeSubject, fn: () => T): T {
  // 内层建立的身份必然重置外层的免过滤标记，否则「免过滤里又建了个上下文」
  // 仍然读不到 subject，等于静默 fail closed 到查不到数据。
  return scope.run(subject, () => bypass.run(false, fn))
}

/**
 * 显式的免过滤路径。
 *
 * 只用于确实不受行级限制的操作：登录时解析当前用户自己、权限解析、读角色自身
 * 档位与部门树、seed/定时任务。业务查询**不得**使用它——需要跳过过滤时应在
 * Service 层给出可读的开关（如 `enforceScope=false`）并说明理由。
 */
export function runWithoutDataScope<T>(fn: () => T): T {
  return bypass.run(true, fn)
}

/** 当前是否处于显式免过滤路径。 */
export function isDataScopeBypassed(): boolean {
  return bypass.getStore() === true
}

/** 当前请求身份；不在请求上下文（或显式免过滤）时返回 null。 */
export function currentDataScope(): DataScopeSubject | null {
  if (isDataScopeBypassed()) return null
  return scope.getStore() ?? null
}

/**
 * 收集给定部门及其所有后代的 id。
 *
 * 走未加 dataScope 过滤的查询：若在这里也过滤，被过滤掉的祖先会让子树算不完整，
 * 得到比授权更窄的范围（甚至把自己锁在空集里）。这是免过滤路径，理由在此。
 */
async function collectDeptSubtree(deptIds: readonly number[], db: AppQueryDb): Promise<number[]> {
  if (deptIds.length === 0) return []
  const rows = await db
    .select({ id: sysDept.id, parentId: sysDept.parentId })
    .from(sysDept)
    .where(isNull(sysDept.deletedAt))

  const childrenOf = new Map<number, number[]>()
  for (const row of rows) {
    if (row.parentId == null) continue
    const list = childrenOf.get(row.parentId) ?? []
    list.push(row.id)
    childrenOf.set(row.parentId, list)
  }

  const result = new Set<number>(deptIds)
  const queue = [...deptIds]
  while (queue.length > 0) {
    const current = queue.pop()!
    for (const child of childrenOf.get(current) ?? []) {
      if (result.has(child)) continue
      result.add(child)
      queue.push(child)
    }
  }
  return [...result]
}

/** 读角色自身的数据范围档位（免过滤）。禁用 / 已删除的角色不参与授权。 */
async function loadRoleScopes(roleIds: readonly number[], db: AppQueryDb) {
  if (roleIds.length === 0) return []
  return db
    .select({ id: sysRole.id, dataScope: sysRole.dataScope })
    .from(sysRole)
    .where(and(inArray(sysRole.id, [...roleIds]), isNull(sysRole.deletedAt), eq(sysRole.status, 1)))
}

/** 读角色的自定义部门（免过滤）。 */
async function loadCustomDeptIds(roleIds: readonly number[], db: AppQueryDb): Promise<number[]> {
  if (roleIds.length === 0) return []
  const rows = await db
    .select({ deptId: sysRoleDept.deptId })
    .from(sysRoleDept)
    .where(and(inArray(sysRoleDept.roleId, [...roleIds]), isNull(sysRoleDept.deletedAt)))
  return [...new Set(rows.map((r) => r.deptId))]
}

/**
 * 只保留「授予本次操作权限」的角色。
 *
 * 逐角色算有效权限（而不是先合并再判断），否则一个与本次操作无关的角色的
 * 「全部数据权限」会顺带放大这次操作的可见范围。PAT scope 在这里同样生效：
 * 范围只能收窄，不能比垂直权限更宽。
 */
async function filterRolesByPermission(
  roles: readonly { id: number }[],
  permissionCode: string | undefined,
  tokenScope: readonly string[] | undefined,
  db: AppQueryDb,
): Promise<Set<number>> {
  if (!permissionCode) return new Set(roles.map((role) => role.id))
  const matrix = await PermissionRepository.loadPermissionsByRole(roleIds(roles), db)
  const granted = new Set<number>()
  for (const role of roles) {
    const entry = matrix.get(role.id)
    if (!entry) continue
    const perms = new Set(entry.perms)
    // 角色 code = super_admin 时同样授予超管哨兵，与 PermissionService 保持一致。
    if (entry.code === ROLE_CODES.SUPER_ADMIN) perms.add(SUPER_ADMIN_BYPASS)
    const effective = computeEffectivePerms(perms, tokenScope, PERMISSION_CODES)
    if (effective.has(SUPER_ADMIN_BYPASS) || effective.has(permissionCode)) granted.add(role.id)
  }
  return granted
}

function roleIds(roles: readonly { id: number }[]): number[] {
  return roles.map((role) => role.id)
}

/**
 * 解析当前请求的行级范围。
 *
 * fail closed：没有匹配授权角色、档位读不出来、部门解析不出——都只会让范围更窄，
 * 不会更宽。唯一的「放开」是某个授予本次操作权限的启用角色为全部数据权限，
 * 或请求本身带超管哨兵。
 */
export async function resolveDataScope(
  subject: DataScopeSubject,
  db: AppQueryDb = drizzleDb,
): Promise<DataScopeFilter> {
  if (subject.superAdmin) return { kind: 'all' }

  const roleIdList = [...new Set(subject.roleIds ?? [])]
  const roles = await loadRoleScopes(roleIdList, db)
  const granted = await filterRolesByPermission(roles, subject.permissionCode, subject.tokenScope, db)

  const deptIds = new Set<number>()
  let selfUserId: number | null = null

  for (const role of roles) {
    if (!granted.has(role.id)) continue
    switch (role.dataScope) {
      case DATA_SCOPE_ALL:
        return { kind: 'all' }
      case DATA_SCOPE_DEPT:
        for (const id of subject.deptIds ?? []) deptIds.add(id)
        break
      case DATA_SCOPE_DEPT_AND_CHILD:
        for (const id of await collectDeptSubtree(subject.deptIds ?? [], db)) deptIds.add(id)
        break
      case DATA_SCOPE_CUSTOM:
        for (const id of await loadCustomDeptIds([role.id], db)) deptIds.add(id)
        break
      case DATA_SCOPE_SELF:
        selfUserId = subject.userId
        break
      default:
        // 未登记的档位：忽略而不是猜。猜成 self 等于凭空授权，猜成 all 等于放开。
        break
    }
  }

  return { kind: 'restricted', deptIds: [...deptIds], selfUserId }
}

/** 恒假条件。缺上下文时用它 fail closed，而不是静默不加过滤。 */
function denyAll(): SQL {
  return sql`1 = 0`
}

/**
 * 把范围翻译成 `sys_user` 上的 SQL 条件。
 *
 * - `all` → undefined（不加条件），保持既有查询形状。
 * - `restricted` → `授权部门 OR 本人`；两者都没有 → 恒假。
 *
 * 用 `exists` 子查询匹配 sys_user_dept，不 join、不改写外层查询形状，因此对
 * list / count / findById 一样适用。
 */
export function userDataScopeCondition(filter: DataScopeFilter | null): SQL | undefined {
  if (!filter || filter.kind === 'all') return undefined
  const parts: SQL[] = []
  if (filter.selfUserId !== null) parts.push(eq(sysUser.id, filter.selfUserId))
  if (filter.deptIds.length > 0) {
    // Relational queries rewrite Column objects to the outer user alias, even inside SQL.
    // Identifiers keep the inner department-link columns attached to their own table.
    parts.push(sql`exists (
      select 1 from ${sysUserDept} as scope_dept
      where scope_dept.${sql.identifier(sysUserDept.userId.name)} = ${sysUser.id}
        and scope_dept.${sql.identifier(sysUserDept.deletedAt.name)} is null
        and ${inArray(sql`scope_dept.${sql.identifier(sysUserDept.deptId.name)}`, filter.deptIds)}
    )`)
  }
  if (parts.length === 0) return denyAll()
  return parts.length === 1 ? parts[0] : or(...parts)!
}

/**
 * 「范围内的用户 id」条件，供以 `user_id` 关联到用户的表使用
 * （sys_login_log、sys_api_token 等）。
 *
 * 返回 `col in (select ...)`——**不是** `= (select ...)`：范围由多行用户组成时
 * 标量比较在 MySQL 下会直接报错或退化成全表匹配。`all` 返回 undefined 表示不加条件，
 * 不能退化成空集，否则会被误当成「谁都没有」。
 */
export function userIdInScopeCondition(
  filter: DataScopeFilter | null,
  column: SQLWrapper,
): SQL | undefined {
  if (!filter || filter.kind === 'all') return undefined
  const condition = userDataScopeCondition(filter)
  if (!condition) return undefined
  return sql`${column} in (select ${sysUser.id} from ${sysUser} where ${condition})`
}

/**
 * 需要行级保护的查询在**缺少上下文**时的条件。
 *
 * - `enforceScope === false`：调用方显式声明这条路径不受行级限制（登录解析自己、
 *   刷新令牌等），返回 undefined。
 * - 显式免过滤路径（`runWithoutDataScope`）：返回 undefined。
 * - 其余情况缺上下文 → 恒假，fail closed。
 *
 * 刻意不抛错：登录接口、公开接口、seed 与定时任务都不在请求上下文里，全局抛错
 * 会把它们一起打死；恒假只影响真正需要范围保护的读取。
 */
export function scopedQueryCondition(
  subject: DataScopeSubject | null,
  filter: DataScopeFilter | null,
  enforceScope: boolean,
): SQL | undefined {
  if (!enforceScope) return undefined
  if (isDataScopeBypassed()) return undefined
  if (!subject) return denyAll()
  return userDataScopeCondition(filter)
}
