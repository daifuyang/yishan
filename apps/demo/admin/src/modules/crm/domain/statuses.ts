export type StatusSemantic =
  | 'default'
  | 'processing'
  | 'warning'
  | 'success'
  | 'error';

export interface StatusDescriptor {
  value: string;
  label: string;
  semantic: StatusSemantic;
  probability?: number;
}

export const CUSTOMER_STATUSES: StatusDescriptor[] = [
  { value: 'potential', label: '潜在', semantic: 'default' },
  { value: 'following', label: '跟进中', semantic: 'processing' },
  { value: 'opportunity', label: '有商机', semantic: 'warning' },
  { value: 'won', label: '已成交', semantic: 'success' },
  { value: 'lost', label: '已流失', semantic: 'error' },
];
export type CustomerStatusCode = (typeof CUSTOMER_STATUSES)[number]['value'];

export const OPPORTUNITY_STAGES = [
  {
    value: 'needs_confirmation',
    label: '需求确认',
    semantic: 'processing',
    probability: 20,
  },
  {
    value: 'solution',
    label: '方案沟通',
    semantic: 'processing',
    probability: 35,
  },
  {
    value: 'quotation',
    label: '商务报价',
    semantic: 'processing',
    probability: 50,
  },
  {
    value: 'negotiation',
    label: '商务谈判',
    semantic: 'warning',
    probability: 70,
  },
  { value: 'won', label: '赢单', semantic: 'success', probability: 100 },
  { value: 'lost', label: '输单', semantic: 'error', probability: 0 },
] as const satisfies readonly StatusDescriptor[];
export type OpportunityStageCode = (typeof OPPORTUNITY_STAGES)[number]['value'];
export function nextOpportunityStage(stage: OpportunityStageCode) {
  return opportunityStageActions[stage]?.next;
}
export const OPEN_OPPORTUNITY_STAGES = OPPORTUNITY_STAGES.filter(
  (stage) => stage.value !== 'won' && stage.value !== 'lost',
);
export const opportunityStageConfig = Object.fromEntries(
  OPPORTUNITY_STAGES.map((stage) => [
    stage.value,
    {
      label: stage.label,
      probability: stage.probability ?? 0,
      semantic: stage.semantic,
    },
  ]),
) as Record<
  OpportunityStageCode,
  { label: string; probability: number; semantic: StatusSemantic }
>;
export const QUOTATION_STATUSES: StatusDescriptor[] = [
  { value: 'draft', label: '草稿', semantic: 'default' },
  { value: 'sent', label: '已发送', semantic: 'processing' },
  { value: 'accepted', label: '已确认', semantic: 'success' },
  { value: 'rejected', label: '已拒绝', semantic: 'error' },
  { value: 'voided', label: '已作废', semantic: 'default' },
  { value: 'superseded', label: '已被新版替代', semantic: 'default' },
];
export const CONTRACT_STATUSES: StatusDescriptor[] = [
  { value: 'draft', label: '草稿', semantic: 'default' },
  { value: 'performing', label: '履约中', semantic: 'processing' },
  { value: 'completed', label: '已完成', semantic: 'success' },
  { value: 'terminated', label: '已终止', semantic: 'error' },
];
export const TASK_STATUSES: StatusDescriptor[] = [
  { value: 'todo', label: '待处理', semantic: 'default' },
  { value: 'in_progress', label: '进行中', semantic: 'processing' },
  { value: 'completed', label: '已完成', semantic: 'success' },
  { value: 'cancelled', label: '已取消', semantic: 'error' },
];

export const ACTIVITY_CATEGORIES: StatusDescriptor[] = [
  { value: 'follow_up', label: '人工跟进', semantic: 'processing' },
  { value: 'system', label: '系统事件', semantic: 'default' },
  { value: 'business', label: '业务事件', semantic: 'warning' },
];
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]['value'];

export const FOLLOW_UP_TYPES = [
  { value: 'phone', label: '电话', semantic: 'processing' },
  { value: 'wechat', label: '微信', semantic: 'processing' },
  { value: 'visit', label: '拜访', semantic: 'processing' },
  { value: 'email', label: '邮件', semantic: 'processing' },
  { value: 'meeting', label: '会议', semantic: 'processing' },
  { value: 'other', label: '其他', semantic: 'default' },
] as const satisfies readonly StatusDescriptor[];
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number]['value'];

export const FOLLOW_UP_RESULTS = [
  { value: 'continue', label: '待继续跟进', semantic: 'processing' },
  { value: 'interested', label: '有明确意向', semantic: 'warning' },
  { value: 'not_now', label: '暂不考虑', semantic: 'default' },
  { value: 'unreachable', label: '无法联系', semantic: 'error' },
  { value: 'invalid', label: '无效客户', semantic: 'error' },
] as const satisfies readonly StatusDescriptor[];
export type FollowUpResult = (typeof FOLLOW_UP_RESULTS)[number]['value'];

export function statusOf(
  value: string,
  statuses: StatusDescriptor[],
): StatusDescriptor {
  return (
    statuses.find((item) => item.value === value) ?? {
      value,
      label: value,
      semantic: 'default',
    }
  );
}

export const opportunityStageActions: Partial<
  Record<
    OpportunityStageCode,
    {
      next: 'solution' | 'quotation' | 'negotiation';
      label: string;
    }
  >
> = {
  needs_confirmation: { next: 'solution', label: '方案' },
  solution: { next: 'quotation', label: '报价' },
  quotation: { next: 'negotiation', label: '谈判' },
};
