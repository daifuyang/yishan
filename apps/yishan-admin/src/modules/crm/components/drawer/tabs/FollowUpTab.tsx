/**
 * 客户 Drawer — FollowUp Tab。
 *
 * 顶部：新增跟进表单
 * 底部：跟进记录（含筛选 + 时间线）
 *
 * 表单字段：
 *   - 跟进内容 textarea（required, max 2000）
 *   - 跟进方式 radio: phone / wechat / visit / meeting / email / other
 *   - 当前阶段 select（来自 statuses）
 *   - 下次跟进时间 DateTimePicker
 *   - 下次跟进计划 textarea（optional, max 500）
 *
 * 提交后由父组件决定 reload（onCreated）。
 */

import { Button, Card, Form, Input, Radio, Select, Space } from 'antd';
import { DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import type {
  ActivityRow,
  CustomerDetail,
  StatusRow,
} from '@/services/crm';
import type { ActivityType } from '@/services/crm';
import ActivityTimeline from '../sub/ActivityTimeline';

const { TextArea } = Input;
type TextAreaRef = typeof TextArea extends React.ForwardRefExoticComponent<
  React.RefAttributes<infer R>
>
  ? R
  : never;

const ACTIVITY_OPTIONS: Array<{ value: ActivityType; label: string }> = [
  { value: 'phone', label: '电话' },
  { value: 'wechat', label: '微信' },
  { value: 'visit', label: '拜访' },
  { value: 'meeting', label: '会议' },
  { value: 'email', label: '邮件' },
  { value: 'other', label: '其他' },
];

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  ...ACTIVITY_OPTIONS,
];

export interface FollowUpFormValues {
  type: ActivityType;
  content: string;
  statusId?: number;
  nextFollowUpAt?: Dayjs | null;
  nextFollowUpPlan?: string;
}

export interface FollowUpTabProps {
  customer: CustomerDetail;
  statuses: StatusRow[];
  activities: ActivityRow[];
  loading: boolean;
  /** 当父组件希望自动 focus 新增跟进表单时设为 true。 */
  requestFocus?: boolean;
  /** 表单提交（已校验通过），由父组件执行 createActivity + reload。 */
  onSubmit: (values: FollowUpFormValues) => Promise<void> | void;
}

const FollowUpTab: React.FC<FollowUpTabProps> = ({
  customer,
  statuses,
  activities,
  loading,
  requestFocus,
  onSubmit,
}) => {
  const [form] = Form.useForm<FollowUpFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | ActivityType>('all');
  const contentRef = React.useRef<TextAreaRef | null>(null);

  // focus textarea
  useEffect(() => {
    if (requestFocus) {
      const t = setTimeout(() => {
        contentRef.current?.focus?.();
      }, 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [requestFocus]);

  const statusOptions = useMemo(
    () =>
      statuses
        .filter((s) => s.enabled === 1)
        .sort((a, b) => a.sort - b.sort)
        .map((s) => ({ value: s.id, label: s.name })),
    [statuses],
  );

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter((a) => a.type === filter);
  }, [activities, filter]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await onSubmit(values);
      form.resetFields();
      form.setFieldsValue({ type: 'phone' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card
        size="small"
        title="新增跟进"
        bodyStyle={{ padding: 16 }}
      >
        <Form<FollowUpFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            type: 'phone',
            statusId: customer.statusId ?? undefined,
          }}
        >
          <Form.Item
            label="跟进内容"
            name="content"
            rules={[{ required: true, max: 2000 }]}
          >
            <TextArea
              ref={contentRef}
              rows={4}
              showCount
              maxLength={2000}
              placeholder="本次沟通要点、客户反馈、下一步行动…"
            />
          </Form.Item>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <Form.Item
              label="跟进方式"
              name="type"
              rules={[{ required: true }]}
            >
              <Radio.Group
                options={ACTIVITY_OPTIONS}
                optionType="button"
                buttonStyle="solid"
              />
            </Form.Item>
            <Form.Item label="当前阶段" name="statusId">
              <Select
                allowClear
                placeholder="保持不变"
                options={statusOptions}
              />
            </Form.Item>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <Form.Item label="下次跟进时间" name="nextFollowUpAt">
              <DatePicker
                showTime
                style={{ width: '100%' }}
                format="YYYY-MM-DD HH:mm"
              />
            </Form.Item>
            <Form.Item label="下次跟进计划" name="nextFollowUpPlan">
              <Input
                maxLength={500}
                placeholder="（可选）一句话写清下次打算做什么"
              />
            </Form.Item>
          </div>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => form.resetFields()}>取消</Button>
              <Button
                type="primary"
                loading={submitting}
                onClick={handleSubmit}
              >
                保存跟进
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        size="small"
        title="跟进记录"
        extra={
          <Radio.Group
            options={TYPE_FILTER_OPTIONS}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="small"
          />
        }
        bodyStyle={{ padding: 16 }}
      >
        <ActivityTimeline
          items={filteredActivities}
          loading={loading}
          groupByDate
          emptyText={
            filter === 'all'
              ? '暂无跟进记录'
              : '该方式下暂无跟进记录'
          }
        />
      </Card>
    </div>
  );
};

export default FollowUpTab;

// 内部 dayjs 仅在父级 onSubmit 处理时使用；这里留一个 re-export 方便父级调整时区。
export { dayjs };
