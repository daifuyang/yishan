/**
 * 客户动态 rail。
 *
 * 职责（与 LeadActivityRail 对齐）：
 *   - 顶部：[动态] 标题 + 「写跟进」按钮（仅 owned 客户）
 *   - 中部：DrawerFilterBar（分类 + 日期范围）
 *   - 下部：按日期分组的 ActivityTimeline（复用 sub/ActivityTimeline）
 *
 * 写跟进弹窗走 ProForm 的 ModalForm，挂在 CRM_DIALOG_Z_INDEX 上，
 * 保证浮在抽屉内容之上。
 */

import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  Button,
  Divider,
  message as antdMessage,
  Spin,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  type ActivityRow,
  type ActivityType,
  type CustomerDetail,
  type StatusRow,
  createActivity,
  listActivitiesByCustomer,
} from '@/services/crm';
import { formatDateTime } from '@/utils/formatDate';
import DrawerFilterBar from '../_shared/DrawerFilterBar';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';
import ActivityTimeline from './ActivityTimeline';

export interface CustomerFollowUpFormValues {
  type: ActivityType;
  content: string;
  statusId?: number;
  nextFollowUpAt?: Dayjs | string | Date | null;
}

type ActivityFilter = 'all' | 'followup' | 'system';

const filterLabels: Array<{ key: ActivityFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'followup', label: '跟进' },
  { key: 'system', label: '系统记录' },
];

const typeOptions: Array<{ value: ActivityType; label: string }> = [
  { value: 'phone', label: '电话' },
  { value: 'wechat', label: '微信' },
  { value: 'visit', label: '拜访' },
  { value: 'meeting', label: '会议' },
  { value: 'email', label: '邮件' },
  { value: 'other', label: '其他' },
];

export interface CustomerActivityRailProps {
  customer: CustomerDetail;
  statuses: StatusRow[];
  /**
   * 写完一条跟进后通知父组件刷新客户详情（状态可能变化）。
   * 不传则只刷新活动列表。
   */
  onFollowUpSaved?: () => void;
}

/**
 * 把 ProForm 字段值收敛成 createActivity 入参。
 *  - content 做 trim
 *  - nextFollowUpAt 接受 Dayjs / Date / ISO 字符串；falsy 一律 null
 */
function toActivityInput(values: CustomerFollowUpFormValues) {
  const next = values.nextFollowUpAt;
  return {
    type: values.type,
    content: values.content.trim(),
    nextFollowUpAt: next ? dayjs(next).toISOString() : null,
  };
}

const CustomerActivityRail: React.FC<CustomerActivityRailProps> = ({
  customer,
  statuses,
  onFollowUpSaved,
}) => {
  // 公海里的客户尚未归属，不允许写跟进。
  const canWriteFollowUp = customer.poolStatus === 'owned';

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [dateRange, setDateRange] = useState<{
    from?: string;
    to?: string;
  } | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listActivitiesByCustomer(customer.id)
      .then((res) => active && setActivities(res.items ?? []))
      .catch(() =>
        active && antdMessage.error('动态加载失败，请稍后重试'),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [customer.id]);

  // 过滤：分类 + 日期范围
  const filteredActivities = useMemo(() => {
    let rows = activities;
    if (filter === 'followup') {
      rows = rows.filter((a) =>
        ['phone', 'wechat', 'visit', 'meeting', 'email'].includes(a.type),
      );
    } else if (filter === 'system') {
      rows = rows.filter((a) => a.type === 'other');
    }
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
  }, [activities, filter, dateRange]);

  const statusOptions = useMemo(
    () =>
      statuses
        .filter((s) => s.enabled === 1)
        .sort((a, b) => a.sort - b.sort)
        .map((s) => ({ value: s.id, label: s.name })),
    [statuses],
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
        <Typography.Text strong style={{ fontSize: 14 }}>
          动态
        </Typography.Text>
        {canWriteFollowUp && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setFollowUpOpen(true)}
          >
            写跟进
          </Button>
        )}
      </div>

      {canWriteFollowUp && (
        <ModalForm<CustomerFollowUpFormValues>
          open={followUpOpen}
          onOpenChange={setFollowUpOpen}
          title="写跟进"
          initialValues={{
            type: 'phone',
          }}
          modalProps={{
            destroyOnHidden: true,
            okButtonProps: { loading: followUpSubmitting },
            // 弹窗在抽屉里打开，要走 CRM_DIALOG_Z_INDEX 保证浮在抽屉内容之上。
            zIndex: CRM_DIALOG_Z_INDEX,
          }}
          onFinish={async (values) => {
            setFollowUpSubmitting(true);
            try {
              await createActivity(customer.id, toActivityInput(values));
              // 阶段变化：客户 statusId 可能要改（CRM 实体可能需要专门接口，Phase 3 完善）
              if (
                values.statusId &&
                customer.statusId !== values.statusId
              ) {
                try {
                  const { updateCustomer } = await import('@/services/crm');
                  await updateCustomer(customer.id, {
                    statusId: values.statusId,
                  });
                } catch {
                  /* statusId 同步失败不影响跟进保存 */
                }
              }
              antdMessage.success('跟进已保存');
              setFollowUpOpen(false);
              // 异步刷新活动 + 客户详情
              void listActivitiesByCustomer(customer.id)
                .then((res) => setActivities(res.items ?? []))
                .catch(() =>
                  antdMessage.warning(
                    '跟进已保存，但动态刷新失败，请稍后刷新页面',
                  ),
                );
              onFollowUpSaved?.();
              return true;
            } catch (err: unknown) {
              antdMessage.error(
                (err as Error)?.message ?? '跟进保存失败',
              );
              return false;
            } finally {
              setFollowUpSubmitting(false);
            }
          }}
        >
          <ProFormSelect
            name="type"
            label="跟进方式"
            options={typeOptions}
            rules={[{ required: true, message: '请选择跟进方式' }]}
          />
          <ProFormTextArea
            name="content"
            label="本次跟进"
            placeholder="记录本次跟进..."
            fieldProps={{
              autoSize: { minRows: 4, maxRows: 8 },
              maxLength: 2000,
            }}
            rules={[
              {
                required: true,
                whitespace: true,
                message: '请填写本次跟进内容',
              },
            ]}
          />
          <ProFormSelect
            name="statusId"
            label="当前阶段"
            allowClear
            placeholder="保持不变"
            options={statusOptions}
          />
          <ProFormDateTimePicker
            name="nextFollowUpAt"
            label="下次跟进"
            placeholder="请选择下次跟进时间"
            width="md"
          />
        </ModalForm>
      )}

      <DrawerFilterBar<ActivityFilter>
        options={filterLabels}
        value={filter}
        onChange={setFilter}
        dateRange={{ value: dateRange, onChange: setDateRange }}
      />
      <Divider style={{ margin: '12px 0 16px' }} />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: 4,
        }}
      >
        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        ) : (
          <ActivityTimeline
            items={filteredActivities}
            groupByDate
            emptyText={
              filter === 'all' && !dateRange
                ? '暂无跟进记录'
                : '当前筛选下无记录'
            }
          />
        )}
        {!loading && filteredActivities.length > 0 && (
          <Typography.Text
            type="secondary"
            style={{ display: 'block', fontSize: 11, marginTop: 8 }}
          >
            最近 {filteredActivities.length} 条 · 客户 #
            {customer.id} · 更新于 {formatDateTime(customer.updatedAt)}
          </Typography.Text>
        )}
      </div>
    </aside>
  );
};

export default CustomerActivityRail;