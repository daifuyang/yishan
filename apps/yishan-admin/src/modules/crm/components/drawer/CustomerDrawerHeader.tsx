/**
 * 客户 Drawer Header。
 *
 * 结构（与 LeadDetailDrawer 对齐）：
 *   - 左：[客户名 + DrawerStatusTag] + DrawerMetaRow（负责人/最近跟进/下次跟进/客户等级/当前状态）
 *   - 右 actions：[新增▼] [转移▼] [编辑] [更多▼] [↗ 新窗口] [× 关闭]
 *
 * 行为：
 *   - 新增 ▼：联系人 / 商机 / 合同 / 费用 / 报价单 / 回款记录 / 开票记录
 *     · 后端未接入前都走 toast 占位
 *   - 转移 ▼：转移给同事 / 转移至公海
 *     · 公海客户不渲染"转移给同事"；owned 客户不渲染"转移至公海"
 *   - 编辑 → 全屏编辑（暂占位，Phase 3 接入）
 *   - 更多 ▼：打印 / 锁定 / 删除
 *     · 删除内嵌 DrawerDeletePopconfirm
 *
 * 权限：所有按钮按 crm:customer:* 权限码显隐；无权限不渲染（不 disabled 假装）。
 */

import { DownOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Dropdown, message, Space, Tooltip, Typography } from 'antd';
import React from 'react';
import type { CustomerDetail } from '@/services/crm';
import { usePermission } from '@/utils/permission';
import DrawerCloseButton from './_shared/DrawerCloseButton';
import DrawerDeletePopconfirm from './_shared/DrawerDeletePopconfirm';
import DrawerMetaRow from './_shared/DrawerMetaRow';
import DrawerNewWindowButton from './_shared/DrawerNewWindowButton';
import DrawerStatusTag from './_shared/DrawerStatusTag';
import { formatDateTime } from '@/utils/formatDate';

const { Text } = Typography;

const POOL_STATUS_LABEL: Record<string, string> = {
  owned: '已分配',
  public: '公海',
};

export interface CustomerDrawerHeaderProps {
  customer: CustomerDetail;
  onClose: () => void;
  /** 全屏编辑 / 新建（暂占位）。 */
  onEdit?: () => void;
  /** 新增 ▼ 子菜单回调：entity = 联系人/商机/合同/费用/报价单/回款记录/开票记录 */
  onCreateEntity?: (entity: CreateEntityKey) => void;
  /** 转交给同事 */
  onTransfer?: () => void;
  /** 转移至公海 */
  onRelease?: () => void;
  /** 打印（占位） */
  onPrint?: () => void;
  /** 锁定（占位） */
  onLock?: () => void;
  /** 删除 */
  onDelete?: () => void;
}

export type CreateEntityKey =
  | 'contact'
  | 'opportunity'
  | 'contract'
  | 'expense'
  | 'quotation'
  | 'payment'
  | 'invoice';

const CREATE_LABELS: Array<{ key: CreateEntityKey; label: string }> = [
  { key: 'contact', label: '联系人' },
  { key: 'opportunity', label: '商机' },
  { key: 'contract', label: '合同' },
  { key: 'expense', label: '费用' },
  { key: 'quotation', label: '报价单' },
  { key: 'payment', label: '回款记录' },
  { key: 'invoice', label: '开票记录' },
];

const CustomerDrawerHeader: React.FC<CustomerDrawerHeaderProps> = ({
  customer,
  onClose,
  onEdit,
  onCreateEntity,
  onTransfer,
  onRelease,
  onPrint,
  onLock,
  onDelete,
}) => {
  const can = usePermission();

  const canCreate = can('crm:customer:update') || can('crm:contact:create');
  const canTransfer =
    can('crm:customer:transfer') && customer.poolStatus === 'owned';
  const canRelease =
    can('crm:customer:release') && customer.poolStatus === 'owned';
  const canUpdate = can('crm:customer:update');
  const canDelete = can('crm:customer:delete');

  const handleCreateMenuClick: MenuProps['onClick'] = ({ key }) => {
    onCreateEntity?.(key as CreateEntityKey);
  };

  const handleTransferMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'transfer') {
      onTransfer?.();
    } else if (key === 'release') {
      onRelease?.();
    }
  };

  const handleMoreMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    // delete 由 Popconfirm 处理，避免点两次
    if (key === 'delete') {
      domEvent?.stopPropagation?.();
      return;
    }
    switch (key) {
      case 'print':
        if (onPrint) onPrint();
        else message.info('打印功能开发中');
        break;
      case 'lock':
        if (onLock) onLock();
        else message.info('锁定功能开发中');
        break;
      default:
        break;
    }
  };

  const metaItems = [
    {
      label: '负责人：',
      value:
        customer.poolStatus === 'public'
          ? '客户公海'
          : customer.ownerUserName?.trim() || '暂未分配',
    },
    {
      label: '最近跟进：',
      value: formatDateTime(customer.lastFollowUpAt),
    },
    {
      label: '下次跟进：',
      value: formatDateTime(customer.nextFollowUpAt),
    },
    { label: '客户等级：', value: customer.level ?? '—' },
    { label: '当前状态：', value: customer.statusName ?? '—' },
  ];

  return (
    <div
      style={{
        padding: '16px 20px',
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
        {/* 左：标题 + status tag + meta row */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              height: 28,
            }}
          >
            <Text
              strong
              style={{ fontSize: 18, lineHeight: '28px' }}
              ellipsis={{ tooltip: customer.name }}
            >
              {customer.name}
            </Text>
            <DrawerStatusTag
              status={customer.poolStatus}
              label={POOL_STATUS_LABEL[customer.poolStatus] ?? customer.poolStatus}
            />
            {customer.statusName && (
              <DrawerStatusTag status={customer.statusName} />
            )}
          </div>
          <DrawerMetaRow items={metaItems} />
        </div>

        {/* 右：主操作 + 图标 */}
        <Space size={8} wrap>
          {canCreate && onCreateEntity && (
            <Dropdown
              trigger={['click']}
              menu={{
                items: CREATE_LABELS.map((c) => ({
                  key: c.key,
                  label: c.label,
                })),
                onClick: handleCreateMenuClick,
              }}
            >
              <Button type="primary">
                新增
                <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
              </Button>
            </Dropdown>
          )}
          {(canTransfer || canRelease) && (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  canTransfer && onTransfer
                    ? { key: 'transfer', label: '转移给同事' }
                    : null,
                  canRelease && onRelease
                    ? { key: 'release', label: '转移至公海' }
                    : null,
                ].filter(Boolean) as Array<{ key: string; label: string }>,
                onClick: handleTransferMenuClick,
              }}
            >
              <Button>
                转移
                <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
              </Button>
            </Dropdown>
          )}
          {canUpdate && onEdit && (
            <Button onClick={onEdit}>编辑</Button>
          )}
          {(canDelete || onPrint || onLock) && (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'print', label: '打印' },
                  { key: 'lock', label: '锁定' },
                  canDelete && onDelete
                    ? {
                        key: 'delete',
                        label: (
                          <DrawerDeletePopconfirm
                            targetName={customer.name}
                            onConfirm={() => onDelete()}
                          >
                            <span style={{ color: '#d4380d' }}>删除</span>
                          </DrawerDeletePopconfirm>
                        ),
                      }
                    : null,
                ].filter(Boolean) as MenuProps['items'],
                onClick: handleMoreMenuClick,
              }}
            >
              <Button>
                更多
                <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
              </Button>
            </Dropdown>
          )}
          <Tooltip title="新窗口打开完整详情">
            <DrawerNewWindowButton onOpen={() => message.info('全屏模式开发中')} />
          </Tooltip>
          <DrawerCloseButton onClose={onClose} tooltip="关闭客户详情" />
        </Space>
      </div>
    </div>
  );
};

export default CustomerDrawerHeader;