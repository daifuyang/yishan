/**
 * 下次跟进卡片（用于 OverviewTab 右侧）。
 *
 * 当前数据来自 customer.nextFollowUpAt —— 没有专门的 plan 字段。
 * 计划文案留作 Phase 3 接入（CRM 实体可补 nextFollowUpPlan）。
 */

import { CalendarOutlined } from '@ant-design/icons';
import { Button, Empty, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';

const { Text } = Typography;

export interface NextFollowUpProps {
  nextFollowUpAt: string | null;
  plan?: string | null;
  onAdjust?: () => void;
}

const NextFollowUp: React.FC<NextFollowUpProps> = ({
  nextFollowUpAt,
  plan,
  onAdjust,
}) => {
  if (!nextFollowUpAt) {
    return (
      <div>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary">暂无下次跟进计划</Text>}
          style={{ margin: '8px 0' }}
        />
        <div style={{ textAlign: 'right' }}>
          <Button
            size="small"
            icon={<CalendarOutlined />}
            disabled
            onClick={onAdjust}
          >
            调整时间
          </Button>
        </div>
      </div>
    );
  }

  const d = dayjs(nextFollowUpAt);
  const display = d.isValid()
    ? d.format('YYYY-MM-DD HH:mm')
    : nextFollowUpAt;

  return (
    <div>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            下次跟进
          </Text>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1677ff',
              marginTop: 2,
            }}
          >
            <CalendarOutlined style={{ marginRight: 6 }} />
            {display}
          </div>
        </div>
        {plan && (
          <div style={{ fontSize: 13, color: '#262626' }}>{plan}</div>
        )}
      </Space>
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <Button
          size="small"
          icon={<CalendarOutlined />}
          disabled
          onClick={onAdjust}
        >
          调整时间
        </Button>
      </div>
    </div>
  );
};

export default NextFollowUp;
