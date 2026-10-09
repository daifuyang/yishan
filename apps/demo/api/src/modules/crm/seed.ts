/**
 * CRM 模块的种子入口。
 *
 * 当前菜单、权限和枚举声明经公开 System 服务补写，保留已有数据和授权。
 *
 * 业务数据（客户 / 联系人 / 跟进）由 SQL migration 已经包含初始 status / source / tag 字典；
 * 这里不做额外的"演示客户"插入，避免对生产数据造成干扰。
 */

import { resolveSeedActor, seedModuleMenus, seedModuleEnums, type MenuSeedNode } from '@yishan/core-system-api'
import adminMenu from './config/system-menu.json'
import {
  CONTRACT_STATUSES,
  CUSTOMER_STATUSES,
  FOLLOW_UP_RESULTS,
  FOLLOW_UP_TYPES,
  OPPORTUNITY_STAGES,
  QUOTATION_STATUSES,
  TASK_STATUSES,
} from './domain/statuses.js'

export type AdminMenuNode = {
  type: 0 | 1 | 2
  name: string
  path?: string
  sortOrder: number
  icon?: string
  component?: string
  hideInMenu?: 0 | 1
  permissionCodes?: string[]
  isDefaultAction?: 0 | 1
  children?: AdminMenuNode[]
}

const menuTree = adminMenu as AdminMenuNode[]
export const toBool = (n: 0 | 1 | undefined): boolean => n === 1

export const RETIRED_CRM_ENUM_TYPES = ['crm_lead_status'] as const

export type FlatNode = {
  node: AdminMenuNode
  depth: number
  parentPath: string | null
}

export function flattenMenuTree(nodes: AdminMenuNode[]): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (list: AdminMenuNode[], depth: number, parentPath: string | null): void => {
    for (const node of list) {
      const myPath = node.path ?? parentPath
      out.push({ node, depth, parentPath })
      if (node.children && node.children.length > 0) {
        walk(node.children, depth + 1, myPath)
      }
    }
  }
  walk(nodes, 0, null)
  return out
}

function toMenuSeedNodes(nodes: AdminMenuNode[]): MenuSeedNode[] {
  return nodes.map((node) => ({
    ...node,
    hideInMenu: toBool(node.hideInMenu),
    isDefaultAction: toBool(node.isDefaultAction),
    children: node.children ? toMenuSeedNodes(node.children) : undefined,
  }))
}

/**
 * CRM 业务枚举种子项。
 *
 * 11 个 type 的标准项；这些值都是业务强约定——变更时需同步更新产品文档 + Phase 计划。
 */
export const CRM_ENUM_SEED: ReadonlyArray<{
  type: string
  code: string
  name: string
  sort: number
  remark?: string
}> = [
  // crm_industry：行业字典（前端下拉）
  { type: 'crm_industry', code: 'manufacturing', name: '制造业', sort: 10 },
  { type: 'crm_industry', code: 'it', name: 'IT/互联网', sort: 20 },
  { type: 'crm_industry', code: 'finance', name: '金融', sort: 30 },
  { type: 'crm_industry', code: 'education', name: '教育', sort: 40 },
  { type: 'crm_industry', code: 'medical', name: '医疗', sort: 50 },
  { type: 'crm_industry', code: 'retail', name: '零售/电商', sort: 60 },
  { type: 'crm_industry', code: 'government', name: '政府/公共', sort: 70 },
  { type: 'crm_industry', code: 'other', name: '其他', sort: 99 },

  // crm_customer_level：客户级别（A/B/C/D）
  { type: 'crm_customer_level', code: 'A', name: 'A 类（重点）', sort: 10 },
  { type: 'crm_customer_level', code: 'B', name: 'B 类（潜在）', sort: 20 },
  { type: 'crm_customer_level', code: 'C', name: 'C 类（一般）', sort: 30 },
  { type: 'crm_customer_level', code: 'D', name: 'D 类（低优先）', sort: 40 },

  // crm_customer_status：客户生命周期
  ...CUSTOMER_STATUSES.map((status, index) => ({
    type: 'crm_customer_status',
    code: status.value,
    name: status.label,
    sort: (index + 1) * 10,
  })),

  // crm_customer_source：客户来源
  { type: 'crm_customer_source', code: 'referral', name: '客户介绍', sort: 10 },
  { type: 'crm_customer_source', code: 'website', name: '官网咨询', sort: 20 },
  { type: 'crm_customer_source', code: 'exhibition', name: '展会', sort: 30 },
  { type: 'crm_customer_source', code: 'cold_call', name: '陌拜', sort: 40 },
  { type: 'crm_customer_source', code: 'online_ad', name: '线上广告', sort: 50 },
  { type: 'crm_customer_source', code: 'partner', name: '合作伙伴', sort: 60 },
  { type: 'crm_customer_source', code: 'other', name: '其他', sort: 99 },

  // crm_opportunity_stage：商机阶段
  ...OPPORTUNITY_STAGES.map((stage, index) => ({
    type: 'crm_opportunity_stage',
    code: stage.value,
    name: stage.label,
    sort: (index + 1) * 10,
  })),

  // crm_opportunity_pipeline：管道
  { type: 'crm_opportunity_pipeline', code: 'standard', name: '标准销售管道', sort: 10 },
  { type: 'crm_opportunity_pipeline', code: 'key_account', name: '大客户管道', sort: 20 },
  { type: 'crm_opportunity_pipeline', code: 'renewal', name: '续约管道', sort: 30 },

  // crm_opportunity_lost_reason
  { type: 'crm_opportunity_lost_reason', code: 'price', name: '价格过高', sort: 10 },
  { type: 'crm_opportunity_lost_reason', code: 'competitor', name: '竞品胜出', sort: 20 },
  { type: 'crm_opportunity_lost_reason', code: 'no_budget', name: '客户无预算', sort: 30 },
  { type: 'crm_opportunity_lost_reason', code: 'no_need', name: '需求不匹配', sort: 40 },
  { type: 'crm_opportunity_lost_reason', code: 'delayed', name: '项目延期', sort: 50 },
  { type: 'crm_opportunity_lost_reason', code: 'other', name: '其他', sort: 99 },

  // crm_visit_result
  { type: 'crm_visit_result', code: 'successful', name: '有效拜访', sort: 10 },
  { type: 'crm_visit_result', code: 'no_show', name: '客户未到场', sort: 20 },
  { type: 'crm_visit_result', code: 'rescheduled', name: '改约', sort: 30 },
  { type: 'crm_visit_result', code: 'invalid_contact', name: '联系方式失效', sort: 40 },

  // crm_payment_method
  { type: 'crm_payment_method', code: 'bank_transfer', name: '银行转账', sort: 10 },
  { type: 'crm_payment_method', code: 'alipay', name: '支付宝', sort: 20 },
  { type: 'crm_payment_method', code: 'wechat', name: '微信', sort: 30 },
  { type: 'crm_payment_method', code: 'cash', name: '现金', sort: 40 },
  { type: 'crm_payment_method', code: 'check', name: '支票', sort: 50 },
  { type: 'crm_payment_method', code: 'other', name: '其他', sort: 99 },

  // crm_contact_role
  { type: 'crm_contact_role', code: 'decision_maker', name: '决策人', sort: 10 },
  { type: 'crm_contact_role', code: 'influencer', name: '影响人', sort: 20 },
  { type: 'crm_contact_role', code: 'user', name: '使用人', sort: 30 },
  { type: 'crm_contact_role', code: 'contact', name: '经办人', sort: 40 },
  { type: 'crm_contact_role', code: 'other', name: '其他', sort: 50 },

  // crm_contact_status
  { type: 'crm_contact_status', code: 'active', name: '在职', sort: 10 },
  { type: 'crm_contact_status', code: 'paused', name: '暂时联系不上', sort: 20 },
  { type: 'crm_contact_status', code: 'invalid', name: '已离职/失效', sort: 30 },
  ...QUOTATION_STATUSES.map((status, index) => ({
    type: 'crm_quotation_status',
    code: status.value,
    name: status.label,
    sort: (index + 1) * 10,
  })),
  ...CONTRACT_STATUSES.map((status, index) => ({
    type: 'crm_contract_status',
    code: status.value,
    name: status.label,
    sort: (index + 1) * 10,
  })),
  ...TASK_STATUSES.map((status, index) => ({
    type: 'crm_task_status',
    code: status.value,
    name: status.label,
    sort: (index + 1) * 10,
  })),
  ...FOLLOW_UP_TYPES.map((item, index) => ({
    type: 'crm_follow_up_type',
    code: item.value,
    name: item.label,
    sort: (index + 1) * 10,
  })),
  ...FOLLOW_UP_RESULTS.map((item, index) => ({
    type: 'crm_follow_up_result',
    code: item.value,
    name: item.label,
    sort: (index + 1) * 10,
  })),
]

export default async function seedCrm(): Promise<void> {
  const admin = await resolveSeedActor()
  const creatorId = admin?.id ?? 1

  await seedModuleEnums('crm', CRM_ENUM_SEED, creatorId)
  await seedModuleMenus('crm', toMenuSeedNodes(menuTree), creatorId)

  console.log('crm seed: 菜单已写入（递归铺平自 ./config/system-menu.json）')
}
