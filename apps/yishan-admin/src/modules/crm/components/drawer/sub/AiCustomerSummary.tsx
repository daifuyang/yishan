/**
 * AI 客户摘要卡片（Phase 2 占位）。
 *
 * Phase 5 接入真实 AI 后，这里会展示基于跟进记录 + 客户画像生成的摘要；
 * 当前只展示"暂未生成"的空状态 + 禁用的生成按钮（避免用户以为可点击）。
 */

import { ThunderboltOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Space, Typography } from 'antd';
import React from 'react';

const { Text } = Typography;

export interface AiCustomerSummaryProps {
  /** 自定义提示文案；默认 "AI 客户摘要暂未生成"。 */
  emptyText?: string;
}

const AiCustomerSummary: React.FC<AiCustomerSummaryProps> = ({
  emptyText,
}) => {
  return (
    <Card
      size="small"
      title={
        <Space size={6}>
          <ThunderboltOutlined style={{ color: '#1677ff' }} />
          <span>AI 客户摘要</span>
        </Space>
      }
      extra={
        <Text type="secondary" style={{ fontSize: 12 }}>
          基于跟进记录 + 客户画像生成
        </Text>
      }
      bodyStyle={{ padding: 16 }}
    >
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Text type="secondary">
            {emptyText ?? 'AI 客户摘要暂未生成'}
          </Text>
        }
        style={{ margin: '12px 0' }}
      >
        <Button disabled icon={<ThunderboltOutlined />}>
          生成摘要
        </Button>
      </Empty>
    </Card>
  );
};

export default AiCustomerSummary;
