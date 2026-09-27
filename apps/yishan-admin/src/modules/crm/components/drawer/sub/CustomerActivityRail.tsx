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
  ProForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  Button,
  message as antdMessage,
  Select,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  type ActivityRow,
  type ActivityType,
  type CustomerDetail,
  createActivity,
  listActivitiesByCustomer,
} from '@/services/crm';
import DrawerFilterBar from '../_shared/DrawerFilterBar';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';
import ActivityTimeline, { getActivityCategory } from './ActivityTimeline';
import { AttachmentSelect } from '@/components/AttachmentSelect';

export interface CustomerFollowUpFormValues {
  type: ActivityType;
  content: string;
  nextFollowUpAt?: Dayjs | string | Date | null;
  attachmentIds?: Array<number | string>;
  metadata?: Record<string, unknown> | null;
}

type ActivityFilter = 'all' | 'followup' | 'system';

const filterLabels: Array<{ key: ActivityFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'followup', label: '跟进' },
  { key: 'system', label: '系统' },
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
  /**
   * 写完一条跟进后通知父组件刷新客户详情（状态可能变化）。
   * 不传则只刷新活动列表。
   */
  onFollowUpSaved?: () => void;
  followUpRequest?: number;
}

function buildCustomerCreatedEvent(customer: CustomerDetail): ActivityRow {
  return {
    id: -customer.id,
    customerId: customer.id,
    contactId: null,
    type: 'other',
    content: '客户新增\n客户通过官网提交产品试用申请，由系统自动创建。',
    occurredAt: customer.createdAt,
    nextFollowUpAt: null,
    metadata: { eventType: 'customer_created' },
    operatorUserId: 0,
    operatorUserName: '系统',
    createdAt: customer.createdAt,
    updatedAt: customer.createdAt,
  };
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
    attachmentIds: (values.attachmentIds ?? [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0),
    metadata: values.metadata ?? null,
  };
}

const CustomerActivityRail: React.FC<CustomerActivityRailProps> = ({
  customer,
  onFollowUpSaved,
  followUpRequest,
}) => {
  // 公海里的客户尚未归属，不允许写跟进。
  const canWriteFollowUp = customer.poolStatus === 'owned';

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [operatorUserId, setOperatorUserId] = useState<number | undefined>();
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
      .then((res) => {
        if (!active) return;
        const items = res.items ?? [];
        const hasCreatedEvent = items.some(
          (item) => item.metadata?.eventType === 'customer_created',
        );
        setActivities(hasCreatedEvent ? items : [buildCustomerCreatedEvent(customer), ...items]);
      })
      .catch(() =>
        active && antdMessage.error('动态加载失败，请稍后重试'),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [customer.id]);

  useEffect(() => {
    if (followUpRequest && canWriteFollowUp) setFollowUpOpen(true);
  }, [followUpRequest, canWriteFollowUp]);

  // 过滤：分类 + 日期范围
  const filteredActivities = useMemo(() => {
    let rows = activities;
    if (filter === 'followup') {
      rows = rows.filter((activity) => getActivityCategory(activity) === 'followup');
    } else if (filter === 'system') {
      rows = rows.filter((activity) => getActivityCategory(activity) === 'system');
    }
    if (operatorUserId) rows = rows.filter((activity) => activity.operatorUserId === operatorUserId);
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
    () => Array.from(new Map(activities.filter((activity) => activity.operatorUserName).map((activity) => [activity.operatorUserId, activity.operatorUserName])).entries()).map(([value, label]) => ({ value, label })),
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
        {canWriteFollowUp && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setFollowUpOpen(true)}
          >
            新增跟进
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
              antdMessage.success('跟进已保存');
              setFollowUpOpen(false);
              // 异步刷新活动 + 客户详情
              void listActivitiesByCustomer(customer.id)
                .then((res) => {
                  const items = res.items ?? [];
                  setActivities(items.some((item) => item.metadata?.eventType === 'customer_created') ? items : [buildCustomerCreatedEvent(customer), ...items]);
                })
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
          <ProFormDateTimePicker
            name="nextFollowUpAt"
            label="下次跟进"
            placeholder="请选择下次跟进时间"
            width="md"
          />
          <ProForm.Item name="attachmentIds" label="附件">
            <AttachmentSelect valueType="id" multiple maxCount={10} />
          </ProForm.Item>
        </ModalForm>
      )}

      <DrawerFilterBar<ActivityFilter>
        options={filterLabels}
        value={filter}
        onChange={setFilter}
        dateRange={{ value: dateRange, onChange: setDateRange }}
        filterContent={operatorOptions.length > 0 ? <Select allowClear placeholder="操作人" value={operatorUserId} options={operatorOptions} onChange={setOperatorUserId} style={{ width: '100%' }} /> : undefined}
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
          emptyText={filter === 'all' && !dateRange && !operatorUserId ? '暂无动态' : '当前筛选下暂无动态'}
          emptyExtra={canWriteFollowUp ? <Button type="primary" size="small" onClick={() => setFollowUpOpen(true)}>新增跟进</Button> : undefined}
        />
      </div>
    </aside>
  );
};

export default CustomerActivityRail;
