/**
 * 内置角色 ID。
 *
 * 上游 `@yishan/core-system-api` 的 `ROLE_CODES` 是字符串码（super_admin / admin / normal_user），
 * 且 seed 用 `code` 幂等创建、**不固定 ID**。但本 fork 线上库的角色是按固定 ID 写入的
 * （1 超管 / 2 管理员 / 3 医院账号 / 4 客服），业务判断也一直按 ID 走。
 *
 * 换基座阶段保留这套 ID：数据库里存的就是它们，贸然改成字符串码需要同时迁移
 * `sys_role` / `sys_user_role` 与 794 个账号的绑定关系，风险远大于收益。
 *
 * 待办：上游库若按 code 重建角色，这里要换成 code 解析 + 数字兜底。
 */
export const ROLE_IDS = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  /** 医院管理：医院相关账号，拥有医院派单查看的权限 */
  HOSPITAL_ACCOUNT: 3,
  /** 客服管理：客户和派单权限 */
  CUSTOMER_SERVICE: 4,
} as const

export type RoleId = typeof ROLE_IDS[keyof typeof ROLE_IDS]

/**
 * crm 自己的两个行业角色。
 *
 * 上游 `seedSystem` 只建 super_admin / admin，这两个角色归业务模块所有，
 * 由 `seed-role-permissions.ts` 的 `ensureCrmRoles()` 幂等补齐。
 *
 * `id` 是「新库首次写入时使用的固定槽位」：线上库这两个角色本来就是 3 / 4，
 * 新库以同样 ID 创建，业务代码里的数字判断因此无需分支。
 */
export const CRM_ROLES = [
  {
    id: ROLE_IDS.HOSPITAL_ACCOUNT,
    code: 'hospital_account',
    name: '医院管理',
    description: '医院端账号：仅看本院派单并回复',
  },
  {
    id: ROLE_IDS.CUSTOMER_SERVICE,
    code: 'customer_service',
    name: '客服管理',
    description: '商务/客服：客户、派单、会员',
  },
] as const
