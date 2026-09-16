import {
  CalendarOutlined,
  ClockCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Button, Empty, Skeleton, Timeline, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import type { ActivityRow } from '@/services/crm';
import DrawerFilterBar from '../_shared/DrawerFilterBar';
import { groupByDate as groupItemsByDate } from '../_shared/groupByDate';

type ActivityCategory = 'followup' | 'system';
type ActivityTypeConfig = { label: string; category: ActivityCategory };

export const activityTypeConfig: Record<string, ActivityTypeConfig> = {
  customer_created: { label: '系统', category: 'system' },
  phone: { label: '电话', category: 'followup' },
  wechat: { label: '微信', category: 'followup' },
  visit: { label: '拜访', category: 'followup' },
  meeting: { label: '面谈', category: 'followup' },
  email: { label: '邮件', category: 'followup' },
  other: { label: '其他跟进', category: 'followup' },
  status_change: { label: '状态变更', category: 'system' },
  owner_changed: { label: '负责人变更', category: 'system' },
  opportunity_created: { label: '商机创建', category: 'system' },
  opportunity_updated: { label: '商机更新', category: 'system' },
  opportunity_stage_changed: { label: '商机阶段变更', category: 'system' },
  opportunity_won: { label: '商机成交', category: 'system' },
  opportunity_lost: { label: '商机失败', category: 'system' },
  quotation_created: { label: '报价创建', category: 'system' },
  contract_created: { label: '合同签署', category: 'system' },
  payment_received: { label: '回款', category: 'system' },
};

const customerStatusLabels: Record<string, string> = {
  potential: '潜在客户',
  following: '跟进中',
  opportunity: '有商机',
  won: '已成交',
  customer: '已成交',
  lost: '已流失',
};
const followupTypes = new Set([
  'phone',
  'wechat',
  'visit',
  'meeting',
  'email',
  'other',
]);
const getEventType = (activity: ActivityRow) =>
  typeof activity.metadata?.eventType === 'string'
    ? activity.metadata.eventType
    : activity.type;

export const getActivityCategory = (activity: ActivityRow): ActivityCategory =>
  activityTypeConfig[getEventType(activity)]?.category ??
  (followupTypes.has(activity.type) ? 'followup' : 'system');

const getActivityLabel = (activity: ActivityRow) =>
  activityTypeConfig[getEventType(activity)]?.label ??
  (getActivityCategory(activity) === 'system' ? '系统' : '其他跟进');

const metadataText = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const statusChangeContent = (activity: ActivityRow) => {
  const from = metadataText(activity.metadata, 'from');
  const to = metadataText(activity.metadata, 'to');
  return from && to
    ? `客户状态由「${customerStatusLabels[from] ?? '原状态'}」变更为「${customerStatusLabels[to] ?? '新状态'}」`
    : '客户状态已更新';
};

const systemContent = (activity: ActivityRow) => {
  if (getEventType(activity) === 'status_change')
    return { title: undefined, content: statusChangeContent(activity) };
  const [title, ...rest] = activity.content.split('\n').filter(Boolean);
  return { title, content: rest.join('\n') };
};

const formatFollowUpTime = (value: string) => {
  const date = dayjs(value);
  if (date.isSame(dayjs(), 'day')) return `今天 ${date.format('HH:mm')}`;
  if (date.isSame(dayjs().add(1, 'day'), 'day'))
    return `明天 ${date.format('HH:mm')}`;
  return date.format('MM-DD HH:mm');
};

const dateGroupLabel = (date: string) => {
  const value = dayjs(date);
  if (value.isSame(dayjs(), 'day')) return '今天';
  if (value.isSame(dayjs().subtract(1, 'day'), 'day')) return '昨天';
  return value.format('MM月DD日');
};

const TimelineItem: React.FC<{ activity: ActivityRow }> = ({ activity }) => {
  const [expanded, setExpanded] = useState(false);
  const isSystem = getActivityCategory(activity) === 'system';
  const { title, content } = isSystem
    ? systemContent(activity)
    : { title: undefined, content: activity.content };
  const intent =
    metadataText(activity.metadata, 'intent') ??
    metadataText(activity.metadata, 'intention');
  const nextStep =
    metadataText(activity.metadata, 'nextStep') ??
    metadataText(activity.metadata, 'next_step');
  const collapsible = content.length > 140 || content.split('\n').length > 4;

  return (
    <div style={{ paddingBottom: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginBottom: 8,
          color: isSystem ? '#98a2b3' : '#475467',
          fontSize: 12,
        }}
      >
        <span
          style={{
            color: isSystem ? '#98a2b3' : '#344054',
            fontWeight: isSystem ? 400 : 500,
          }}
        >
          {getActivityLabel(activity)}
        </span>
        {!isSystem && activity.operatorUserName && (
          <span>· {activity.operatorUserName}</span>
        )}
        <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {dayjs(activity.occurredAt).format('HH:mm')}
        </span>
      </div>
      {title && (
        <Typography.Text
          style={{
            display: 'block',
            marginBottom: 4,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {title}
        </Typography.Text>
      )}
      {content && (
        <div
          style={{
            color: isSystem ? '#667085' : '#344054',
            fontSize: 13,
            lineHeight: '21px',
            whiteSpace: 'pre-wrap',
            ...(collapsible && !expanded
              ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }
              : {}),
          }}
        >
          {content}
        </div>
      )}
      {collapsible && (
        <Button
          type="link"
          size="small"
          onClick={() => setExpanded((value) => !value)}
          style={{ height: 20, padding: 0 }}
        >
          {expanded ? '收起' : '展开'}
        </Button>
      )}
      {!isSystem && (intent || nextStep || activity.nextFollowUpAt) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 16px',
            marginTop: 10,
            color: '#667085',
            fontSize: 12,
            lineHeight: '20px',
          }}
        >
          {intent && <span>意向：{intent}</span>}
          {nextStep && (
            <span style={{ color: '#1677ff' }}>下一步：{nextStep}</span>
          )}
          {activity.nextFollowUpAt && (
            <span>下次跟进：{formatFollowUpTime(activity.nextFollowUpAt)}</span>
          )}
        </div>
      )}
    </div>
  );
};

export interface ActivityTimelineProps {
  items: ActivityRow[];
  loading?: boolean;
  groupByDate?: boolean;
  emptyText?: string;
  emptyExtra?: React.ReactNode;
  limit?: number;
  dateRange?: {
    value: { from?: string; to?: string } | null;
    onChange: (next: { from?: string; to?: string } | null) => void;
  };
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  items,
  loading,
  groupByDate,
  emptyText,
  emptyExtra,
  limit,
  dateRange,
}) => {
  const sliced = useMemo(
    () => (limit ? items.slice(0, limit) : items),
    [items, limit],
  );
  const groups = useMemo(
    () =>
      groupByDate ? groupItemsByDate(sliced, (item) => item.occurredAt) : [],
    [groupByDate, sliced],
  );
  if (loading)
    return (
      <>
        <DrawerFilterBar dateRange={dateRange} />
        <Skeleton
          active
          title={false}
          paragraph={{ rows: 5 }}
          style={{ paddingTop: 8 }}
        />
      </>
    );
  if (!sliced.length)
    return (
      <div>
        <DrawerFilterBar dateRange={dateRange} />
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              {emptyText ?? '暂无动态'}
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                客户的跟进、状态变化等记录会显示在这里
              </Typography.Text>
            </span>
          }
          style={{ margin: '36px 0' }}
        >
          {emptyExtra as any}
        </Empty>
      </div>
    );

  const renderItems = (rows: ActivityRow[]) =>
    rows.map((activity) => ({
      key: activity.id,
      icon:
        getActivityCategory(activity) === 'system' ? (
          <SettingOutlined style={{ color: '#c5cbd5', fontSize: 12 }} />
        ) : activity.type === 'visit' ? (
          <CalendarOutlined style={{ color: '#98a2b3', fontSize: 12 }} />
        ) : (
          <ClockCircleOutlined style={{ color: '#98a2b3', fontSize: 12 }} />
        ),
      content: <TimelineItem activity={activity} />,
    }));

  if (!groupByDate)
    return (
      <div>
        <DrawerFilterBar dateRange={dateRange} />
        <Timeline items={renderItems(sliced)} />
      </div>
    );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <DrawerFilterBar dateRange={dateRange} />
      {groups.map((group) => (
        <section key={group.date}>
          <Typography.Text
            type="secondary"
            style={{
              display: 'block',
              marginBottom: 10,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {dateGroupLabel(group.date)}
          </Typography.Text>
          <Timeline items={renderItems(group.items)} />
        </section>
      ))}
    </div>
  );
};

export default ActivityTimeline;
