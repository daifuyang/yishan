/**
 * 客户 Drawer 顶部 Header。
 *
 * 结构：
 *   - 左：标题 + tag chips + 负责人
 *   - 中：[跟进] [新建联系人] [编辑] [更多▼]
 *   - 右：[↗ 新窗口] [× 关闭]
 *
 * 交互：
 *   - 跟进 → setActiveTab('followup') + 通知父级 focus 表单
 *   - 新建联系人 → onCreateContact()
 *   - 编辑 → window.open 客户详情页（Phase 4 把编辑搬进来后再换）
 *   - 更多菜单 → 转交 / 释放 / 修改负责人 / 归档 / 删除（部分暂用 message 占位）
 *   - [↗] → window.open 详情页
 *   - [×] → onClose()
 *
 * 按权限码显隐；无权限按钮不渲染（不 disabled 假装）。
 */

import {
  CloseOutlined,
  DownOutlined,
  ExportOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Space, Tag, Tooltip, Typography } from 'antd';
import React from 'react';
import type { CustomerDetail } from '@/services/crm';
import { usePermission } from '@/utils/permission';

const { Text, Title } = Typography;

const LEVEL_COLOR: Record<string, string> = {
  A: 'blue',
  B: 'geekblue',
  C: 'default',
  D: 'default',
};

export interface CustomerDrawerHeaderProps {
  customer: CustomerDetail;
  onClose: () => void;
  onFollowUp: () => void;
  onCreateContact: () => void;
  /** Phase 4 会接入；现在仅占位。 */
  onEdit?: () => void;
  onTransfer?: () => void;
  onRelease?: () => void;
  onChangeOwner?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

const CustomerDrawerHeader: React.FC<CustomerDrawerHeaderProps> = ({
  customer,
  onClose,
  onFollowUp,
  onCreateContact,
  onEdit,
  onTransfer,
  onRelease,
  onChangeOwner,
  onArchive,
  onDelete,
}) => {
  const can = usePermission();

  const handleOpenDetail = () => {
    if (typeof window === 'undefined') return;
    window.open(`/crm/customer-detail?id=${customer.id}`, '_blank');
  };

  const moreItems: MenuProps['items'] = [];
  if (can('crm:customer:transfer') && customer.poolStatus === 'owned') {
    moreItems.push({ key: 'transfer', label: '转交' });
  }
  if (can('crm:customer:release') && customer.poolStatus === 'owned') {
    moreItems.push({ key: 'release', label: '释放到公海' });
  }
  if (can('crm:customer:update')) {
    moreItems.push({ key: 'changeOwner', label: '修改负责人' });
  }
  if (can('crm:customer:update')) {
    moreItems.push({ key: 'archive', label: '归档' });
  }
  if (can('crm:customer:delete')) {
    moreItems.push({ key: 'divider', type: 'divider' });
    moreItems.push({ key: 'delete', label: '删除客户', danger: true });
  }

  const handleMoreClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent?.stopPropagation?.();
    switch (key) {
      case 'transfer':
        onTransfer?.();
        break;
      case 'release':
        onRelease?.();
        break;
      case 'changeOwner':
        onChangeOwner?.();
        break;
      case 'archive':
        onArchive?.();
        break;
      case 'delete':
        onDelete?.();
        break;
      default:
        break;
    }
  };

  return (
    <div
      style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* 左侧：标题 + tag + 负责人 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Title
            level={4}
            style={{
              margin: 0,
              fontSize: 20,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={customer.name}
          >
            {customer.name}
          </Title>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <Tag color={customer.poolStatus === 'public' ? 'default' : 'blue'}>
              {customer.poolStatus === 'public' ? '公海' : '已分配'}
            </Tag>
            {customer.statusName && (
              <Tag color="blue">{customer.statusName}</Tag>
            )}
            {customer.level && (
              <Tag color={LEVEL_COLOR[customer.level] ?? 'default'}>
                {customer.level}
              </Tag>
            )}
            {customer.industry && (
              <Tag color="default">{customer.industry}</Tag>
            )}
            {customer.sourceName && (
              <Tag color="purple">{customer.sourceName}</Tag>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <Text type="secondary">负责人：</Text>
            <Text>{customer.ownerUserName ?? '—'}</Text>
          </div>
        </div>

        {/* 中间：主操作按钮 */}
        <Space size={8} wrap>
          {can('crm:customer:update') && (
            <Button type="primary" onClick={onFollowUp}>
              跟进
            </Button>
          )}
          {can('crm:contact:create') && (
            <Button icon={<UserAddOutlined />} onClick={onCreateContact}>
              新建联系人
            </Button>
          )}
          {can('crm:customer:update') && (
            <Button onClick={onEdit}>编辑</Button>
          )}
          {moreItems.length > 0 && (
            <Dropdown
              trigger={['click']}
              menu={{ items: moreItems, onClick: handleMoreClick }}
            >
              <Button>
                更多
                <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
              </Button>
            </Dropdown>
          )}
        </Space>

        {/* 右上角图标 */}
        <Space size={4} style={{ marginLeft: 8 }}>
          <Tooltip title="在新窗口打开完整详情">
            <Button
              type="text"
              icon={<ExportOutlined />}
              onClick={handleOpenDetail}
              aria-label="新窗口打开"
            />
          </Tooltip>
          <Tooltip title="关闭">
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={onClose}
              aria-label="关闭"
            />
          </Tooltip>
        </Space>
      </div>
    </div>
  );
};

export default CustomerDrawerHeader;
