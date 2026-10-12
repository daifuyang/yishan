/**
 * 路由常量：避免路径硬编码
 */
export const LOGIN_PATH = 'login/index'

export const TAB_PAGES = {
  home: 'pages/index/index',
  apps: 'pages/apps/index',
  mine: 'pages/mine/index',
} as const

export const SECONDARY_PAGES = {
  profileEdit: 'pages/profile/edit/index',
  profilePassword: 'pages/profile/password/index',
  profileLoginLog: 'pages/profile/login-log/index',
  messages: 'pages/messages/index',
  security: 'pages/security/index',
  about: 'pages/about/index',
  contactsIndex: 'pages/contacts/index/index',
  contactsDept: 'pages/contacts/dept/index',
} as const

export const SYSTEM_PAGES = {
  loginLog: 'pages/system/login-log/index',
  loginLogDetail: 'pages/system/login-log/detail/index',
  deptIndex: 'pages/system/dept/index',
  deptDetail: 'pages/system/dept/detail/index',
  deptForm: 'pages/system/dept/form/index',
  userIndex: 'pages/system/user/index',
  userDetail: 'pages/system/user/detail/index',
  userEdit: 'pages/system/user/edit/index',
  userDepartments: 'pages/system/user/departments/index',
  userRoles: 'pages/system/user/roles/index',
  dictIndex: 'pages/system/dict/index',
  dictItems: 'pages/system/dict/items/index',
  dictDetail: 'pages/system/dict/detail/index',
  dictForm: 'pages/system/dict/form/index',
  dictItemDetail: 'pages/system/dict/items/detail/index',
  dictItemForm: 'pages/system/dict/items/form/index',
  role: 'pages/system/role/index',
  roleDetail: 'pages/system/role/detail/index',
  roleForm: 'pages/system/role/form/index',
  rolePermissions: 'pages/system/role/permissions/index',
  position: 'pages/system/position/index',
  positionDetail: 'pages/system/position/detail/index',
  positionForm: 'pages/system/position/form/index',
  menu: 'pages/system/menu/index',
  menuDetail: 'pages/system/menu/detail/index',
  menuForm: 'pages/system/menu/form/index',
  menuPermissions: 'pages/system/menu/permissions/index',
  appMenu: 'pages/system/app-menu/index',
  appMenuDetail: 'pages/system/app-menu/detail/index',
  appMenuForm: 'pages/system/app-menu/form/index',
  region: 'pages/system/region/index',
  site: 'pages/system/site/index',
  siteBasic: 'pages/system/site/basic/index',
  siteSeo: 'pages/system/site/seo/index',
  siteFiling: 'pages/system/site/filing/index',
  storage: 'pages/system/storage/index',
  storageBasic: 'pages/system/storage/basic/index',
  storageAccess: 'pages/system/storage/access/index',
  storageUpload: 'pages/system/storage/upload/index',
  attachments: 'pages/system/attachments/index',
  moduleManagement: 'pages/system/module-management/index',
  moduleDetail: 'pages/system/module-management/detail/index',
} as const

export const DEMO_PAGES = {
  quickstart: 'pages/demo/quickstart/index',
  health: 'pages/demo/health/index',
  todos: 'pages/demo/todos/index',
  region: 'pages/demo/region/index',
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
  // 角色管理
  roleList: 'system:role:list',
  roleCreate: 'system:role:create',
  roleUpdate: 'system:role:update',
  roleDelete: 'system:role:delete',
  roleGrant: 'system:role:grant',
  // 菜单管理（角色授权需要读取菜单与权限目录）
  menuList: 'system:menu:list',
  permissionCatalog: 'system:permission:catalog',
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
