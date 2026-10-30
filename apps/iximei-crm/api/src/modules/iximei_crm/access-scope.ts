/**
 * crm 模块自己的行级数据权限档位。
 *
 * ## 为什么不直接用 `@yishan/core-system-api` 的 `DATA_SCOPE_*`
 *
 * 两套编号**数值含义不同**：
 *
 * | 值 | 本 fork（线上 sys_role.data_scope 实际存的就是这套） | 上游 system-api |
 * |---|---|---|
 * | 1 | ALL | ALL |
 * | 2 | CUSTOM | DEPT |
 * | 3 | DEPT | DEPT_AND_CHILD |
 * | 4 | DEPT_AND_CHILDREN | SELF |
 * | 5 | SELF | CUSTOM |
 *
 * 线上库 794 个账号的角色档位是按左列写入的。若直接消费上游枚举，
 * 原本「仅本人(5)」会被读成「自定义(5)」，「本部门及子部门(4)」被读成「仅本人(4)」——
 * 是**静默的权限错配**，不会报错。
 *
 * 因此 crm 的业务可见性保持在业务模块内定义，与上游 `resolveDataScope` 解耦：
 * 上游那套只作用于 `sys_user` 等系统实体，不作用于 `crm_*` 表。
 * 将来若要统一，必须先做一次 data_scope 数值迁移，再删掉本文件。
 */
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@yishan/core-system-api/database'
import { sysRole } from '@yishan/core-system-api/schema'
import { currentDataScope } from '@yishan/core-system-api'

export const DATA_SCOPE = {
  /** 全部数据（无过滤） */
  ALL: 1,
  /** 自定义数据：由 sys_role_dept 指定可访问部门 */
  CUSTOM: 2,
  /** 本部门数据 */
  DEPT: 3,
  /** 本部门及子部门数据 */
  DEPT_AND_CHILDREN: 4,
  /** 仅本人数据 */
  SELF: 5,
} as const

export type DataScopeCode = (typeof DATA_SCOPE)[keyof typeof DATA_SCOPE]

/**
 * 计算当前请求对 crm 业务的可见范围。
 *
 * 规则与旧基座的 `resolveEffectiveDataScope` 保持一致：
 *   - 持有超管哨兵 → ALL
 *   - 任一启用角色的 data_scope = 1 → ALL
 *   - 其余（含部门 / 自定义档位）一律收敛为 SELF
 *
 * 最后一条是**保守收敛**而不是遗漏：crm 的 Repository 没有实现部门集合过滤，
 * 把未实现的档位当成 ALL 等于放开全量数据。
 */
export async function currentCrmDataScope(db: AppQueryDb = drizzleDb): Promise<DataScopeCode> {
  const subject = currentDataScope()
  if (subject?.superAdmin) return DATA_SCOPE.ALL
  const roleIds = [...new Set(subject?.roleIds ?? [])].filter(id => Number.isFinite(id) && id > 0)
  if (roleIds.length === 0) return DATA_SCOPE.SELF
  const rows = await db
    .select({ dataScope: sysRole.dataScope })
    .from(sysRole)
    .where(and(inArray(sysRole.id, roleIds), isNull(sysRole.deletedAt), eq(sysRole.status, 1)))
  return rows.some(row => row.dataScope === DATA_SCOPE.ALL) ? DATA_SCOPE.ALL : DATA_SCOPE.SELF
}
