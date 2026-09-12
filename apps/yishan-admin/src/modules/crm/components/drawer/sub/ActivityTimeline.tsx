/**
 * 跟进时间线（客户侧）。
 *
 * 用法：
 *   <ActivityTimeline items={activities} loading={loading} groupByDate />
 *   <ActivityTimeline items={activities} dateRange={{ value, onChange }} />
 *   <ActivityTimeline items={activities} emptyText="暂无记录" />
 *
 * 设计：
 * - 单条结构：时间 · 操作人 · 跟进类型 tag · 跟进内容 · 下次跟进提示
 * - groupByDate=true 时按"今天 / 昨天 / 本年 / 更早"分组，分别用 antd Timeline 渲染。
 * - dateRange 提供时，渲染 DrawerFilterBar 的「筛选」按钮（与线索一致），
 *   调用方负责按 ISO 字符串过滤 items。
 * - 空状态：antd Empty + 文案；loading：Skeleton + 占位条。
 */

import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Empty, Skeleton, Space, Tag, Timeline, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import type { ActivityRow } from '@/services/crm';
import DrawerFilterBar from '../_shared/DrawerFilterBar';
import { groupByDate as groupItemsByDate } from '../_shared/groupByDate';

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

export interface ActivityTimelineProps {
  items: ActivityRow[];
  loading?: boolean;
  groupByDate?: boolean;
  emptyText?: string;
  /** 渲染时是否限制总数（默认不限；OverviewTab 调用时传 30）。 */
  limit?: number;
  /**
   * 日期范围筛选（可选）。与线索 drawer 对齐：传此 prop 后在 timeline 顶部
   * 渲染 DrawerFilterBar 的「筛选」按钮 + 日期 Popover，调用方负责按 value
   * 过滤 items。
   */
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
  limit,
  dateRange,
}) => {
  const sliced = useMemo(
    () => (limit && items.length > limit ? items.slice(0, limit) : items),
    [items, limit],
  );

  // 复用 _shared 的按日分组（今天/昨天/YYYY年MM月DD日）当 dateRange 不传 groupByDate 时
  const sharedGroups = useMemo(
    () => (groupByDate ? groupItemsByDate(sliced, (it) => it.occurredAt) : []),
    [groupByDate, sliced],
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
      <div>
        {dateRange && (
          <DrawerFilterBar dateRange={dateRange} />
        )}
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={emptyText ?? '暂无跟进记录'}
          style={{ margin: '16px 0' }}
        />
      </div>
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

  if (groupByDate && sharedGroups.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {dateRange && <DrawerFilterBar dateRange={dateRange} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sharedGroups.map((g) => (
            <div key={g.date}>
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
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {dateRange && <DrawerFilterBar dateRange={dateRange} />}
      <Timeline items={sliced.map(renderItem)} />
    </div>
  );
};

export default ActivityTimeline;
