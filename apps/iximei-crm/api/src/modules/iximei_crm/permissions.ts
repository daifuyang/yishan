import { registerPermissions, type PermissionRef } from '@yishan/core-api/permissions/catalog'

export const PERMS = Object.freeze({
  HOSPITAL_LIST: { code: 'crm:hospitals:list', label: 'CRM-医院-查看', group: 'crm' }, HOSPITAL_OPTIONS: { code: 'crm:hospitals:options', label: 'CRM-医院-派单选择', group: 'crm' }, HOSPITAL_CREATE: { code: 'crm:hospitals:create', label: 'CRM-医院-新建', group: 'crm' }, HOSPITAL_UPDATE: { code: 'crm:hospitals:update', label: 'CRM-医院-编辑', group: 'crm' }, HOSPITAL_DELETE: { code: 'crm:hospitals:delete', label: 'CRM-医院-删除', group: 'crm' }, HOSPITAL_RENAME: { code: 'crm:hospitals:rename', label: 'CRM-医院-改名(仅系统管理员)', group: 'crm' },
  // 账号管理（启停 / 重置密码 / 修改账号邮箱手机号）独立权限。
  // 与 :update 解耦后,医院账号角色编辑自己医院资料不受影响,
  // 但拿不到"管账号"的入口 —— 见 hospitals.seed 中 hospitalAccount 白名单不再包含该项。
  HOSPITAL_ACCOUNT_MANAGE: { code: 'crm:hospitals:manage-account', label: 'CRM-医院-账号管理', group: 'crm' },
  CUSTOMER_LIST: { code: 'crm:customers:list', label: 'CRM-客户-查看', group: 'crm' }, CUSTOMER_CREATE: { code: 'crm:customers:create', label: 'CRM-客户-新建', group: 'crm' }, CUSTOMER_UPDATE: { code: 'crm:customers:update', label: 'CRM-客户-编辑', group: 'crm' }, CUSTOMER_DELETE: { code: 'crm:customers:delete', label: 'CRM-客户-删除', group: 'crm' }, CUSTOMER_DISPATCH: { code: 'crm:customers:dispatch', label: 'CRM-客户-派单', group: 'crm' },
  DISPATCH_LIST: { code: 'crm:dispatches:list', label: 'CRM-派单-查看', group: 'crm' }, DISPATCH_UPDATE: { code: 'crm:dispatches:update', label: 'CRM-派单-编辑', group: 'crm' }, DISPATCH_DELETE: { code: 'crm:dispatches:delete', label: 'CRM-派单-删除', group: 'crm' }, DISPATCH_REPLY: { code: 'crm:dispatches:reply', label: 'CRM-派单-回复', group: 'crm' }, DISPATCH_LOG: { code: 'crm:dispatches:log', label: 'CRM-派单-跟进', group: 'crm' },
  // 医院账号点眼睛查看派单客户手机号明文 —— 默认脱敏，点击触发记录后才返回明文。
  // super_admin 不需要（本身就返回明文）。
  DISPATCH_VIEW_MOBILE: { code: 'crm:dispatches:view-mobile', label: 'CRM-派单-查看客户手机号', group: 'crm' },
  // super_admin 在派单详情查看「谁在何时查看了哪个派单的手机号」。
  DISPATCH_VIEW_MOBILE_LOGS: { code: 'crm:dispatches:view-mobile-logs', label: 'CRM-派单-手机号查看日志', group: 'crm' },
  MEMBER_LIST: { code: 'crm:members:list', label: 'CRM-会员-查看', group: 'crm' }, MEMBER_CREATE: { code: 'crm:members:create', label: 'CRM-会员-新建', group: 'crm' }, MEMBER_UPDATE: { code: 'crm:members:update', label: 'CRM-会员-编辑', group: 'crm' }, MEMBER_DELETE: { code: 'crm:members:delete', label: 'CRM-会员-删除', group: 'crm' }, MEMBER_REMARK: { code: 'crm:members:remark', label: 'CRM-会员-备注', group: 'crm' }, MEMBER_FOLLOW_UP: { code: 'crm:members:follow_up', label: 'CRM-会员-跟进', group: 'crm' }, MEMBER_ASSIGN: { code: 'crm:members:assign', label: 'CRM-会员-分配', group: 'crm' }, MEMBER_TAG: { code: 'crm:members:tag', label: 'CRM-会员-标签', group: 'crm' }, MEMBER_INVALIDATE: { code: 'crm:members:invalidate', label: 'CRM-会员-作废', group: 'crm' }, MEMBER_RESTORE: { code: 'crm:members:restore', label: 'CRM-会员-恢复', group: 'crm' }, MEMBER_EXPORT: { code: 'crm:members:export', label: 'CRM-会员-导出', group: 'crm' },
  DASHBOARD_VIEW: { code: 'crm:dashboard:view', label: 'CRM-数据看板-查看', group: 'crm' },
  // 医院账号首次访问派单详情自动落 crm_dispatch_view_log 后,
  // super_admin 在派单详情查看的"医院查看日志"（谁在何时打开过该派单）。
  DISPATCH_VIEW_HOSPITAL_LOG: { code: 'crm:dispatches:view-hospital-log', label: 'CRM-派单-查看医院查看日志', group: 'crm' },
  // 医院账号登录后看到的数据看板（汇总该医院的派单 / 客户 / 跟进）。
  HOSPITAL_DASHBOARD_VIEW: { code: 'crm:hospital-dashboard:view', label: 'CRM-医院后台-数据看板', group: 'crm' },
} satisfies Record<string, PermissionRef>)
export type CrmPermission = keyof typeof PERMS

/**
 * 注册 crm 的全部权限码。
 *
 * **不能**在模块顶层调用：上游把权限目录放在 AsyncLocalStorage 作用域里
 * （`@yishan/core-api/permissions/catalog`），离开应用作用域就抛
 * 「Permission operation requires an application scope」。顶层调用会让任何
 * import 到本文件的地方（含单元测试）直接炸。
 *
 * 由 `module.register()` 在应用作用域内调用一次，幂等。
 */
export function registerCrmPermissions(): void {
  registerPermissions(...Object.values(PERMS))
}

