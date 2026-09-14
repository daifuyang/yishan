export type StatusSemantic = 'default' | 'processing' | 'warning' | 'success' | 'error'

export type StatusDescriptor<TValue extends string = string> = Readonly<{
  value: TValue
  label: string
  semantic: StatusSemantic
}>

export const CUSTOMER_STATUSES = [
  { value: 'potential', label: '潜在客户', semantic: 'default' },
  { value: 'following', label: '跟进中', semantic: 'processing' },
  { value: 'opportunity', label: '商机客户', semantic: 'warning' },
  { value: 'customer', label: '正式客户', semantic: 'success' },
  { value: 'lost', label: '已流失', semantic: 'error' },
] as const satisfies readonly StatusDescriptor[]

export const OPPORTUNITY_STAGES = [
  { value: 'discover', label: '需求发现', semantic: 'default' },
  { value: 'qualify', label: '方案确认', semantic: 'processing' },
  { value: 'proposal', label: '方案报价', semantic: 'warning' },
  { value: 'negotiation', label: '商务谈判', semantic: 'warning' },
  { value: 'won', label: '赢单', semantic: 'success' },
] as const satisfies readonly StatusDescriptor[]

export const QUOTATION_STATUSES = [
  { value: 'draft', label: '草稿', semantic: 'default' },
  { value: 'sent', label: '已发送', semantic: 'processing' },
  { value: 'accepted', label: '已接受', semantic: 'success' },
  { value: 'rejected', label: '已拒绝', semantic: 'error' },
  { value: 'voided', label: '已作废', semantic: 'default' },
  { value: 'superseded', label: '已被新版替代', semantic: 'default' },
] as const satisfies readonly StatusDescriptor[]

export const CONTRACT_STATUSES = [
  { value: 'draft', label: '草稿', semantic: 'default' },
  { value: 'pending', label: '待生效', semantic: 'warning' },
  { value: 'active', label: '履约中', semantic: 'processing' },
  { value: 'completed', label: '已完成', semantic: 'success' },
  { value: 'voided', label: '已作废', semantic: 'error' },
] as const satisfies readonly StatusDescriptor[]

export const TASK_STATUSES = [
  { value: 'todo', label: '待处理', semantic: 'default' },
  { value: 'in_progress', label: '进行中', semantic: 'processing' },
  { value: 'completed', label: '已完成', semantic: 'success' },
  { value: 'cancelled', label: '已取消', semantic: 'error' },
] as const satisfies readonly StatusDescriptor[]

export type CustomerStatusCode = (typeof CUSTOMER_STATUSES)[number]['value']
export type OpportunityStageCode = (typeof OPPORTUNITY_STAGES)[number]['value']
export type QuotationStatusCode = (typeof QUOTATION_STATUSES)[number]['value']
export type ContractStatusCode = (typeof CONTRACT_STATUSES)[number]['value']
export type TaskStatusCode = (typeof TASK_STATUSES)[number]['value']

export function isCustomerStatusCode(value: string): value is CustomerStatusCode {
  return CUSTOMER_STATUSES.some((status) => status.value === value)
}

export function getCustomerStatusLabel(value: string | null): string | null {
  return CUSTOMER_STATUSES.find((status) => status.value === value)?.label ?? null
}
