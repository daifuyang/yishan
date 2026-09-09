/**
 * CRM 模块的种子入口。
 *
 * 编排脚本（scripts/onboard-modules.ts）通过 `seedModule()` 顶层副作用触发本文件：
 *   - 从 ./config/system-menu.json 读取模块菜单树，递归铺平写入 sys_menu
 *   - 把按钮对应的权限码绑到 sys_menu_permission
 *   - 写入 sys_enum 种子数据（11 个 CRM 业务枚举 type 的标准项）
 *
 * 业务数据（客户 / 联系人 / 跟进）由 SQL migration 已经包含初始 status / source / tag 字典；
 * 这里不做额外的"演示客户"插入，避免对生产数据造成干扰。
 */

import { eq, inArray } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { sysEnum, sysMenu, sysMenuPermission, sysUser } from '@/db/schema'
import adminMenu from './config/system-menu.json'

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

async function upsertTree(
  nodes: AdminMenuNode[],
  parentId: number | null,
  creatorId: number,
): Promise<void> {
  for (const decl of nodes) {
    const id = await upsertOne(decl, parentId, creatorId)
    if (decl.children && decl.children.length > 0) {
      await upsertTree(decl.children, id, creatorId)
    }
  }
}

async function upsertOne(
  decl: AdminMenuNode,
  parentId: number | null,
  creatorId: number,
): Promise<number> {
  if (!decl.path) {
    return parentId ?? 0
  }
  const existing = await drizzleDb.query.sysMenu.findFirst({
    where: eq(sysMenu.path, decl.path),
  })
  if (existing) {
    await drizzleDb
      .update(sysMenu)
      .set({
        name: decl.name,
        type: decl.type,
        parentId,
        component: decl.component ?? existing.component,
        icon: decl.icon,
        sortOrder: decl.sortOrder,
        updaterId: creatorId,
        status: 1,
        hideInMenu: toBool(decl.hideInMenu),
      })
      .where(eq(sysMenu.id, existing.id))
    return existing.id
  }
  await drizzleDb.insert(sysMenu).values({
    name: decl.name,
    path: decl.path,
    type: decl.type,
    parentId,
    component: decl.component,
    icon: decl.icon,
    sortOrder: decl.sortOrder ?? 99,
    status: 1,
    hideInMenu: toBool(decl.hideInMenu),
    isDefaultAction: toBool(decl.isDefaultAction),
    isExternalLink: false,
    keepAlive: false,
    creatorId,
    updaterId: creatorId,
  })
  const created = await drizzleDb.query.sysMenu.findFirst({
    where: eq(sysMenu.path, decl.path),
  })
  if (!created) {
    throw new Error(`菜单写入后未找到：${decl.path}`)
  }
  return created.id
}

async function bindMenuPermissions(menuId: number, codes: string[]): Promise<void> {
  if (codes.length === 0) return
  for (const code of codes) {
    await drizzleDb
      .insert(sysMenuPermission)
      .values({ menuId, permissionCode: code })
      .onDuplicateKeyUpdate({ set: { permissionCode: code } })
  }
}

async function bindAllPermissions(flat: FlatNode[], creatorId: number): Promise<void> {
  for (const { node, parentPath } of flat) {
    if (!node.permissionCodes || node.permissionCodes.length === 0) continue
    const anchorPath = node.path ?? parentPath
    if (!anchorPath) {
      throw new Error(`bindAllPermissions 找不到可绑定的菜单行：${node.name}`)
    }
    const row = await drizzleDb.query.sysMenu.findFirst({
      where: eq(sysMenu.path, anchorPath),
    })
    if (!row) {
      throw new Error(`bindAllPermissions 找不到菜单：${anchorPath}`)
    }
    await bindMenuPermissions(row.id, node.permissionCodes)
  }
}

/**
 * CRM 业务枚举种子项。
 *
 * 11 个 type 的标准项；这些值都是业务强约定——变更时需同步更新产品文档 + Phase 计划。
 */
const CRM_ENUM_SEED: ReadonlyArray<{
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

  // crm_customer_status：客户状态
  { type: 'crm_customer_status', code: 'prospect', name: '潜在客户', sort: 10 },
  { type: 'crm_customer_status', code: 'qualified', name: '已签约', sort: 20 },
  { type: 'crm_customer_status', code: 'lost', name: '流失', sort: 30 },
  { type: 'crm_customer_status', code: 'paused', name: '暂停合作', sort: 40 },

  // crm_customer_source：客户来源
  { type: 'crm_customer_source', code: 'referral', name: '客户介绍', sort: 10 },
  { type: 'crm_customer_source', code: 'website', name: '官网咨询', sort: 20 },
  { type: 'crm_customer_source', code: 'exhibition', name: '展会', sort: 30 },
  { type: 'crm_customer_source', code: 'cold_call', name: '陌拜', sort: 40 },
  { type: 'crm_customer_source', code: 'online_ad', name: '线上广告', sort: 50 },
  { type: 'crm_customer_source', code: 'partner', name: '合作伙伴', sort: 60 },
  { type: 'crm_customer_source', code: 'other', name: '其他', sort: 99 },

  // crm_lead_status：线索状态
  { type: 'crm_lead_status', code: 'pending', name: '未处理', sort: 10 },
  { type: 'crm_lead_status', code: 'contact_valid', name: '联系方式有效', sort: 20 },
  { type: 'crm_lead_status', code: 'contact_invalid', name: '联系方式无效', sort: 30 },
  { type: 'crm_lead_status', code: 'closed', name: '已关闭', sort: 40 },

  // crm_opportunity_stage：商机阶段
  { type: 'crm_opportunity_stage', code: 'discover', name: '需求发现', sort: 10 },
  { type: 'crm_opportunity_stage', code: 'qualify', name: '方案确认', sort: 20 },
  { type: 'crm_opportunity_stage', code: 'proposal', name: '报价中', sort: 30 },
  { type: 'crm_opportunity_stage', code: 'negotiation', name: '商务谈判', sort: 40 },
  { type: 'crm_opportunity_stage', code: 'won', name: '赢单', sort: 50 },
  { type: 'crm_opportunity_stage', code: 'lost', name: '丢单', sort: 60 },

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

  // crm_ticket_priority
  { type: 'crm_ticket_priority', code: 'P0', name: 'P0 紧急', sort: 10 },
  { type: 'crm_ticket_priority', code: 'P1', name: 'P1 高', sort: 20 },
  { type: 'crm_ticket_priority', code: 'P2', name: 'P2 中', sort: 30 },
  { type: 'crm_ticket_priority', code: 'P3', name: 'P3 低', sort: 40 },

  // crm_ticket_type
  { type: 'crm_ticket_type', code: 'consult', name: '咨询', sort: 10 },
  { type: 'crm_ticket_type', code: 'complaint', name: '投诉', sort: 20 },
  { type: 'crm_ticket_type', code: 'aftersales', name: '售后', sort: 30 },
  { type: 'crm_ticket_type', code: 'other', name: '其他', sort: 99 },

  // crm_payment_method
  { type: 'crm_payment_method', code: 'bank_transfer', name: '银行转账', sort: 10 },
  { type: 'crm_payment_method', code: 'alipay', name: '支付宝', sort: 20 },
  { type: 'crm_payment_method', code: 'wechat', name: '微信', sort: 30 },
  { type: 'crm_payment_method', code: 'cash', name: '现金', sort: 40 },
  { type: 'crm_payment_method', code: 'check', name: '支票', sort: 50 },
  { type: 'crm_payment_method', code: 'other', name: '其他', sort: 99 },

  // crm_contact_role
  { type: 'crm_contact_role', code: 'decision_maker', name: '最终决策人', sort: 10 },
  { type: 'crm_contact_role', code: 'influencer', name: '影响者', sort: 20 },
  { type: 'crm_contact_role', code: 'user', name: '使用者', sort: 30 },
  { type: 'crm_contact_role', code: 'contact', name: '普通联系人', sort: 40 },

  // crm_contact_status
  { type: 'crm_contact_status', code: 'active', name: '在职', sort: 10 },
  { type: 'crm_contact_status', code: 'paused', name: '暂时联系不上', sort: 20 },
  { type: 'crm_contact_status', code: 'invalid', name: '已离职/失效', sort: 30 },
]

async function seedCrmEnums(creatorId: number): Promise<void> {
  // 已有 type+code 的不写；不存在的插入。
  // 用批量 SELECT 把"已存在"提前拉出来，减少 N+1。
  const types = [...new Set(CRM_ENUM_SEED.map((s) => s.type))]
  const existing = await drizzleDb
    .select({ type: sysEnum.type, code: sysEnum.code })
    .from(sysEnum)
    .where(inArray(sysEnum.type, types))
  const existSet = new Set(existing.map((e) => `${e.type}::${e.code}`))

  const toInsert = CRM_ENUM_SEED
    .filter((s) => !existSet.has(`${s.type}::${s.code}`))
    .map((s) => ({
      type: s.type,
      code: s.code,
      name: s.name,
      sort: s.sort,
      enabled: 1,
      remark: s.remark ?? null,
      creatorId,
      updaterId: creatorId,
    }))
  if (toInsert.length === 0) {
    console.log('crm seed: sys_enum 已有种子，无需插入')
    return
  }
  await drizzleDb.insert(sysEnum).values(toInsert)
  console.log(`crm seed: 已插入 ${toInsert.length} 条 sys_enum 种子项`)
}

export default async function seedCrm(): Promise<void> {
  const [admin] = await drizzleDb
    .select({ id: sysUser.id })
    .from(sysUser)
    .where(eq(sysUser.username, 'admin'))
    .limit(1)
  const creatorId = admin?.id ?? 1

  await seedCrmEnums(creatorId)
  await upsertTree(menuTree, null, creatorId)
  const flat = flattenMenuTree(menuTree)
  await bindAllPermissions(flat, creatorId)

  console.log('crm seed: 菜单已写入（递归铺平自 ./config/system-menu.json）')
}

if (require.main === module) {
  seedCrm().catch((err) => {
    console.error('[crm seed] 异常退出:', err)
    process.exit(1)
  })
}
