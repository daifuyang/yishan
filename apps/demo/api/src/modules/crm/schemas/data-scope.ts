/**
 * CRM DataScope —— 最小可用的数据权限判定。
 *
 * Yishan Core 当前已有 sys_role.dataScope 字段，但**尚未在 Repository / Service 层落地**
 * 自动按 role.dataScope 改写 SQL。本文件为 CRM 提供一个明确的、可独立测试的
 * "我能看到哪些客户"判定，未来由 core 抽取为通用能力。
 *
 * 现状：CRM 内部按 currentUser 的 roleCodes + deptIds + id 直接计算数据范围。
 *
 * 规则：
 *   - super_admin          → ALL：所有数据
 *   - 默认                 → SELF_AND_COLLABORATION：owner_user_id = me，或我是该客户的协同人
 *
 * 显式开启 "部门可见" 的角色（role.code === 'sales_lead'，由 demo 约定）：
 *   - sales_lead           → DEPARTMENT：owner_department_id ∈ currentUser.deptIds
 *
 * 业务侧：
 *   - 公海客户（poolStatus = public）所有人可见。
 *
 * 暴露：
 *   - `computeDataScope(currentUser)` 返回一个 { ownerUserIds, ownerDepartmentIds,
 *     collaboratorUserId } 对象，传给 CustomerRepository.list 的查询参数。
 */

export type DataScope = 'SELF' | 'SELF_AND_COLLABORATION' | 'DEPARTMENT' | 'ALL'

export interface ScopeContext {
  ownerUserIds: number[] | null
  ownerDepartmentIds: number[] | null
  /**
   * 非 null 时，"我是协同人的客户" 也纳入可见范围（与 owner / dept 条件 OR）。
   * super_admin 为 null —— 它本来就不过滤，再加一个 EXISTS 只会拖慢查询。
   */
  collaboratorUserId: number | null
}

export interface DataScopeUser {
  id: number
  roleCodes?: string[]
  deptIds?: number[]
}

export function computeDataScope(user: DataScopeUser): ScopeContext {
  const roleCodes = user.roleCodes ?? []
  const deptIds = user.deptIds ?? []

  if (roleCodes.includes('super_admin')) {
    // ALL：ownerUserIds/ownerDepartmentIds 都传 null，repository 的 where 退化为"不过滤"
    return { ownerUserIds: null, ownerDepartmentIds: null, collaboratorUserId: null }
  }

  // 销售主管：DEPARTMENT（部门内所有客户）+ 自己协同的客户
  if (roleCodes.includes('sales_lead') && deptIds.length > 0) {
    return {
      ownerUserIds: [user.id],
      ownerDepartmentIds: deptIds,
      collaboratorUserId: user.id,
    }
  }

  // 普通销售：SELF_AND_COLLABORATION（自己的 + 自己协同的 + 公海）
  return {
    ownerUserIds: [user.id],
    ownerDepartmentIds: null,
    collaboratorUserId: user.id,
  }
}

export function dataScopeLabel(scope: DataScope): string {
  switch (scope) {
    case 'SELF':
      return '仅自己'
    case 'SELF_AND_COLLABORATION':
      return '自己及协同'
    case 'DEPARTMENT':
      return '本部门'
    case 'ALL':
      return '全部'
  }
}
