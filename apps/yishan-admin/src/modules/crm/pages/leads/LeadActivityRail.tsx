import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  Button,
  DatePicker,
  Divider,
  Form,
  message,
  Popover,
  Spin,
  Timeline,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { LeadActivityRow, LeadRow } from '@/services/crm';
import { createLeadActivity, listLeadActivities } from '@/services/crm';
import { formatDateTime } from '@/utils/formatDate';
import {
  type LeadFollowUpFormValues,
  toLeadActivityInput,
} from './leadFollowUpForm';
import {
  buildLeadTimeline,
  filterLeadTimelineByDateRange,
  groupLeadTimelineByDate,
  type LeadTimelineCategory,
} from './leadTimeline';

type ActivityFilter = 'all' | LeadTimelineCategory;

const filterLabels: Array<{ key: ActivityFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'followup', label: '跟进' },
  { key: 'status', label: '状态变更' },
  { key: 'system', label: '系统记录' },
];

const typeOptions = [
  { value: 'phone', label: '电话' },
  { value: 'wechat', label: '微信' },
  { value: 'visit', label: '拜访' },
  { value: 'meeting', label: '会议' },
  { value: 'email', label: '邮件' },
  { value: 'other', label: '其他' },
];

const dateLabel = (date: string) => {
  const value = dayjs(date);
  if (value.isSame(dayjs(), 'day')) return `今天 · ${value.format('MM月DD日')}`;
  if (value.isSame(dayjs().subtract(1, 'day'), 'day'))
    return `昨天 · ${value.format('MM月DD日')}`;
  return value.format('YYYY年MM月DD日');
};

export default function LeadActivityRail({ lead }: { lead: LeadRow }) {
  const [activities, setActivities] = useState<LeadActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [filterForm] = Form.useForm<{ dateRange?: [Dayjs, Dayjs] }>();
  const [createdAtRange, setCreatedAtRange] = useState<[string, string] | null>(
    null,
  );
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listLeadActivities(lead.id)
      .then((result) => active && setActivities(result.items))
      .catch(() => active && message.error('动态加载失败，请稍后重试'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [lead.id]);

  const groups = useMemo(() => {
    const events = filterLeadTimelineByDateRange(
      buildLeadTimeline(lead, activities).filter(
        (event) => filter === 'all' || event.category === filter,
      ),
      createdAtRange,
    );
    return groupLeadTimelineByDate(events);
  }, [activities, createdAtRange, filter, lead]);

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
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setFollowUpModalOpen(true)}
        >
          写跟进
        </Button>
      </div>
      <ModalForm<LeadFollowUpFormValues>
        open={followUpModalOpen}
        onOpenChange={setFollowUpModalOpen}
        title="写跟进"
        initialValues={{ type: 'phone' }}
        modalProps={{ destroyOnHidden: true }}
        onFinish={async (values) => {
          const item = await createLeadActivity(
            lead.id,
            toLeadActivityInput(values),
          );
          setActivities((current) => [item, ...current]);
          message.success('跟进已保存');
          return true;
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
          fieldProps={{ autoSize: { minRows: 4, maxRows: 8 }, maxLength: 2000 }}
          rules={[
            { required: true, whitespace: true, message: '请填写本次跟进内容' },
          ]}
        />
        <ProFormDateTimePicker
          name="nextFollowUpAt"
          label="下次跟进"
          placeholder="请选择下次跟进时间"
          width="md"
        />
      </ModalForm>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 14,
          whiteSpace: 'nowrap',
        }}
      >
        {filterLabels.map((item) => (
          <Button
            key={item.key}
            type="text"
            size="small"
            onClick={() => setFilter(item.key)}
            style={{
              padding: 0,
              color: filter === item.key ? '#1677ff' : '#667085',
              fontWeight: filter === item.key ? 500 : 400,
            }}
          >
            {item.label}
          </Button>
        ))}
        <Popover
          content={
            <Form
              form={filterForm}
              layout="vertical"
              onValuesChange={(_, values) => {
                const dateRange = values.dateRange as
                  | [Dayjs, Dayjs]
                  | undefined;
                setCreatedAtRange(
                  dateRange
                    ? [
                        dateRange[0].startOf('day').toISOString(),
                        dateRange[1].endOf('day').toISOString(),
                      ]
                    : null,
                );
              }}
              style={{ width: 280 }}
            >
              <Form.Item
                label="创建时间"
                name="dateRange"
                style={{ margin: 0 }}
              >
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Form>
          }
          trigger="hover"
          mouseEnterDelay={0.1}
          mouseLeaveDelay={0.2}
        >
          <Button
            type="link"
            size="small"
            style={{ marginLeft: 'auto', paddingInline: 0 }}
          >
            筛选
          </Button>
        </Popover>
      </div>
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
          groups.map((group) => (
            <section key={group.date} style={{ marginBottom: 24 }}>
              <Typography.Text
                type="secondary"
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 10,
                  color: '#98a2b3',
                }}
              >
                {dateLabel(group.date)}
              </Typography.Text>
              <Timeline
                items={group.events.map((item) => ({
                  color: item.color,
                  children: (
                    <div style={{ paddingBottom: 12 }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'baseline',
                        }}
                      >
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 11, color: '#98a2b3' }}
                        >
                          {dayjs(item.time).format('HH:mm')}
                        </Typography.Text>
                        <Typography.Text strong style={{ fontSize: 14 }}>
                          {item.title}
                        </Typography.Text>
                      </div>
                      {item.detail && (
                        <Typography.Paragraph
                          style={{
                            margin: '6px 0 0',
                            fontSize: 14,
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {item.detail}
                        </Typography.Paragraph>
                      )}
                      {(item.operator || item.nextFollowUpAt) && (
                        <Typography.Text
                          type="secondary"
                          style={{
                            display: 'block',
                            marginTop: 5,
                            fontSize: 12,
                          }}
                        >
                          {[
                            item.operator,
                            item.nextFollowUpAt
                              ? `下次跟进：${formatDateTime(item.nextFollowUpAt)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Typography.Text>
                      )}
                    </div>
                  ),
                }))}
              />
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
