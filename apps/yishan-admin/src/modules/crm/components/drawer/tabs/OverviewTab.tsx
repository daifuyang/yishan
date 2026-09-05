/**
 * 客户 Drawer — Overview Tab。
 *
 * 2 列布局 (65% / 35%)：
 *   左：AI 摘要卡片 + 跟进活动时间线（最多 30 条）
 *   右：客户概览 / 联系人 Top3 / 下次跟进
 */

import { RightOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Empty, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import type {
  ActivityRow,
  ContactRow,
  CustomerDetail,
} from '@/services/crm';
import ActivityTimeline from '../sub/ActivityTimeline';
import AiCustomerSummary from '../sub/AiCustomerSummary';
import ContactPreview from '../sub/ContactPreview';
import NextFollowUp from '../sub/NextFollowUp';

const { Text } = Typography;

export interface OverviewTabProps {
  customer: CustomerDetail;
  activities: ActivityRow[];
  activitiesLoading: boolean;
  contacts: ContactRow[];
  contactsLoading: boolean;
  onJumpToContacts: () => void;
  onAdjustNextFollowUp?: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  customer,
  activities,
  activitiesLoading,
  contacts,
  contactsLoading,
  onJumpToContacts,
  onAdjustNextFollowUp,
}) => {
  const topContacts = contacts.slice(0, 3);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '65% 35%',
        gap: 16,
      }}
    >
      {/* 左列 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AiCustomerSummary />
        <Card
          size="small"
          title="跟进活动"
          bodyStyle={{ padding: 16 }}
        >
          <ActivityTimeline
            items={activities}
            loading={activitiesLoading}
            limit={30}
            groupByDate
            emptyText="暂无跟进记录"
          />
        </Card>
      </div>

      {/* 右列 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card size="small" title="客户概览" bodyStyle={{ padding: 16 }}>
          <Descriptions
            column={1}
            size="small"
            colon={false}
            labelStyle={{ color: '#8c8c8c', width: 80 }}
          >
            <Descriptions.Item label="行业">
              {customer.industry || <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="来源">
              {customer.sourceName || <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="电话">
              {customer.phone ? (
                <span>{customer.phone}</span>
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="地区">
              {[customer.province, customer.city]
                .filter(Boolean)
                .join(' / ') || <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="创建于">
              {customer.createdAt
                ? dayjs(customer.createdAt).format('YYYY-MM-DD HH:mm')
                : '—'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card
          size="small"
          title={
            <Space>
              <span>联系人</span>
              {contacts.length > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  共 {contacts.length}
                </Text>
              )}
            </Space>
          }
          extra={
            contacts.length > 0 ? (
              <Button
                type="link"
                size="small"
                onClick={onJumpToContacts}
                style={{ padding: 0 }}
              >
                查看全部
                <RightOutlined style={{ fontSize: 10 }} />
              </Button>
            ) : null
          }
          bodyStyle={{ padding: contactsLoading ? 16 : 8 }}
        >
          {contactsLoading ? (
            <ActivityTimeline items={[]} loading />
          ) : topContacts.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无联系人"
              style={{ margin: '12px 0' }}
            />
          ) : (
            <div>
              {topContacts.map((c) => (
                <ContactPreview
                  key={c.id}
                  contact={c}
                  onClick={onJumpToContacts}
                />
              ))}
            </div>
          )}
        </Card>

        <Card size="small" title="下次跟进" bodyStyle={{ padding: 16 }}>
          <NextFollowUp
            nextFollowUpAt={customer.nextFollowUpAt}
            plan={null}
            onAdjust={onAdjustNextFollowUp}
          />
        </Card>
      </div>
    </div>
  );
};

export default OverviewTab;
