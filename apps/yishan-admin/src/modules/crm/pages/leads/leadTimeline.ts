import dayjs from 'dayjs';
import type { LeadActivityRow, LeadRow } from '@/services/crm';

export type LeadTimelineCategory = 'followup' | 'status' | 'system';

export interface LeadTimelineEvent {
  id: string;
  category: LeadTimelineCategory;
  time: string;
  title: string;
  detail?: string;
  operator?: string | null;
  nextFollowUpAt?: string | null;
  color: 'blue' | 'gray' | 'green';
}

export interface LeadTimelineGroup {
  date: string;
  events: LeadTimelineEvent[];
}

const activityLabels: Record<string, string> = {
  phone: '电话跟进',
  wechat: '微信跟进',
  visit: '拜访跟进',
  meeting: '会议跟进',
  email: '邮件跟进',
  other: '其他跟进',
};

/** 全部"状态变更"语义的活动类型 —— 都归类为 status 类别。 */
const STATUS_ACTIVITY_TYPES = new Set([
  'status_change',
  'conversion',
  'reactivation',
]);

export const buildLeadTimeline = (
  lead: LeadRow,
  activities: LeadActivityRow[] = [],
): LeadTimelineEvent[] =>
  [
    ...activities
      // 普通资料编辑走操作日志，不进入 Activity Timeline
      .filter((activity) => activity.type !== 'profile_edit')
      .map((activity) => {
        const isStatus = STATUS_ACTIVITY_TYPES.has(activity.type);
        const title = isStatus
          ? '状态变更'
          : activity.type === 'owner_change'
            ? '负责人变更'
            : (activityLabels[activity.type] ?? '跟进记录');
        return {
          id: `followup-${activity.id}`,
          category: isStatus
            ? ('status' as const)
            : activity.type === 'owner_change'
              ? ('system' as const)
              : ('followup' as const),
          time: activity.occurredAt,
          title,
          detail: activity.content,
          operator: activity.operatorUserName,
          nextFollowUpAt: activity.nextFollowUpAt,
          color: isStatus
            ? ('blue' as const)
            : activity.type === 'owner_change'
              ? ('gray' as const)
              : ('green' as const),
        };
      }),
    {
      id: `created-${lead.id}`,
      category: 'system' as const,
      time: lead.createdAt,
      title: '新建线索',
      detail:
        [lead.name, lead.companyName].filter(Boolean).join(' · ') ||
        `线索 #${lead.id}`,
      color: 'blue' as const,
    },
  ].sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf());

export const groupLeadTimelineByDate = (
  events: LeadTimelineEvent[],
): LeadTimelineGroup[] => {
  const groups = new Map<string, LeadTimelineEvent[]>();
  events.forEach((event) => {
    const date = dayjs(event.time).format('YYYY-MM-DD');
    groups.set(date, [...(groups.get(date) ?? []), event]);
  });
  return [...groups.entries()].map(([date, groupedEvents]) => ({
    date,
    events: groupedEvents,
  }));
};

export const filterLeadTimelineByDateRange = (
  events: LeadTimelineEvent[],
  dateRange?: [string, string] | null,
) => {
  if (!dateRange) return events;
  const [start, end] = dateRange;
  const startAt = dayjs(start).valueOf();
  const endAt = dayjs(end).valueOf();
  return events.filter((event) => {
    const eventAt = dayjs(event.time).valueOf();
    return eventAt >= startAt && eventAt <= endAt;
  });
};

