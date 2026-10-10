export const USER_STATUS = {
  DISABLED: '0',
  ENABLED: '1',
  LOCKED: '2',
} as const

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS]

export const USER_STATUS_CONFIG = {
  [USER_STATUS.DISABLED]: { label: '禁用', variant: 'default' as const },
  [USER_STATUS.ENABLED]: { label: '启用', variant: 'success' as const },
  [USER_STATUS.LOCKED]: { label: '锁定', variant: 'warning' as const },
}

export const STATUS_CHIPS = [
  { key: '', label: '全部' },
  { key: USER_STATUS.ENABLED, label: '启用' },
  { key: USER_STATUS.DISABLED, label: '禁用' },
  { key: USER_STATUS.LOCKED, label: '锁定' },
] as const