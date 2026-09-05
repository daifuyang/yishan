/**
 * 跟进时间线（共享组件）。
 *
 * 用法：
 *   <ActivityTimeline items={activities} loading={loading} groupByDate />
 *   <ActivityTimeline items={activities} emptyText="暂无记录" />
 *
 * 设计：
 * - 单条结构：时间 · 操作人 · 跟进类型 tag · 跟进内容 · 下次跟进提示
 * - groupByDate=true 时按"今天 / 昨天 / 本年 / 更早"分组，分别用 antd Timeline 渲染。
 * - 空状态：antd Empty + 文案；loading：Skeleton + 占位条。
 */

import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Empty, Skeleton, Space, Tag, Timeline, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import type { ActivityRow } from '@/services/crm';

const { Text } = Typography;

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  phone: '电话',
  wechat: '微信',
  visit: '拜访',
  meeting: '会议',
  email: '邮件',
  other: '其他',
};

function activityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABEL[type] ?? type;
}

interface Group {
  key: string;
  label: string;
  items: ActivityRow[];
}

/** 按日期分桶：今天 / 昨天 / 本年 / 更早 */
function groupByDateBucket(items: ActivityRow[]): Group[] {
  const today = dayjs().startOf('day');
  const yesterday = today.subtract(1, 'day');
  const yearStart = today.startOf('year');

  const buckets: Record<string, ActivityRow[]> = {
    today: [],
    yesterday: [],
    thisYear: [],
    earlier: [],
  };
  for (const it of items) {
    const d = dayjs(it.occurredAt);
    if (!d.isValid()) {
      buckets.earlier.push(it);
      continue;
    }
    if (d.isSame(today, 'day')) buckets.today.push(it);
    else if (d.isSame(yesterday, 'day')) buckets.yesterday.push(it);
    else if (d.isAfter(yearStart)) buckets.thisYear.push(it);
    else buckets.earlier.push(it);
  }

  const groups: Group[] = [];
  if (buckets.today.length)
    groups.push({ key: 'today', label: '今天', items: buckets.today });
  if (buckets.yesterday.length)
    groups.push({
      key: 'yesterday',
      label: '昨天',
      items: buckets.yesterday,
    });
  if (buckets.thisYear.length)
    groups.push({
      key: 'thisYear',
      label: '本年',
      items: buckets.thisYear,
    });
  if (buckets.earlier.length)
    groups.push({ key: 'earlier', label: '更早', items: buckets.earlier });
  return groups;
}

export interface ActivityTimelineProps {
  items: ActivityRow[];
  loading?: boolean;
  groupByDate?: boolean;
  emptyText?: string;
  /** 渲染时是否限制总数（默认不限；OverviewTab 调用时传 30）。 */
  limit?: number;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  items,
  loading,
  groupByDate,
  emptyText,
  limit,
}) => {
  const sliced = useMemo(
    () => (limit && items.length > limit ? items.slice(0, limit) : items),
    [items, limit],
  );

  if (loading) {
    return (
      <Skeleton
        active
        paragraph={{ rows: 4 }}
        title={false}
        style={{ padding: '4px 0' }}
      />
    );
  }

  if (sliced.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={emptyText ?? '暂无跟进记录'}
        style={{ margin: '16px 0' }}
      />
    );
  }

  const renderItem = (a: ActivityRow) => ({
    dot:
      a.type === 'visit' ? (
        <CalendarOutlined style={{ color: '#1677ff' }} />
      ) : (
        <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
      ),
    children: (
      <div style={{ paddingBottom: 4 }}>
        <div style={{ marginBottom: 4 }}>
          <Space size={8} wrap>
            <Tag color="blue">{activityTypeLabel(a.type)}</Tag>
            <Text strong>
              {a.operatorUserName ?? `用户 ${a.operatorUserId}`}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(a.occurredAt).format('YYYY-MM-DD HH:mm')}
            </Text>
          </Space>
        </div>
        <div style={{ color: '#262626', whiteSpace: 'pre-wrap' }}>
          {a.content}
        </div>
        {a.nextFollowUpAt && (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: '#1677ff',
            }}
          >
            下次跟进：
            {dayjs(a.nextFollowUpAt).format('YYYY-MM-DD HH:mm')}
          </div>
        )}
      </div>
    ),
  });

  if (groupByDate) {
    const groups = groupByDateBucket(sliced);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((g) => (
          <div key={g.key}>
            <div
              style={{
                fontSize: 12,
                color: '#8c8c8c',
                marginBottom: 8,
                fontWeight: 500,
              }}
            >
              {g.label}
            </div>
            <Timeline items={g.items.map(renderItem)} />
          </div>
        ))}
      </div>
    );
  }

  return <Timeline items={sliced.map(renderItem)} />;
};

export default ActivityTimeline;
