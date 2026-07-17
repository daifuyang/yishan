// Generated from drizzle/*.sql. Do not edit manually.
import { boolean, date, datetime, decimal, int, json, text, tinyint, varchar, index, mysqlTable, uniqueIndex } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

export const sysApp = mysqlTable(
  'sys_app',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 100 }),
  iconColor: varchar('icon_color', { length: 50 }),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  description: varchar('description', { length: 255 }),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    sysAppNameKey: uniqueIndex('sys_app_name_key').on(t.name),
    idxAppStatus: index('idx_app_status').on(t.status),
    idxAppCreatedAt: index('idx_app_created_at').on(t.createdAt),
    idxAppDeletedAt: index('idx_app_deleted_at').on(t.deletedAt),
    idxAppSortOrder: index('idx_app_sort_order').on(t.sortOrder),
    sysAppCreatorIdIdx: index('sys_app_creator_id_idx').on(t.creatorId),
    sysAppUpdaterIdIdx: index('sys_app_updater_id_idx').on(t.updaterId),
  })
)

export const sysAppResource = mysqlTable(
  'sys_app_resource',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  appId: int('app_id').notNull(),
  parentId: int('parent_id'),
  type: varchar('type', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  config: json('config'),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxAppResourceAppId: index('idx_app_resource_app_id').on(t.appId),
    idxAppResourceParentId: index('idx_app_resource_parent_id').on(t.parentId),
    idxAppResourceType: index('idx_app_resource_type').on(t.type),
    idxAppResourceStatus: index('idx_app_resource_status').on(t.status),
    idxAppResourceDeletedAt: index('idx_app_resource_deleted_at').on(t.deletedAt),
    idxAppResourceSortOrder: index('idx_app_resource_sort_order').on(t.sortOrder),
    sysAppResourceCreatorIdIdx: index('sys_app_resource_creator_id_idx').on(t.creatorId),
    sysAppResourceUpdaterIdIdx: index('sys_app_resource_updater_id_idx').on(t.updaterId),
  })
)

export const sysFormField = mysqlTable(
  'sys_form_field',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  resourceId: int('resource_id').notNull(),
  key: varchar('key', { length: 100 }).notNull(),
  label: varchar('label', { length: 100 }),
  type: varchar('type', { length: 50 }).notNull(),
  required: boolean('required').notNull().default(false),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  config: json('config'),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxFormFieldResourceId: index('idx_form_field_resource_id').on(t.resourceId),
    idxFormFieldStatus: index('idx_form_field_status').on(t.status),
    idxFormFieldDeletedAt: index('idx_form_field_deleted_at').on(t.deletedAt),
    idxFormFieldSortOrder: index('idx_form_field_sort_order').on(t.sortOrder),
    sysFormFieldCreatorIdIdx: index('sys_form_field_creator_id_idx').on(t.creatorId),
    sysFormFieldUpdaterIdIdx: index('sys_form_field_updater_id_idx').on(t.updaterId),
    uniqFormFieldResourceKey: uniqueIndex('uniq_form_field_resource_key').on(t.resourceId, t.key),
  })
)

export const sysFormData = mysqlTable(
  'sys_form_data',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  resourceId: int('resource_id').notNull(),
  data: json('data').notNull(),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxFormDataResourceId: index('idx_form_data_resource_id').on(t.resourceId),
    idxFormDataStatus: index('idx_form_data_status').on(t.status),
    idxFormDataCreatedAt: index('idx_form_data_created_at').on(t.createdAt),
    idxFormDataDeletedAt: index('idx_form_data_deleted_at').on(t.deletedAt),
    sysFormDataCreatorIdIdx: index('sys_form_data_creator_id_idx').on(t.creatorId),
    sysFormDataUpdaterIdIdx: index('sys_form_data_updater_id_idx').on(t.updaterId),
  })
)

export const sysAppMenu = mysqlTable(
  'sys_app_menu',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  appId: int('app_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  path: varchar('path', { length: 255 }),
  icon: varchar('icon', { length: 100 }),
  component: varchar('component', { length: 255 }),
  type: tinyint('type').notNull().default(1),
  parentId: int('parent_id'),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  hideInMenu: boolean('hide_in_menu').notNull().default(false),
  isExternalLink: boolean('is_external_link').notNull().default(false),
  perm: varchar('perm', { length: 100 }),
  keepAlive: boolean('keep_alive').notNull().default(false),
  resourceId: int('resource_id'),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxAppMenuAppId: index('idx_app_menu_app_id').on(t.appId),
    idxAppMenuResourceId: index('idx_app_menu_resource_id').on(t.resourceId),
    idxAppMenuStatus: index('idx_app_menu_status').on(t.status),
    idxAppMenuCreatedAt: index('idx_app_menu_created_at').on(t.createdAt),
    idxAppMenuDeletedAt: index('idx_app_menu_deleted_at').on(t.deletedAt),
    idxAppMenuParentId: index('idx_app_menu_parent_id').on(t.parentId),
    idxAppMenuSortOrder: index('idx_app_menu_sort_order').on(t.sortOrder),
    sysAppMenuUpdaterIdIdx: index('sys_app_menu_updater_id_idx').on(t.updaterId),
    sysAppMenuCreatorIdIdx: index('sys_app_menu_creator_id_idx').on(t.creatorId),
    uniqAppMenuAppParentName: uniqueIndex('uniq_app_menu_app_parent_name').on(t.appId, t.parentId, t.name),
  })
)

export const sysRegion = mysqlTable(
  'sys_region',
  {
  code: int('code').primaryKey().notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  level: tinyint('level').notNull(),
  parentCode: int('parent_code').notNull().default(0),
  sortOrder: int('sort_order').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxSysRegionParent: index('idx_sys_region_parent').on(t.parentCode),
    idxSysRegionLevel: index('idx_sys_region_level').on(t.level),
    idxSysRegionStatus: index('idx_sys_region_status').on(t.status),
  })
)

export const sysOption = mysqlTable(
  'sys_option',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  key: varchar('key', { length: 100 }).notNull(),
  value: text('value'),
  description: varchar('description', { length: 255 }),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    sysOptionKeyKey: uniqueIndex('sys_option_key_key').on(t.key),
    idxOptionKey: index('idx_option_key').on(t.key),
    idxOptionStatus: index('idx_option_status').on(t.status),
    idxOptionDeletedAt: index('idx_option_deleted_at').on(t.deletedAt),
  })
)

export const sysUser = mysqlTable(
  'sys_user',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  username: varchar('username', { length: 50 }),
  email: varchar('email', { length: 100 }),
  phone: varchar('phone', { length: 20 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  realName: varchar('real_name', { length: 50 }),
  nickname: varchar('nickname', { length: 50 }),
  avatar: varchar('avatar', { length: 500 }),
  gender: tinyint('gender').notNull().default(0),
  birthDate: date('birth_date', { mode: 'date' }),
  status: tinyint('status').notNull().default(1),
  lastLoginTime: datetime('last_login_time', { mode: 'date' }),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
  loginCount: int('login_count').notNull().default(0),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    sysUserUsernameKey: uniqueIndex('sys_user_username_key').on(t.username),
    sysUserEmailKey: uniqueIndex('sys_user_email_key').on(t.email),
    sysUserPhoneKey: uniqueIndex('sys_user_phone_key').on(t.phone),
    idxStatus: index('idx_status').on(t.status),
    idxCreatedAt: index('idx_created_at').on(t.createdAt),
    idxDeletedAt: index('idx_deleted_at').on(t.deletedAt),
    idxCreatorId: index('idx_creator_id').on(t.creatorId),
    idxUpdaterId: index('idx_updater_id').on(t.updaterId),
    idxStatusCreated: index('idx_status_created').on(t.status, t.createdAt),
    idxRealNameStatus: index('idx_real_name_status').on(t.realName, t.status),
  })
)

export const sysUserToken = mysqlTable(
  'sys_user_token',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: int('user_id').notNull(),
  accessToken: varchar('access_token', { length: 512 }).notNull(),
  refreshToken: varchar('refresh_token', { length: 512 }).notNull(),
  accessTokenExpiresAt: datetime('access_token_expires_at', { mode: 'date' }).notNull(),
  refreshTokenExpiresAt: datetime('refresh_token_expires_at', { mode: 'date' }).notNull(),
  isRevoked: boolean('is_revoked').notNull().default(false),
  revokedAt: datetime('revoked_at', { mode: 'date' }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  },
  (t) => ({
    idxUserTokenUserId: index('idx_user_token_user_id').on(t.userId),
    idxIsRevoked: index('idx_is_revoked').on(t.isRevoked),
    idxAccessTokenExpires: index('idx_access_token_expires').on(t.accessTokenExpiresAt),
    idxRefreshTokenExpires: index('idx_refresh_token_expires').on(t.refreshTokenExpiresAt),
    idxUserRevoked: index('idx_user_revoked').on(t.userId, t.isRevoked),
  })
)

export const sysLoginLog = mysqlTable(
  'sys_login_log',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: int('user_id'),
  username: varchar('username', { length: 100 }).notNull(),
  realName: varchar('real_name', { length: 50 }),
  status: tinyint('status').notNull().default(1),
  message: varchar('message', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  },
  (t) => ({
    idxLoginLogUserId: index('idx_login_log_user_id').on(t.userId),
    idxLoginLogUsername: index('idx_login_log_username').on(t.username),
    idxLoginLogStatus: index('idx_login_log_status').on(t.status),
    idxLoginLogCreatedAt: index('idx_login_log_created_at').on(t.createdAt),
    idxLoginLogIpAddress: index('idx_login_log_ip_address').on(t.ipAddress),
    idxLoginLogDeletedAt: index('idx_login_log_deleted_at').on(t.deletedAt),
    idxLoginLogStatusCreatedAt: index('idx_login_log_status_created_at').on(t.status, t.createdAt),
  })
)

export const sysRole = mysqlTable(
  'sys_role',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  code: varchar('code', { length: 50 }),
  description: varchar('description', { length: 255 }),
  status: tinyint('status').notNull().default(1),
  dataScope: tinyint('data_scope').notNull().default(1),
  isSystemDefault: boolean('is_system_default').notNull().default(false),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    sysRoleNameKey: uniqueIndex('sys_role_name_key').on(t.name),
    uniqRoleCode: uniqueIndex('uniq_role_code').on(t.code),
    idxRoleStatus: index('idx_role_status').on(t.status),
    idxRoleCreatedAt: index('idx_role_created_at').on(t.createdAt),
    idxRoleDeletedAt: index('idx_role_deleted_at').on(t.deletedAt),
    sysRoleCreatorIdIdx: index('sys_role_creator_id_idx').on(t.creatorId),
    sysRoleUpdaterIdIdx: index('sys_role_updater_id_idx').on(t.updaterId),
  })
)

export const sysUserRole = mysqlTable(
  'sys_user_role',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: int('user_id').notNull(),
  roleId: int('role_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  },
  (t) => ({
    idxUserRoleUserId: index('idx_user_role_user_id').on(t.userId),
    idxUserRoleRoleId: index('idx_user_role_role_id').on(t.roleId),
    uniqUserRole: uniqueIndex('uniq_user_role').on(t.userId, t.roleId),
  })
)

export const sysUserDept = mysqlTable(
  'sys_user_dept',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: int('user_id').notNull(),
  deptId: int('dept_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  },
  (t) => ({
    idxUserDeptUserId: index('idx_user_dept_user_id').on(t.userId),
    idxUserDeptDeptId: index('idx_user_dept_dept_id').on(t.deptId),
    uniqUserDept: uniqueIndex('uniq_user_dept').on(t.userId, t.deptId),
  })
)

export const sysDept = mysqlTable(
  'sys_dept',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  parentId: int('parent_id'),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  description: varchar('description', { length: 255 }),
  leaderId: int('leader_id'),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    sysDeptNameKey: uniqueIndex('sys_dept_name_key').on(t.name),
    idxDeptStatus: index('idx_dept_status').on(t.status),
    idxDeptCreatedAt: index('idx_dept_created_at').on(t.createdAt),
    idxDeptDeletedAt: index('idx_dept_deleted_at').on(t.deletedAt),
    idxDeptParentId: index('idx_dept_parent_id').on(t.parentId),
    idxDeptSortOrder: index('idx_dept_sort_order').on(t.sortOrder),
    sysDeptLeaderIdIdx: index('sys_dept_leader_id_idx').on(t.leaderId),
    sysDeptCreatorIdIdx: index('sys_dept_creator_id_idx').on(t.creatorId),
    sysDeptUpdaterIdIdx: index('sys_dept_updater_id_idx').on(t.updaterId),
  })
)

export const sysPost = mysqlTable(
  'sys_post',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  description: varchar('description', { length: 255 }),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    sysPostNameKey: uniqueIndex('sys_post_name_key').on(t.name),
    idxPostStatus: index('idx_post_status').on(t.status),
    idxPostCreatedAt: index('idx_post_created_at').on(t.createdAt),
    idxPostDeletedAt: index('idx_post_deleted_at').on(t.deletedAt),
    idxPostSortOrder: index('idx_post_sort_order').on(t.sortOrder),
    sysPostCreatorIdIdx: index('sys_post_creator_id_idx').on(t.creatorId),
    sysPostUpdaterIdIdx: index('sys_post_updater_id_idx').on(t.updaterId),
  })
)

export const sysMenu = mysqlTable(
  'sys_menu',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  path: varchar('path', { length: 255 }),
  icon: varchar('icon', { length: 100 }),
  component: varchar('component', { length: 255 }),
  type: tinyint('type').notNull().default(1),
  parentId: int('parent_id'),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  hideInMenu: boolean('hide_in_menu').notNull().default(false),
  isExternalLink: boolean('is_external_link').notNull().default(false),
  perm: varchar('perm', { length: 100 }),
  keepAlive: boolean('keep_alive').notNull().default(false),
  source: varchar('source', { length: 20 }).notNull().default('custom'),
  pluginName: varchar('plugin_name', { length: 100 }),
  pluginMenuKey: varchar('plugin_menu_key', { length: 255 }),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    sysMenuPathKey: uniqueIndex('sys_menu_path_key').on(t.path),
    idxMenuStatus: index('idx_menu_status').on(t.status),
    idxMenuCreatedAt: index('idx_menu_created_at').on(t.createdAt),
    idxMenuDeletedAt: index('idx_menu_deleted_at').on(t.deletedAt),
    idxMenuParentId: index('idx_menu_parent_id').on(t.parentId),
    idxMenuSortOrder: index('idx_menu_sort_order').on(t.sortOrder),
    sysMenuUpdaterIdIdx: index('sys_menu_updater_id_idx').on(t.updaterId),
    sysMenuCreatorIdIdx: index('sys_menu_creator_id_idx').on(t.creatorId),
    idxMenuPluginName: index('idx_menu_plugin_name').on(t.pluginName),
    idxMenuSource: index('idx_menu_source').on(t.source),
    uniqMenuParentName: uniqueIndex('uniq_menu_parent_name').on(t.parentId, t.name),
    uniqPluginMenuKey: uniqueIndex('uniq_plugin_menu_key').on(t.pluginMenuKey),
  })
)

export const sysRoleMenu = mysqlTable(
  'sys_role_menu',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  roleId: int('role_id').notNull(),
  menuId: int('menu_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  },
  (t) => ({
    idxRoleMenuRoleId: index('idx_role_menu_role_id').on(t.roleId),
    idxRoleMenuMenuId: index('idx_role_menu_menu_id').on(t.menuId),
    uniqRoleMenu: uniqueIndex('uniq_role_menu').on(t.roleId, t.menuId),
  })
)

export const sysDictType = mysqlTable(
  'sys_dict_type',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  remark: varchar('remark', { length: 255 }),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    sysDictTypeTypeKey: uniqueIndex('sys_dict_type_type_key').on(t.type),
    idxDictTypeStatus: index('idx_dict_type_status').on(t.status),
    idxDictTypeCreatedAt: index('idx_dict_type_created_at').on(t.createdAt),
    idxDictTypeDeletedAt: index('idx_dict_type_deleted_at').on(t.deletedAt),
    idxDictTypeSortOrder: index('idx_dict_type_sort_order').on(t.sortOrder),
    sysDictTypeCreatorIdIdx: index('sys_dict_type_creator_id_idx').on(t.creatorId),
    sysDictTypeUpdaterIdIdx: index('sys_dict_type_updater_id_idx').on(t.updaterId),
  })
)

export const sysDictData = mysqlTable(
  'sys_dict_data',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  typeId: int('type_id').notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  value: varchar('value', { length: 100 }).notNull(),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  tag: varchar('tag', { length: 50 }),
  remark: varchar('remark', { length: 255 }),
  isDefault: boolean('is_default').notNull().default(false),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxDictDataTypeId: index('idx_dict_data_type_id').on(t.typeId),
    idxDictDataStatus: index('idx_dict_data_status').on(t.status),
    idxDictDataCreatedAt: index('idx_dict_data_created_at').on(t.createdAt),
    idxDictDataDeletedAt: index('idx_dict_data_deleted_at').on(t.deletedAt),
    idxDictDataSortOrder: index('idx_dict_data_sort_order').on(t.sortOrder),
    sysDictDataCreatorIdIdx: index('sys_dict_data_creator_id_idx').on(t.creatorId),
    sysDictDataUpdaterIdIdx: index('sys_dict_data_updater_id_idx').on(t.updaterId),
    uniqDictDataValue: uniqueIndex('uniq_dict_data_value').on(t.typeId, t.value),
  })
)

export const sysAttachmentFolder = mysqlTable(
  'sys_attachment_folder',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  parentId: int('parent_id'),
  kind: tinyint('kind').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  remark: varchar('remark', { length: 255 }),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxAttachmentFolderKind: index('idx_attachment_folder_kind').on(t.kind),
    idxAttachmentFolderStatus: index('idx_attachment_folder_status').on(t.status),
    idxAttachmentFolderCreatedAt: index('idx_attachment_folder_created_at').on(t.createdAt),
    idxAttachmentFolderDeletedAt: index('idx_attachment_folder_deleted_at').on(t.deletedAt),
    idxAttachmentFolderParentId: index('idx_attachment_folder_parent_id').on(t.parentId),
    idxAttachmentFolderSortOrder: index('idx_attachment_folder_sort_order').on(t.sortOrder),
    sysAttachmentFolderCreatorIdIdx: index('sys_attachment_folder_creator_id_idx').on(t.creatorId),
    sysAttachmentFolderUpdaterIdIdx: index('sys_attachment_folder_updater_id_idx').on(t.updaterId),
    uniqAttachmentFolderParentName: uniqueIndex('uniq_attachment_folder_parent_name').on(t.parentId, t.name),
  })
)

export const sysAttachment = mysqlTable(
  'sys_attachment',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  folderId: int('folder_id'),
  kind: tinyint('kind').notNull().default(4),
  name: varchar('name', { length: 255 }),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  ext: varchar('ext', { length: 20 }),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: int('size').notNull().default(0),
  storage: varchar('storage', { length: 20 }).notNull().default('local'),
  path: varchar('path', { length: 500 }),
  url: varchar('url', { length: 500 }),
  objectKey: varchar('object_key', { length: 500 }),
  hash: varchar('hash', { length: 64 }),
  width: int('width'),
  height: int('height'),
  duration: int('duration'),
  metadata: json('metadata'),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxAttachmentFolderId: index('idx_attachment_folder_id').on(t.folderId),
    idxAttachmentKind: index('idx_attachment_kind').on(t.kind),
    idxAttachmentMimeType: index('idx_attachment_mime_type').on(t.mimeType),
    idxAttachmentStorage: index('idx_attachment_storage').on(t.storage),
    idxAttachmentStatus: index('idx_attachment_status').on(t.status),
    idxAttachmentCreatedAt: index('idx_attachment_created_at').on(t.createdAt),
    idxAttachmentDeletedAt: index('idx_attachment_deleted_at').on(t.deletedAt),
    sysAttachmentCreatorIdIdx: index('sys_attachment_creator_id_idx').on(t.creatorId),
    sysAttachmentUpdaterIdIdx: index('sys_attachment_updater_id_idx').on(t.updaterId),
    uniqAttachmentHashStorage: uniqueIndex('uniq_attachment_hash_storage').on(t.hash, t.storage),
  })
)

export const sysPlugin = mysqlTable(
  'sys_plugin',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  pluginId: varchar('plugin_id', { length: 100 }),
  org: varchar('org', { length: 50 }),
  slug: varchar('slug', { length: 50 }),
  source: varchar('source', { length: 30 }),
  name: varchar('name', { length: 100 }),
  currentVersion: varchar('current_version', { length: 50 }).notNull(),
  coreCompatibility: varchar('core_compatibility', { length: 50 }),
  compatRange: varchar('compat_range', { length: 100 }),
  routeBase: varchar('route_base', { length: 255 }),
  lifecycleState: varchar('lifecycle_state', { length: 30 }).notNull().default('discovered'),
  enabled: boolean('enabled').notNull().default(false),
  installedAt: datetime('installed_at', { mode: 'date' }),
  lastSyncedAt: datetime('last_synced_at', { mode: 'date' }),
  lastError: varchar('last_error', { length: 500 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    sysPluginPluginIdKey: uniqueIndex('sys_plugin_plugin_id_key').on(t.pluginId),
    idxSysPluginEnabled: index('idx_sys_plugin_enabled').on(t.enabled),
    idxSysPluginLifecycleState: index('idx_sys_plugin_lifecycle_state').on(t.lifecycleState),
    idxSysPluginUpdatedAt: index('idx_sys_plugin_updated_at').on(t.updatedAt),
    idxSysPluginPluginId: index('idx_sys_plugin_plugin_id').on(t.pluginId),
  })
)

export const sysPluginVersion = mysqlTable(
  'sys_plugin_version',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  pluginId: int('plugin_id').notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  manifest: json('manifest'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxSysPluginVersionPluginId: index('idx_sys_plugin_version_plugin_id').on(t.pluginId),
    uniqSysPluginVersion: uniqueIndex('uniq_sys_plugin_version').on(t.pluginId, t.version),
  })
)

export const sysPluginInstall = mysqlTable(
  'sys_plugin_install',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  pluginId: int('plugin_id').notNull(),
  lifecycleState: varchar('lifecycle_state', { length: 30 }).notNull(),
  enabled: boolean('enabled').notNull().default(false),
  installedAt: datetime('installed_at', { mode: 'date' }),
  uninstalledAt: datetime('uninstalled_at', { mode: 'date' }),
  lastError: varchar('last_error', { length: 500 }),
  syncStrategy: varchar('sync_strategy', { length: 20 }).default('safe'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    sysPluginInstallPluginIdKey: uniqueIndex('sys_plugin_install_plugin_id_key').on(t.pluginId),
    idxSysPluginInstallPluginId: index('idx_sys_plugin_install_plugin_id').on(t.pluginId),
    idxSysPluginInstallEnabled: index('idx_sys_plugin_install_enabled').on(t.enabled),
  })
)

export const sysPluginConfigSnapshot = mysqlTable(
  'sys_plugin_config_snapshot',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  pluginId: int('plugin_id').notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  config: json('config'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxSysPluginConfigSnapshotPluginId: index('idx_sys_plugin_config_snapshot_plugin_id').on(t.pluginId),
  })
)

export const sysPluginSyncLog = mysqlTable(
  'sys_plugin_sync_log',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  pluginInstallId: int('plugin_install_id').notNull(),
  strategy: varchar('strategy', { length: 20 }).notNull().default('safe'),
  status: varchar('status', { length: 20 }).notNull().default('success'),
  created: int('created').notNull().default(0),
  updated: int('updated').notNull().default(0),
  skipped: int('skipped').notNull().default(0),
  conflicted: int('conflicted').notNull().default(0),
  conflictDetails: json('conflict_details'),
  errorMessage: varchar('error_message', { length: 500 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxSysPluginSyncLogPluginInstallId: index('idx_sys_plugin_sync_log_plugin_install_id').on(t.pluginInstallId),
    idxSysPluginSyncLogCreatedAt: index('idx_sys_plugin_sync_log_created_at').on(t.createdAt),
  })
)

export const sysApiToken = mysqlTable(
  'sys_api_token',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  scopes: json('scopes'),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  userId: int('user_id').notNull(),
  expiresAt: datetime('expires_at', { mode: 'date' }),
  lastUsedAt: datetime('last_used_at', { mode: 'date' }),
  lastUsedIp: varchar('last_used_ip', { length: 45 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    sysApiTokenTokenHashKey: uniqueIndex('sys_api_token_token_hash_key').on(t.tokenHash),
    idxApiTokenUserId: index('idx_api_token_user_id').on(t.userId),
    idxApiTokenDeletedAt: index('idx_api_token_deleted_at').on(t.deletedAt),
    idxApiTokenExpiresAt: index('idx_api_token_expires_at').on(t.expiresAt),
  })
)

export const portalCategory = mysqlTable(
  'portal_category',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }),
  parentId: int('parent_id'),
  status: tinyint('status').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  description: varchar('description', { length: 255 }),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    portalCategorySlugKey: uniqueIndex('portal_category_slug_key').on(t.slug),
    idxCategoryStatus: index('idx_category_status').on(t.status),
    idxCategoryCreatedAt: index('idx_category_created_at').on(t.createdAt),
    idxCategoryDeletedAt: index('idx_category_deleted_at').on(t.deletedAt),
    idxCategoryParentId: index('idx_category_parent_id').on(t.parentId),
    idxCategorySortOrder: index('idx_category_sort_order').on(t.sortOrder),
    portalCategoryCreatorIdIdx: index('portal_category_creator_id_idx').on(t.creatorId),
    portalCategoryUpdaterIdIdx: index('portal_category_updater_id_idx').on(t.updaterId),
    uniqCategoryParentName: uniqueIndex('uniq_category_parent_name').on(t.parentId, t.name),
  })
)

export const portalArticle = mysqlTable(
  'portal_article',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 200 }),
  summary: varchar('summary', { length: 500 }),
  content: text('content').notNull(),
  coverImage: varchar('cover_image', { length: 500 }),
  status: tinyint('status').notNull().default(0),
  isPinned: boolean('is_pinned').notNull().default(false),
  publishTime: datetime('publish_time', { mode: 'date' }),
  attributes: json('attributes'),
  tags: json('tags'),
  templateId: int('template_id'),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    portalArticleSlugKey: uniqueIndex('portal_article_slug_key').on(t.slug),
    idxArticleStatus: index('idx_article_status').on(t.status),
    idxArticlePublishTime: index('idx_article_publish_time').on(t.publishTime),
    idxArticleTemplateId: index('idx_article_template_id').on(t.templateId),
    idxArticleCreatedAt: index('idx_article_created_at').on(t.createdAt),
    idxArticleDeletedAt: index('idx_article_deleted_at').on(t.deletedAt),
    portalArticleCreatorIdIdx: index('portal_article_creator_id_idx').on(t.creatorId),
    portalArticleUpdaterIdIdx: index('portal_article_updater_id_idx').on(t.updaterId),
  })
)

export const portalArticleCategory = mysqlTable(
  'portal_article_category',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  articleId: int('article_id').notNull(),
  categoryId: int('category_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxArticleCategoryArticleId: index('idx_article_category_article_id').on(t.articleId),
    idxArticleCategoryCategoryId: index('idx_article_category_category_id').on(t.categoryId),
    uniqArticleCategory: uniqueIndex('uniq_article_category').on(t.articleId, t.categoryId),
  })
)

export const portalPage = mysqlTable(
  'portal_page',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  path: varchar('path', { length: 255 }).notNull(),
  content: text('content').notNull(),
  status: tinyint('status').notNull().default(1),
  attributes: json('attributes'),
  publishTime: datetime('publish_time', { mode: 'date' }),
  templateId: int('template_id'),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    portalPagePathKey: uniqueIndex('portal_page_path_key').on(t.path),
    idxPageStatus: index('idx_page_status').on(t.status),
    idxPagePath: index('idx_page_path').on(t.path),
    idxPageTemplateId: index('idx_page_template_id').on(t.templateId),
    idxPageCreatedAt: index('idx_page_created_at').on(t.createdAt),
    idxPageDeletedAt: index('idx_page_deleted_at').on(t.deletedAt),
    portalPageCreatorIdIdx: index('portal_page_creator_id_idx').on(t.creatorId),
    portalPageUpdaterIdIdx: index('portal_page_updater_id_idx').on(t.updaterId),
  })
)

export const portalTemplate = mysqlTable(
  'portal_template',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  type: tinyint('type').notNull(),
  schema: json('schema'),
  config: json('config'),
  status: tinyint('status').notNull().default(1),
  isSystemDefault: boolean('is_system_default').notNull().default(false),
  creatorId: int('creator_id'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id'),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxTemplateType: index('idx_template_type').on(t.type),
    idxTemplateStatus: index('idx_template_status').on(t.status),
    idxTemplateIsSystemDefault: index('idx_template_is_system_default').on(t.isSystemDefault),
    idxTemplateCreatedAt: index('idx_template_created_at').on(t.createdAt),
    idxTemplateDeletedAt: index('idx_template_deleted_at').on(t.deletedAt),
    portalTemplateCreatorIdIdx: index('portal_template_creator_id_idx').on(t.creatorId),
    portalTemplateUpdaterIdIdx: index('portal_template_updater_id_idx').on(t.updaterId),
    uniqTemplateTypeName: uniqueIndex('uniq_template_type_name').on(t.type, t.name),
  })
)

export const shopCategory = mysqlTable(
  'shop_category',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  parentId: int('parent_id'),
  coverImage: varchar('cover_image', { length: 500 }),
  icon: varchar('icon', { length: 100 }),
  description: varchar('description', { length: 500 }),
  sortOrder: int('sort_order').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxShopCategoryStatus: index('idx_shop_category_status').on(t.status),
    idxShopCategoryParentId: index('idx_shop_category_parent_id').on(t.parentId),
    idxShopCategorySortOrder: index('idx_shop_category_sort_order').on(t.sortOrder),
    idxShopCategoryDeletedAt: index('idx_shop_category_deleted_at').on(t.deletedAt),
  })
)

export const shopAttribute = mysqlTable(
  'shop_attribute',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  type: tinyint('type').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxShopAttributeStatus: index('idx_shop_attribute_status').on(t.status),
    idxShopAttributeType: index('idx_shop_attribute_type').on(t.type),
    idxShopAttributeDeletedAt: index('idx_shop_attribute_deleted_at').on(t.deletedAt),
  })
)

export const shopAttributeValue = mysqlTable(
  'shop_attribute_value',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  attributeId: int('attribute_id').notNull(),
  value: varchar('value', { length: 100 }).notNull(),
  image: varchar('image', { length: 500 }),
  sortOrder: int('sort_order').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxShopAttrValueAttrId: index('idx_shop_attr_value_attr_id').on(t.attributeId),
    idxShopAttrValueStatus: index('idx_shop_attr_value_status').on(t.status),
    idxShopAttrValueDeletedAt: index('idx_shop_attr_value_deleted_at').on(t.deletedAt),
  })
)

export const shopProduct = mysqlTable(
  'shop_product',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  categoryId: int('category_id').notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  subtitle: varchar('subtitle', { length: 500 }),
  coverImage: varchar('cover_image', { length: 500 }),
  images: json('images'),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }),
  stock: int('stock').notNull().default(0),
  unit: varchar('unit', { length: 20 }).notNull().default('件'),
  weight: decimal('weight', { precision: 10, scale: 2 }),
  status: tinyint('status').notNull().default(1),
  isHot: boolean('is_hot').notNull().default(false),
  isNew: boolean('is_new').notNull().default(false),
  isRecycle: boolean('is_recycle').notNull().default(false),
  sortOrder: int('sort_order').notNull().default(0),
  clickCount: int('click_count').notNull().default(0),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxShopProductCategory: index('idx_shop_product_category').on(t.categoryId),
    idxShopProductStatus: index('idx_shop_product_status').on(t.status),
    idxShopProductHot: index('idx_shop_product_hot').on(t.isHot, t.status),
    idxShopProductNew: index('idx_shop_product_new').on(t.isNew, t.status),
    idxShopProductRecycle: index('idx_shop_product_recycle').on(t.isRecycle),
    idxShopProductPrice: index('idx_shop_product_price').on(t.price),
    idxShopProductCreated: index('idx_shop_product_created').on(t.createdAt),
    idxShopProductDeletedAt: index('idx_shop_product_deleted_at').on(t.deletedAt),
  })
)

export const shopSku = mysqlTable(
  'shop_product_sku',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  productId: int('product_id').notNull(),
  skuCode: varchar('sku_code', { length: 64 }).notNull(),
  skuName: varchar('sku_name', { length: 500 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }),
  stock: int('stock').notNull().default(0),
  weight: decimal('weight', { precision: 10, scale: 2 }),
  coverImage: varchar('cover_image', { length: 500 }),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    shopProductSkuSkuCodeKey: uniqueIndex('shop_product_sku_sku_code_key').on(t.skuCode),
    idxShopSkuProduct: index('idx_shop_sku_product').on(t.productId),
    idxShopSkuCode: index('idx_shop_sku_code').on(t.skuCode),
    idxShopSkuStatus: index('idx_shop_sku_status').on(t.status),
    idxShopSkuDeletedAt: index('idx_shop_sku_deleted_at').on(t.deletedAt),
  })
)

export const shopSkuAttribute = mysqlTable(
  'shop_sku_attribute',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  skuId: int('sku_id').notNull(),
  attributeId: int('attribute_id').notNull(),
  valueId: int('value_id').notNull(),
  },
  (t) => ({
    idxShopSkuAttrSku: index('idx_shop_sku_attr_sku').on(t.skuId),
    idxShopSkuAttrAttr: index('idx_shop_sku_attr_attr').on(t.attributeId),
    idxShopSkuAttrValue: index('idx_shop_sku_attr_value').on(t.valueId),
    uniqSkuAttrValue: uniqueIndex('uniq_sku_attr_value').on(t.skuId, t.attributeId, t.valueId),
  })
)

export const shopAddress = mysqlTable(
  'shop_address',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: int('user_id').notNull(),
  receiver: varchar('receiver', { length: 50 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  province: varchar('province', { length: 50 }).notNull(),
  city: varchar('city', { length: 50 }).notNull(),
  district: varchar('district', { length: 50 }).notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxShopAddressUser: index('idx_shop_address_user').on(t.userId),
    idxShopAddressDefault: index('idx_shop_address_default').on(t.isDefault),
    idxShopAddressStatus: index('idx_shop_address_status').on(t.status),
    idxShopAddressDeletedAt: index('idx_shop_address_deleted_at').on(t.deletedAt),
  })
)

export const shopCart = mysqlTable(
  'shop_cart',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: int('user_id').notNull(),
  productId: int('product_id').notNull(),
  skuId: int('sku_id'),
  quantity: int('quantity').notNull().default(1),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxShopCartUser: index('idx_shop_cart_user').on(t.userId),
    idxShopCartStatus: index('idx_shop_cart_status').on(t.status),
    idxShopCartDeletedAt: index('idx_shop_cart_deleted_at').on(t.deletedAt),
    uniqCartUserProductSku: uniqueIndex('uniq_cart_user_product_sku').on(t.userId, t.productId, t.skuId),
  })
)

export const shopOrder = mysqlTable(
  'shop_order',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  orderNo: varchar('order_no', { length: 32 }).notNull(),
  userId: int('user_id').notNull(),
  addressId: int('address_id').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  freightAmount: decimal('freight_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  payAmount: decimal('pay_amount', { precision: 10, scale: 2 }).notNull(),
  payStatus: tinyint('pay_status').notNull().default(0),
  payTime: datetime('pay_time', { mode: 'date' }),
  payMethod: varchar('pay_method', { length: 20 }),
  payTransactionId: varchar('pay_transaction_id', { length: 64 }),
  orderStatus: tinyint('order_status').notNull().default(1),
  expressCompany: varchar('express_company', { length: 50 }),
  expressNo: varchar('express_no', { length: 50 }),
  deliverTime: datetime('deliver_time', { mode: 'date' }),
  receiveTime: datetime('receive_time', { mode: 'date' }),
  cancelReason: varchar('cancel_reason', { length: 255 }),
  remark: varchar('remark', { length: 500 }),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    shopOrderOrderNoKey: uniqueIndex('shop_order_order_no_key').on(t.orderNo),
    idxShopOrderUser: index('idx_shop_order_user').on(t.userId),
    idxShopOrderNo: index('idx_shop_order_no').on(t.orderNo),
    idxShopOrderStatus: index('idx_shop_order_status').on(t.orderStatus),
    idxShopOrderPayStatus: index('idx_shop_order_pay_status').on(t.payStatus),
    idxShopOrderCreated: index('idx_shop_order_created').on(t.createdAt),
    idxShopOrderDeletedAt: index('idx_shop_order_deleted_at').on(t.deletedAt),
    idxShopOrderExpress: index('idx_shop_order_express').on(t.expressNo),
  })
)

export const shopOrderItem = mysqlTable(
  'shop_order_item',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  orderId: int('order_id').notNull(),
  productId: int('product_id').notNull(),
  skuId: int('sku_id'),
  skuName: varchar('sku_name', { length: 500 }),
  coverImage: varchar('cover_image', { length: 500 }),
  productName: varchar('product_name', { length: 200 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  quantity: int('quantity').notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  },
  (t) => ({
    idxShopOrderItemOrder: index('idx_shop_order_item_order').on(t.orderId),
    idxShopOrderItemProduct: index('idx_shop_order_item_product').on(t.productId),
    idxShopOrderItemSku: index('idx_shop_order_item_sku').on(t.skuId),
    idxShopOrderItemDeletedAt: index('idx_shop_order_item_deleted_at').on(t.deletedAt),
  })
)

