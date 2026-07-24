/**
 * 用户状态枚举。
 *
 * 单一真源：sys_user.status 列的合法值。所有比较、label 渲染、API 响应都从这里走。
 * 历史上该字段在 UserRepository raw 路径是 number、在 UserMapper 响应路径被 toString()
 * 变 string，造成 jwt-auth 与 auth.service 各自用不同比较写法。2026-07 清理后统一 number。
 */

export const UserStatus = {
  DISABLED: 0,
  ACTIVE: 1,
  LOCKED: 2,
} as const

export type UserStatus = typeof UserStatus[keyof typeof UserStatus]

/** 状态 → 业务 label。API 响应 statusName 与前端展示都从这走。 */
const USER_STATUS_LABEL: Record<UserStatus, string> = {
  [UserStatus.DISABLED]: '禁用',
  [UserStatus.ACTIVE]: '启用',
  [UserStatus.LOCKED]: '锁定',
}

export function getUserStatusLabel(status: UserStatus): string {
  return USER_STATUS_LABEL[status] ?? '未知'
}
