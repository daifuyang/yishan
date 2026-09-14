import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Button, Divider, message, Spin, Timeline, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import type { LeadActivityRow, LeadRow, LeadStatus } from '@/services/crm';
import { createLeadActivity, listLeadActivities } from '@/services/crm';
import { formatDateTime } from '@/utils/formatDate';
import DrawerFilterBar from '../../components/drawer/_shared/DrawerFilterBar';
import { CRM_DIALOG_Z_INDEX } from '../../components/drawer/_shared/crmDialogZIndex';
import { groupByDate } from '../../components/drawer/_shared/groupByDate';
import {
  type LeadFollowUpFormValues,
  toLeadActivityInput,
} from './leadFollowUpForm';
import { buildLeadTimeline, type LeadTimelineCategory } from './leadTimeline';

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

const followUpStatusOptions: Array<{ value: LeadStatus; label: string }> = [
  { value: 'pending', label: '未处理' },
  { value: 'contact_valid', label: '联系方式有效' },
  { value: 'contact_invalid', label: '联系方式无效' },
  { value: 'closed', label: '已关闭' },
];

export default function LeadActivityRail({
  lead,
  onLeadChanged,
}: {
  lead: LeadRow;
  onLeadChanged?: (next: LeadRow) => void;
}) {
  // 无负责人即在线索池。池内线索尚未归属，不能产生任何销售跟进记录。
  const canWriteFollowUp = lead.ownerUserId !== null;
  const [activities, setActivities] = useState<LeadActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string } | null>(
    null,
  );
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

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
    const events = buildLeadTimeline(lead, activities).filter(
      (event) => filter === 'all' || event.category === filter,
    );
    const ranged = dateRange
      ? events.filter((event) => {
          const t = dayjs(event.time);
          const from = dateRange.from ? dayjs(dateRange.from).startOf('day') : null;
          const to = dateRange.to ? dayjs(dateRange.to).endOf('day') : null;
          if (from && t.isBefore(from)) return false;
          if (to && t.isAfter(to)) return false;
          return true;
        })
      : events;
    return groupByDate(ranged, (event) => event.time);
  }, [activities, dateRange, filter, lead]);

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
            onClick={() => setFollowUpModalOpen(true)}
          >
            写跟进
          </Button>
        )}
      </div>
      {canWriteFollowUp && (
        <ModalForm<LeadFollowUpFormValues>
          open={followUpModalOpen}
          onOpenChange={setFollowUpModalOpen}
          title="写跟进"
          initialValues={{
            type: 'phone',
            followUpStatus: lead.status ?? 'pending',
          }}
          modalProps={{
            destroyOnHidden: true,
            okButtonProps: { loading: followUpSubmitting },
            // 写跟进弹窗在抽屉里打开（LeadActivityRail 渲染在抽屉 children 里），
            // 同样要走 CRM_DIALOG_Z_INDEX，保证 Modal 浮在抽屉内容之上。
            zIndex: CRM_DIALOG_Z_INDEX,
          }}
          onFinish={async (values) => {
            setFollowUpSubmitting(true);
            try {
              const result = await createLeadActivity(
                lead.id,
                toLeadActivityInput(values),
              );
              if (result.lead.id === lead.id) {
                onLeadChanged?.(result.lead);
              }
              setActivities((current) => [result.activity, ...current]);
              setFollowUpModalOpen(false);
              message.success('跟进已保存');
              // 状态改变时服务端会追加一条审计。保存已经成功后再异步刷新完整
              // 时间线；刷新失败不能把已提交的表单误报为失败或诱导重复提交。
              void listLeadActivities(lead.id)
                .then((refreshedActivities) =>
                  setActivities(refreshedActivities.items),
                )
                .catch(() =>
                  message.warning(
                    '跟进已保存，但动态刷新失败，请稍后刷新页面',
                  ),
                );
              return true;
            } catch (err: any) {
              message.error(err?.message ?? '跟进保存失败');
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
            fieldProps={{ autoSize: { minRows: 4, maxRows: 8 }, maxLength: 2000 }}
            rules={[
              { required: true, whitespace: true, message: '请填写本次跟进内容' },
            ]}
          />
          <ProFormSelect
            name="followUpStatus"
            label="跟进状态"
            options={followUpStatusOptions}
            rules={[{ required: true, message: '请选择跟进状态' }]}
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
                {group.label}
              </Typography.Text>
              <Timeline
                items={group.items.map((item) => ({
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
