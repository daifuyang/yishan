/**
 * 路由常量：避免路径硬编码
 */
export const LOGIN_PATH = 'login/index'

export const TAB_PAGES = {
  home: 'pages/index/index',
  customers: 'pages/customers/index',
  apps: 'pages/apps/index',
  mine: 'pages/mine/index',
} as const

export const CRM_ACTION_PAGE = 'pages/crm/action/index'

export const SECONDARY_PAGES = {
  profileEdit: 'pages/profile/edit/index',
  profilePassword: 'pages/profile/password/index',
  profileLoginLog: 'pages/profile/login-log/index',
  messages: 'pages/messages/index',
  settings: 'pages/settings/index',
  security: 'pages/security/index',
  about: 'pages/about/index',
  contactsIndex: 'pages/contacts/index/index',
  contactsDept: 'pages/contacts/dept/index',
} as const

export const SYSTEM_PAGES = {
  loginLog: 'pages/system/login-log/index',
  deptIndex: 'pages/system/dept/index',
  deptDetail: 'pages/system/dept/detail/index',
  userIndex: 'pages/system/user/index',
  userDetail: 'pages/system/user/detail/index',
  userEdit: 'pages/system/user/edit/index',
  dictIndex: 'pages/system/dict/index',
  dictItems: 'pages/system/dict/items/index',
} as const

/**
 * 写动作 perm 约定
 *  - 格式：<module>:<resource>:<action>
 *  - 用于 useCanWrite(perm) 控制按钮显隐
 */
export const PERMS = {
  // 用户管理
  userList: 'system:user:list',
  userCreate: 'system:user:create',
  userUpdate: 'system:user:update',
  userDelete: 'system:user:delete',
  // 部门管理
  deptList: 'system:department:list',
  deptCreate: 'system:department:create',
  deptUpdate: 'system:department:update',
  deptDelete: 'system:department:delete',
  // 登录日志
  loginLogList: 'system:login-log:list',
  // 字典管理
  dictList: 'system:dict:list',
  dictCreate: 'system:dict:create',
  dictUpdate: 'system:dict:update',
  dictDelete: 'system:dict:delete',
} as const
