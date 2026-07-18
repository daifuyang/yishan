// Generated from drizzle/*.sql. Do not edit manually.
import { boolean, date, datetime, int, json, text, tinyint, varchar, index, mysqlTable, uniqueIndex } from 'drizzle-orm/mysql-core'
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

export const iximeiCrmHospital = mysqlTable(
  'iximei_crm_hospital',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  accountUserId: int('account_user_id'),
  hospitalName: varchar('hospital_name', { length: 100 }).notNull(),
  provinceId: int('province_id'),
  cityId: int('city_id'),
  districtId: int('district_id'),
  hospitalAddress: varchar('hospital_address', { length: 255 }),
  hospitalPhone: varchar('hospital_phone', { length: 50 }),
  hospitalSelling: varchar('hospital_selling', { length: 255 }),
  hospitalWebsite: varchar('hospital_website', { length: 255 }),
  hospitalNature: tinyint('hospital_nature').notNull().default(-1),
  doctorName: varchar('doctor_name', { length: 50 }),
  doctorPhone: varchar('doctor_phone', { length: 50 }),
  doctorQq: varchar('doctor_qq', { length: 50 }),
  receptionName: varchar('reception_name', { length: 50 }),
  receptionPhone: varchar('reception_phone', { length: 50 }),
  receptionQq: varchar('reception_qq', { length: 50 }),
  busStation: varchar('bus_station', { length: 100 }),
  busAddress: varchar('bus_address', { length: 255 }),
  subwayStation: varchar('subway_station', { length: 100 }),
  subwayAddress: varchar('subway_address', { length: 255 }),
  taxiFare: varchar('taxi_fare', { length: 50 }),
  vipDiscount: varchar('vip_discount', { length: 255 }),
  returnPoint: varchar('return_point', { length: 50 }),
  hospitalIntroduction: text('hospital_introduction'),
  contractPhotos: json('contract_photos'),
  wechatOpenid: varchar('wechat_openid', { length: 64 }),
  status: tinyint('status').notNull().default(1),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  }
)

export const iximeiCrmCustomerStatus = mysqlTable(
  'iximei_crm_customer_status',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  }
)

export const iximeiCrmCustomer = mysqlTable(
  'iximei_crm_customer',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  numberId: varchar('number_id', { length: 20 }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  gender: tinyint('gender').notNull().default(0),
  birthday: date('birthday', { mode: 'date' }),
  telphone: varchar('telphone', { length: 20 }),
  mobile: varchar('mobile', { length: 20 }),
  qq: varchar('qq', { length: 20 }),
  wechat: varchar('wechat', { length: 50 }),
  provinceId: int('province_id'),
  cityId: int('city_id'),
  districtId: int('district_id'),
  address: varchar('address', { length: 255 }),
  plastic: varchar('plastic', { length: 255 }),
  statusId: int('status_id').notNull(),
  remark: text('remark'),
  ownerUserId: int('owner_user_id').notNull(),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  }
)

export const iximeiCrmCustomerRemark = mysqlTable(
  'iximei_crm_customer_remark',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  customerId: int('customer_id').notNull(),
  userId: int('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  }
)

export const iximeiCrmCustomerBrowse = mysqlTable(
  'iximei_crm_customer_browse',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  customerId: int('customer_id').notNull(),
  userId: int('user_id').notNull(),
  action: varchar('action', { length: 20 }).notNull().default('view'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  }
)

export const iximeiCrmDispatchStatus = mysqlTable(
  'iximei_crm_dispatch_status',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  }
)

export const iximeiCrmDispatch = mysqlTable(
  'iximei_crm_dispatch',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  customerId: int('customer_id').notNull(),
  hospitalId: int('hospital_id').notNull(),
  statusId: int('status_id').notNull(),
  image: varchar('image', { length: 500 }),
  receiveQq: varchar('receive_qq', { length: 50 }),
  receiveWechat: varchar('receive_wechat', { length: 50 }),
  finishedAt: datetime('finished_at', { mode: 'date' }),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  }
)

export const iximeiCrmDispatchReply = mysqlTable(
  'iximei_crm_dispatch_reply',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  dispatchId: int('dispatch_id').notNull(),
  userId: int('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  }
)

export const iximeiCrmDispatchFollowLog = mysqlTable(
  'iximei_crm_dispatch_follow_log',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  dispatchId: int('dispatch_id').notNull(),
  userId: int('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  }
)

export const iximeiCrmMemberCustomer = mysqlTable(
  'iximei_crm_member_customer',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  numberId: varchar('number_id', { length: 20 }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  gender: tinyint('gender').notNull().default(0),
  birthday: date('birthday', { mode: 'date' }),
  address: varchar('address', { length: 255 }),
  mobile: varchar('mobile', { length: 20 }),
  project: varchar('project', { length: 255 }),
  ownerUserId: int('owner_user_id').notNull(),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int('version').notNull().default(1),
  }
)

export const iximeiCrmMemberRemark = mysqlTable(
  'iximei_crm_member_remark',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  memberId: int('member_id').notNull(),
  userId: int('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  }
)

export const iximeiCrmMemberBrowse = mysqlTable(
  'iximei_crm_member_browse',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  memberId: int('member_id').notNull(),
  userId: int('user_id').notNull(),
  action: varchar('action', { length: 20 }).notNull().default('view'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  }
)

export const iximeiCrmHospitalAccount = mysqlTable(
  'iximei_crm_hospital_account',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  hospitalId: int('hospital_id').notNull(),
  userId: int('user_id').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  status: tinyint('status').notNull().default(1),
  remark: varchar('remark', { length: 255 }),
  creatorId: int('creator_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updaterId: int('updater_id').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  }
)

