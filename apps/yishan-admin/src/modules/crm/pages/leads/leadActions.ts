import type { LeadRow } from '@/services/crm';

/**
 * 线索状态只描述跟进结论，转化状态由 convertedCustomerId 独立表达。
 * 因此所有状态均可继续写跟进和转移；未转化时可转为客户，转化后改为查看客户详情。
 */
export type LeadActionKey =
  | 'view'
  | 'edit'
  | 'followUp'
  | 'transfer'
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
    { key: 'view', label: '查看' },
    { key: 'followUp', label: '写跟进', primary: !lead.convertedCustomerId },
    { key: 'transfer', label: '转移/退回公海' },
    conversionAction,
  ];
}
