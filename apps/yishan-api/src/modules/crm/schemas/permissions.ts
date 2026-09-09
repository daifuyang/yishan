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
  CUSTOMER_MEMBER_MANAGE: {
    code: 'crm:customer:member',
    label: 'CRM-客户-协同人管理',
    group: 'crm',
  },
  CUSTOMER_TRASH: { code: 'crm:customer:trash', label: 'CRM-客户-回收站', group: 'crm' },
  CUSTOMER_RESTORE: { code: 'crm:customer:restore', label: 'CRM-客户-恢复', group: 'crm' },
  // 永久删除单独一个权限码：不复用 delete，避免"能软删的人顺手就能抹掉数据"
  CUSTOMER_PURGE: { code: 'crm:customer:purge', label: 'CRM-客户-永久删除', group: 'crm' },

  CONTACT_LIST: { code: 'crm:contact:list', label: 'CRM-联系人-查看', group: 'crm' },
  CONTACT_CREATE: { code: 'crm:contact:create', label: 'CRM-联系人-新建', group: 'crm' },
  CONTACT_UPDATE: { code: 'crm:contact:update', label: 'CRM-联系人-编辑', group: 'crm' },
  CONTACT_DELETE: { code: 'crm:contact:delete', label: 'CRM-联系人-删除', group: 'crm' },

  ACTIVITY_LIST: { code: 'crm:activity:list', label: 'CRM-跟进-查看', group: 'crm' },
  ACTIVITY_CREATE: { code: 'crm:activity:create', label: 'CRM-跟进-新建', group: 'crm' },
  ACTIVITY_UPDATE: { code: 'crm:activity:update', label: 'CRM-跟进-编辑', group: 'crm' },
  ACTIVITY_DELETE: { code: 'crm:activity:delete', label: 'CRM-跟进-删除', group: 'crm' },

  LEAD_LIST: { code: 'crm:lead:list', label: 'CRM-线索-查看', group: 'crm' },
  LEAD_CREATE: { code: 'crm:lead:create', label: 'CRM-线索-新建', group: 'crm' },
  LEAD_UPDATE: { code: 'crm:lead:update', label: 'CRM-线索-编辑资料', group: 'crm' },
  LEAD_DELETE: { code: 'crm:lead:delete', label: 'CRM-线索-删除', group: 'crm' },
  LEAD_CLAIM: { code: 'crm:lead:claim', label: 'CRM-线索-领取', group: 'crm' },
  LEAD_ASSIGN: { code: 'crm:lead:assign', label: 'CRM-线索-转移', group: 'crm' },
  LEAD_RETURN_TO_POOL: { code: 'crm:lead:return', label: 'CRM-线索-退回公海', group: 'crm' },
  LEAD_QUALIFY: { code: 'crm:lead:qualify', label: 'CRM-线索-判定', group: 'crm' },
  LEAD_DISQUALIFY: { code: 'crm:lead:disqualify', label: 'CRM-线索-作废', group: 'crm' },
  LEAD_REACTIVATE: { code: 'crm:lead:reactivate', label: 'CRM-线索-重新激活', group: 'crm' },
  LEAD_CONVERT: { code: 'crm:lead:convert', label: 'CRM-线索-转为客户', group: 'crm' },

  POOL_LIST: { code: 'crm:pool:list', label: 'CRM-公海-查看', group: 'crm' },

  /* ─── Product Catalog (Phase 2) ─────── */
  PRODUCT_LIST: { code: 'crm:product:list', label: 'CRM-产品-查看', group: 'crm' },
  PRODUCT_CREATE: { code: 'crm:product:create', label: 'CRM-产品-新建', group: 'crm' },
  PRODUCT_UPDATE: { code: 'crm:product:update', label: 'CRM-产品-编辑', group: 'crm' },
  PRODUCT_DELETE: { code: 'crm:product:delete', label: 'CRM-产品-删除', group: 'crm' },
  PRODUCT_ENABLE: { code: 'crm:product:enable', label: 'CRM-产品-启停', group: 'crm' },
  PRODUCT_CATEGORY_MANAGE: {
    code: 'crm:product:category',
    label: 'CRM-产品-分类管理',
    group: 'crm',
  },
  PRODUCT_UNIT_MANAGE: {
    code: 'crm:product:unit',
    label: 'CRM-产品-单位管理',
    group: 'crm',
  },

  SETTINGS_VIEW: { code: 'crm:settings:view', label: 'CRM-设置-查看', group: 'crm' },
  SETTINGS_UPDATE: { code: 'crm:settings:update', label: 'CRM-设置-编辑', group: 'crm' },

  /* ─── Quotation (Phase 2) ───────────────── */
  QUOTATION_LIST: { code: 'crm:quotation:list', label: 'CRM-报价-查看', group: 'crm' },
  QUOTATION_CREATE: { code: 'crm:quotation:create', label: 'CRM-报价-新建', group: 'crm' },
  QUOTATION_UPDATE: { code: 'crm:quotation:update', label: 'CRM-报价-编辑', group: 'crm' },
  QUOTATION_DELETE: { code: 'crm:quotation:delete', label: 'CRM-报价-删除', group: 'crm' },
  QUOTATION_SEND: { code: 'crm:quotation:send', label: 'CRM-报价-发送', group: 'crm' },
  QUOTATION_ACCEPT: { code: 'crm:quotation:accept', label: 'CRM-报价-接受', group: 'crm' },
  QUOTATION_REJECT: { code: 'crm:quotation:reject', label: 'CRM-报价-拒绝', group: 'crm' },
  QUOTATION_VOID: { code: 'crm:quotation:void', label: 'CRM-报价-作废', group: 'crm' },

  /* ─── Opportunity (Phase 2) ─────────────── */
  OPPORTUNITY_LIST: { code: 'crm:opportunity:list', label: 'CRM-商机-查看', group: 'crm' },
  OPPORTUNITY_CREATE: { code: 'crm:opportunity:create', label: 'CRM-商机-新建', group: 'crm' },
  OPPORTUNITY_UPDATE: { code: 'crm:opportunity:update', label: 'CRM-商机-编辑', group: 'crm' },
  OPPORTUNITY_DELETE: { code: 'crm:opportunity:delete', label: 'CRM-商机-删除', group: 'crm' },
  OPPORTUNITY_STAGE: { code: 'crm:opportunity:stage', label: 'CRM-商机-阶段推进', group: 'crm' },
  OPPORTUNITY_WON: { code: 'crm:opportunity:won', label: 'CRM-商机-赢单', group: 'crm' },
  OPPORTUNITY_LOST: { code: 'crm:opportunity:lost', label: 'CRM-商机-丢单', group: 'crm' },
  OPPORTUNITY_TRANSFER: { code: 'crm:opportunity:transfer', label: 'CRM-商机-转移', group: 'crm' },

  /* ─── Contract (Phase 3) ────────────────── */
  CONTRACT_LIST: { code: 'crm:contract:list', label: 'CRM-合同-查看', group: 'crm' },
  CONTRACT_CREATE: { code: 'crm:contract:create', label: 'CRM-合同-新建', group: 'crm' },
  CONTRACT_UPDATE: { code: 'crm:contract:update', label: 'CRM-合同-编辑', group: 'crm' },
  CONTRACT_DELETE: { code: 'crm:contract:delete', label: 'CRM-合同-删除', group: 'crm' },
  CONTRACT_PAYMENT_VIEW: { code: 'crm:contract:payment', label: 'CRM-合同-回款查看', group: 'crm' },
  CONTRACT_PAYMENT_MANAGE: { code: 'crm:contract:payment-manage', label: 'CRM-合同-回款登记', group: 'crm' },
})
registerPermissions(...Object.values(CrmPermissions))
