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
  { value: 'won', label: '已成交', semantic: 'success' },
  { value: 'lost', label: '已流失', semantic: 'error' },
] as const satisfies readonly StatusDescriptor[]

export const OPPORTUNITY_STAGES = [
  { value: 'needs_confirmation', label: '需求确认', semantic: 'processing' },
  { value: 'solution', label: '方案沟通', semantic: 'processing' },
  { value: 'quotation', label: '商务报价', semantic: 'processing' },
  { value: 'negotiation', label: '商务谈判', semantic: 'warning' },
  { value: 'won', label: '赢单', semantic: 'success' },
  { value: 'lost', label: '输单', semantic: 'error' },
] as const satisfies readonly StatusDescriptor[]

export const QUOTATION_STATUSES = [
  { value: 'draft', label: '草稿', semantic: 'default' },
  { value: 'sent', label: '已发送', semantic: 'processing' },
  { value: 'accepted', label: '已确认', semantic: 'success' },
  { value: 'rejected', label: '已拒绝', semantic: 'error' },
  { value: 'voided', label: '已作废', semantic: 'default' },
  { value: 'superseded', label: '已被新版替代', semantic: 'default' },
] as const satisfies readonly StatusDescriptor[]

export const CONTRACT_STATUSES = [
  { value: 'draft', label: '草稿', semantic: 'default' },
  { value: 'performing', label: '履约中', semantic: 'processing' },
  { value: 'completed', label: '已完成', semantic: 'success' },
  { value: 'terminated', label: '已终止', semantic: 'error' },
] as const satisfies readonly StatusDescriptor[]

export const TASK_STATUSES = [
  { value: 'todo', label: '待处理', semantic: 'default' },
  { value: 'in_progress', label: '进行中', semantic: 'processing' },
  { value: 'completed', label: '已完成', semantic: 'success' },
  { value: 'cancelled', label: '已取消', semantic: 'error' },
] as const satisfies readonly StatusDescriptor[]

export type CustomerStatusCode = (typeof CUSTOMER_STATUSES)[number]['value']
export const RELATIONSHIP_STATUSES = ['potential', 'following', 'lost'] as const
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number]
export type OpportunityStageCode = (typeof OPPORTUNITY_STAGES)[number]['value']
export const OPEN_OPPORTUNITY_STAGES = OPPORTUNITY_STAGES.filter(
  (stage) => stage.value !== 'won' && stage.value !== 'lost',
)
export const OPEN_OPPORTUNITY_STAGE_VALUES = OPEN_OPPORTUNITY_STAGES.map(
  (stage) => stage.value,
)
export type QuotationStatusCode = (typeof QUOTATION_STATUSES)[number]['value']
export type ContractStatusCode = (typeof CONTRACT_STATUSES)[number]['value']
export type TaskStatusCode = (typeof TASK_STATUSES)[number]['value']

export const ACTIVITY_CATEGORIES = [
  { value: 'follow_up', label: '人工跟进', semantic: 'processing' },
  { value: 'system', label: '系统事件', semantic: 'default' },
  { value: 'business', label: '业务事件', semantic: 'warning' },
] as const satisfies readonly StatusDescriptor[]

export const FOLLOW_UP_TYPES = [
  { value: 'phone', label: '电话', semantic: 'processing' },
  { value: 'wechat', label: '微信', semantic: 'processing' },
  { value: 'visit', label: '拜访', semantic: 'processing' },
  { value: 'email', label: '邮件', semantic: 'processing' },
  { value: 'meeting', label: '会议', semantic: 'processing' },
  { value: 'other', label: '其他', semantic: 'default' },
] as const satisfies readonly StatusDescriptor[]

export const FOLLOW_UP_RESULTS = [
  { value: 'continue', label: '待继续跟进', semantic: 'processing' },
  { value: 'interested', label: '有明确意向', semantic: 'warning' },
  { value: 'not_now', label: '暂不考虑', semantic: 'default' },
  { value: 'unreachable', label: '无法联系', semantic: 'error' },
  { value: 'invalid', label: '无效客户', semantic: 'error' },
] as const satisfies readonly StatusDescriptor[]

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]['value']
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number]['value']
export type FollowUpResult = (typeof FOLLOW_UP_RESULTS)[number]['value']

const FOLLOW_UP_TYPE_VALUES = new Set<string>(FOLLOW_UP_TYPES.map((item) => item.value))
const SYSTEM_ACTIVITY_TYPES = new Set([
  'status_change',
  'owner_change',
  'qualification',
  'profile_edit',
  'customer_created',
])

export function isFollowUpType(value: string): value is FollowUpType {
  return FOLLOW_UP_TYPE_VALUES.has(value)
}

export function inferActivityCategory(type: string): ActivityCategory {
  if (isFollowUpType(type)) return 'follow_up'
  if (SYSTEM_ACTIVITY_TYPES.has(type)) return 'system'
  return 'business'
}

export function isCustomerStatusCode(value: string): value is CustomerStatusCode {
  return CUSTOMER_STATUSES.some((status) => status.value === value)
}

export function isContractStatusCode(value: string): value is ContractStatusCode {
  return CONTRACT_STATUSES.some((status) => status.value === value)
}

export function isTaskStatusCode(value: string): value is TaskStatusCode {
  return TASK_STATUSES.some((status) => status.value === value)
}

export function getCustomerStatusLabel(value: string | null): string | null {
  return CUSTOMER_STATUSES.find((status) => status.value === value)?.label ?? null
}
