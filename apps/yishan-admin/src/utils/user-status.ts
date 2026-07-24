/**
 * 用户状态枚举 —— 与后端 apps/yishan-api/src/core/constants/user-status.ts 对齐。
 *
 * 不再走 dictDataMap.user_status（已删除），统一 number 类型，label 在前端
 * 也从这一处取。
 */

export const UserStatus = {
  DISABLED: 0,
  ACTIVE: 1,
  LOCKED: 2,
} as const

export type UserStatus = typeof UserStatus[keyof typeof UserStatus]

const USER_STATUS_LABEL: Record<UserStatus, string> = {
  [UserStatus.DISABLED]: '禁用',
  [UserStatus.ACTIVE]: '启用',
  [UserStatus.LOCKED]: '锁定',
}

export function getUserStatusLabel(status: UserStatus): string {
  return USER_STATUS_LABEL[status] ?? '未知'
}

/** ProTable `valueEnum` 形状：键是 status 数字，value 是 { text, status (Badge 颜色) } */
export const userStatusEnum: Record<string, { text: string; status: 'Success' | 'Error' | 'Warning' | 'Default' | 'Processing' }> = {
  [UserStatus.DISABLED]: { text: USER_STATUS_LABEL[UserStatus.DISABLED], status: 'Error' },
  [UserStatus.ACTIVE]: { text: USER_STATUS_LABEL[UserStatus.ACTIVE], status: 'Success' },
  [UserStatus.LOCKED]: { text: USER_STATUS_LABEL[UserStatus.LOCKED], status: 'Warning' },
}
