import type { LeadRow } from '@/services/crm';

/**
 * 线索状态只描述跟进结论，转化状态由 convertedCustomerId 独立表达。
 *
 * 更多菜单约定（break change：写跟进不在此处展示，跟进由详情抽屉内的
 * ActivityRail 入口承担）：
 *   1. 转为客户（已转化则改为「查看客户详情」）
 *   2. 转交给同事
 *   3. 退回线索池
 *
 * 「查看」由行内 [查看] 链接承担（与行 click 等价，打开 LeadDetailDrawer）；
 * 「编辑」由行内 [编辑] 链接 + LeadDetailDrawer 的 onEditLead 入口使用。
 * 两者都不在更多菜单里。
 */
export type LeadActionKey =
  | 'view'
  | 'edit'
  | 'transfer'
  | 'returnToPool'
  | 'convert'
  | 'openCustomer';

export interface LeadAction {
  key: LeadActionKey;
  label: string;
  danger?: boolean;
  primary?: boolean;
}

export function getLeadActions(lead: LeadRow): LeadAction[] {
  const conversionAction: LeadAction =
    lead.convertedCustomerId === null
      ? { key: 'convert', label: '转为客户', primary: true }
      : { key: 'openCustomer', label: '查看客户详情', primary: true };

  return [
    conversionAction,
    { key: 'transfer', label: '转交给同事' },
    { key: 'returnToPool', label: '退回线索池' },
  ];
}
