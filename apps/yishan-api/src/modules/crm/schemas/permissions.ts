/**
 * CRM 模块权限声明集中文件。
 *
 * 避免各路由文件重复 registerPermissions() 触发"duplicate permission declaration"，
 * 把所有 crm:* 权限码集中在一个地方声明。
 */

import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'

export const CrmPermissions: { readonly [k: string]: PermissionRef } = Object.freeze({
  DASHBOARD_VIEW: { code: 'crm:dashboard:view', label: 'CRM-工作台-查看', group: 'crm' },

  CUSTOMER_LIST: { code: 'crm:customer:list', label: 'CRM-客户-查看', group: 'crm' },
  CUSTOMER_DETAIL: { code: 'crm:customer:detail', label: 'CRM-客户-详情', group: 'crm' },
  CUSTOMER_CREATE: { code: 'crm:customer:create', label: 'CRM-客户-新建', group: 'crm' },
  CUSTOMER_UPDATE: { code: 'crm:customer:update', label: 'CRM-客户-编辑', group: 'crm' },
  CUSTOMER_DELETE: { code: 'crm:customer:delete', label: 'CRM-客户-删除', group: 'crm' },
  CUSTOMER_CLAIM: { code: 'crm:customer:claim', label: 'CRM-客户-认领', group: 'crm' },
  CUSTOMER_RELEASE: { code: 'crm:customer:release', label: 'CRM-客户-释放', group: 'crm' },
  CUSTOMER_TRANSFER: { code: 'crm:customer:transfer', label: 'CRM-客户-转交', group: 'crm' },

  CONTACT_LIST: { code: 'crm:contact:list', label: 'CRM-联系人-查看', group: 'crm' },
  CONTACT_CREATE: { code: 'crm:contact:create', label: 'CRM-联系人-新建', group: 'crm' },
  CONTACT_UPDATE: { code: 'crm:contact:update', label: 'CRM-联系人-编辑', group: 'crm' },
  CONTACT_DELETE: { code: 'crm:contact:delete', label: 'CRM-联系人-删除', group: 'crm' },

  ACTIVITY_LIST: { code: 'crm:activity:list', label: 'CRM-跟进-查看', group: 'crm' },
  ACTIVITY_CREATE: { code: 'crm:activity:create', label: 'CRM-跟进-新建', group: 'crm' },

  POOL_LIST: { code: 'crm:pool:list', label: 'CRM-公海-查看', group: 'crm' },

  SETTINGS_VIEW: { code: 'crm:settings:view', label: 'CRM-设置-查看', group: 'crm' },
  SETTINGS_UPDATE: { code: 'crm:settings:update', label: 'CRM-设置-编辑', group: 'crm' },
})
registerPermissions(...Object.values(CrmPermissions))
