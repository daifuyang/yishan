/**
 * 客户动态 rail。
 *
 * 顶部：[动态] 标题 + 「新增跟进」按钮（仅 owned 客户）
 * 中部：DrawerFilterBar（全部 / 跟进 / 系统）
 * 下部：按日期分组的 ActivityTimeline
 */

import { Button, message as antdMessage, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  type ActivityRow,
  type CustomerDetail,
  listActivitiesByCustomer,
} from '@/services/crm';
import DrawerFilterBar from '../_shared/DrawerFilterBar';
import ActivityTimeline, { getActivityCategory } from './ActivityTimeline';

type ActivityFilter = 'all' | 'followup' | 'system';

const filterLabels: Array<{ key: ActivityFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'followup', label: '跟进' },
  { key: 'system', label: '系统' },
];

export interface CustomerActivityRailProps {
  customer: CustomerDetail;
  refreshKey?: number;
  onCreateFollowUp?: () => void;
}

function buildCustomerCreatedEvent(customer: CustomerDetail): ActivityRow {
  return {
    id: -customer.id,
    customerId: customer.id,
    contactId: null,
    category: 'system',
    type: 'customer_created',
    content: '客户创建',
    occurredAt: customer.createdAt,
    nextFollowUpAt: null,
    metadata: { eventType: 'customer_created', category: 'SYSTEM' },
    operatorUserId: customer.creatorId ?? 0,
    operatorUserName: '系统',
    createdAt: customer.createdAt,
    updatedAt: customer.createdAt,
  };
}

const CustomerActivityRail: React.FC<CustomerActivityRailProps> = ({
  customer,
  refreshKey,
  onCreateFollowUp,
}) => {
  const canWriteFollowUp = customer.poolStatus === 'owned';

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [operatorUserId, setOperatorUserId] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<{
    from?: string;
    to?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listActivitiesByCustomer(customer.id)
      .then((res) => {
        if (!active) return;
        const items = res.items ?? [];
        const hasCreatedEvent = items.some(
          (item) =>
            item.type === 'customer_created' ||
            item.metadata?.eventType === 'customer_created',
        );
        setActivities(
          hasCreatedEvent
            ? items
            : [buildCustomerCreatedEvent(customer), ...items],
        );
      })
      .catch(() => active && antdMessage.error('动态加载失败，请稍后重试'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [customer.id, refreshKey]);

  const filteredActivities = useMemo(() => {
    let rows = activities;
    if (filter === 'followup') {
      rows = rows.filter(
        (activity) => getActivityCategory(activity) === 'followup',
      );
    } else if (filter === 'system') {
      rows = rows.filter(
        (activity) => getActivityCategory(activity) === 'system',
      );
    }
    if (operatorUserId)
      rows = rows.filter(
        (activity) => activity.operatorUserId === operatorUserId,
      );
    if (dateRange?.from || dateRange?.to) {
      const from = dateRange.from ? dayjs(dateRange.from).startOf('day') : null;
      const to = dateRange.to ? dayjs(dateRange.to).endOf('day') : null;
      rows = rows.filter((a) => {
        const t = dayjs(a.occurredAt);
        if (from && t.isBefore(from)) return false;
        if (to && t.isAfter(to)) return false;
        return true;
      });
    }
    return rows;
  }, [activities, filter, dateRange, operatorUserId]);

  const operatorOptions = useMemo(
    () =>
      Array.from(
        new Map(
          activities
            .filter((activity) => activity.operatorUserName)
            .map((activity) => [
              activity.operatorUserId,
              activity.operatorUserName,
            ]),
        ).entries(),
      ).map(([value, label]) => ({ value, label })),
    [activities],
  );

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography.Text strong style={{ fontSize: 15, fontWeight: 600 }}>
          动态
        </Typography.Text>
        {canWriteFollowUp && onCreateFollowUp && (
          <Button type="primary" size="small" onClick={onCreateFollowUp}>
            新增跟进
          </Button>
        )}
      </div>

      <DrawerFilterBar<ActivityFilter>
        options={filterLabels}
        value={filter}
        onChange={setFilter}
        dateRange={{ value: dateRange, onChange: setDateRange }}
        filterContent={
          operatorOptions.length > 0 ? (
            <Select
              allowClear
              placeholder="操作人"
              value={operatorUserId}
              options={operatorOptions}
              onChange={setOperatorUserId}
              style={{ width: '100%' }}
            />
          ) : undefined
        }
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: 4,
        }}
      >
        <ActivityTimeline
          loading={loading}
          items={filteredActivities}
          groupByDate
          emptyText={
            filter === 'all' && !dateRange && !operatorUserId
              ? '暂无动态'
              : '当前筛选下暂无动态'
          }
          emptyExtra={
            canWriteFollowUp && onCreateFollowUp ? (
              <Button type="primary" size="small" onClick={onCreateFollowUp}>
                新增跟进
              </Button>
            ) : undefined
          }
        />
      </div>
    </aside>
  );
};

export default CustomerActivityRail;
