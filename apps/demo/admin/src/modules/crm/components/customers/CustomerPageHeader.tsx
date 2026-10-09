/**
 * 客户列表页 PageHeader。
 *
 * 左侧：标题 + 副标题
 * 右侧：[+ 新建客户] 主按钮、[导入] 次按钮、[更多▼]
 *
 * 视觉约束：
 * - 副标题只一行，弱化色。
 * - 不靠大留白撑高级感，参考 system/user 顶部的密度。
 */

import {
  DownOutlined,
  ImportOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Space, Typography } from 'antd';
import React from 'react';
import { usePermission } from '@/utils/permission';

const { Title, Text } = Typography;

export interface CustomerPageHeaderProps {
  onCreate: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onDuplicateCheck?: () => void;
  onRecycleBin?: () => void;
}

const CustomerPageHeader: React.FC<CustomerPageHeaderProps> = ({
  onCreate,
  onImport,
  onExport,
  onDuplicateCheck,
  onRecycleBin,
}) => {
  const can = usePermission();

  const moreItems = [
    onExport && { key: 'export', label: '导出' },
    onDuplicateCheck && { key: 'dedup', label: '查重' },
    onRecycleBin && { key: 'recycle', label: '回收站' },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingBottom: 16,
      }}
    >
      <div>
        <Title level={4} style={{ margin: 0 }}>
          客户
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          统一管理客户、负责人、跟进状态与成交进展
        </Text>
      </div>

      <Space size={8}>
        {can('crm:customer:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            新建客户
          </Button>
        )}
        {onImport && can('crm:customer:create') && (
          <Button icon={<ImportOutlined />} onClick={onImport}>
            导入
          </Button>
        )}
        {moreItems.length > 0 && (
          <Dropdown menu={{ items: moreItems }} trigger={['click']}>
            <Button>
              更多操作
              <DownOutlined />
            </Button>
          </Dropdown>
        )}
        {moreItems.length === 0 && (
          <Button icon={<MoreOutlined />} disabled>
            更多操作
          </Button>
        )}
      </Space>
    </div>
  );
};

export default CustomerPageHeader;
