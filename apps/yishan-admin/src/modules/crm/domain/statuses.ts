export type StatusSemantic = 'default' | 'processing' | 'warning' | 'success' | 'error';

export interface StatusDescriptor {
  value: string;
  label: string;
  semantic: StatusSemantic;
}

export const OPPORTUNITY_STAGES: StatusDescriptor[] = [
  { value: 'discover', label: '需求发现', semantic: 'default' },
  { value: 'qualify', label: '方案确认', semantic: 'processing' },
  { value: 'proposal', label: '方案报价', semantic: 'warning' },
  { value: 'negotiation', label: '商务谈判', semantic: 'warning' },
  { value: 'won', label: '赢单', semantic: 'success' },
  { value: 'lost', label: '已流失', semantic: 'error' },
];
export const QUOTATION_STATUSES: StatusDescriptor[] = [
  { value: 'draft', label: '草稿', semantic: 'default' }, { value: 'sent', label: '已发送', semantic: 'processing' }, { value: 'accepted', label: '已接受', semantic: 'success' }, { value: 'rejected', label: '已拒绝', semantic: 'error' }, { value: 'voided', label: '已作废', semantic: 'default' }, { value: 'superseded', label: '已被新版替代', semantic: 'default' },
];
export const CONTRACT_STATUSES: StatusDescriptor[] = [
  { value: 'draft', label: '草稿', semantic: 'default' }, { value: 'performing', label: '履约中', semantic: 'processing' }, { value: 'completed', label: '已完成', semantic: 'success' }, { value: 'terminated', label: '已终止', semantic: 'error' },
];
export const TASK_STATUSES: StatusDescriptor[] = [
  { value: 'todo', label: '待处理', semantic: 'default' }, { value: 'in_progress', label: '进行中', semantic: 'processing' }, { value: 'completed', label: '已完成', semantic: 'success' }, { value: 'cancelled', label: '已取消', semantic: 'error' },
];

export function statusOf(value: string, statuses: StatusDescriptor[]): StatusDescriptor {
  return statuses.find((item) => item.value === value) ?? { value, label: value, semantic: 'default' };
}
