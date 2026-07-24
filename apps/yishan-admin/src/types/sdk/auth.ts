/** Stable auth/identity types. Mirrors generated `API.currentUser`. */
export interface CurrentUser {
  /** 用户ID */
  id: number
  /** 用户名 */
  username: string
  /** 邮箱 */
  email?: string
  /** 手机号 */
  phone?: string
  /** 真实姓名 */
  realName: string
  /** 头像URL */
  avatar?: string
  /** 性别（0-未知，1-男，2-女） */
  gender: '0' | '1' | '2'
  /** 性别名称 */
  genderName: string
  /** 出生日期 */
  birthDate?: string
  /** 状态（0-禁用，1-启用，2-锁定） */
  status: 0 | 1 | 2
  /** 状态名称 */
  statusName: string
  /** 最后登录时间 */
  lastLoginTime?: string
  /** 最后登录IP */
  lastLoginIp?: string
  /** 登录次数 */
  loginCount: number
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 已授权菜单路径列表 */
  accessPath?: string[]
  /** 已绑定角色编码（如 super_admin / admin），用于硬编码 dev-only 菜单的可见性判断 */
  roleCodes?: string[]
}
