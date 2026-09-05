/**
 * 客户 Drawer — Opportunities Tab。
 *
 * Phase 2 占位：商机模块（crm_opportunity / crm_quotation）尚未实现，
 * 只展示"开发中"空状态 + disabled [+ 新建商机] 按钮。
 */

import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty } from 'antd';
import React from 'react';

const OpportunitiesTab: React.FC = () => {
  return (
    <Card>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="商机功能开发中（Phase 3）"
        style={{ padding: '24px 0' }}
      >
        <Button icon={<PlusOutlined />} disabled>
          新建商机
        </Button>
      </Empty>
    </Card>
  );
};

export default OpportunitiesTab;
