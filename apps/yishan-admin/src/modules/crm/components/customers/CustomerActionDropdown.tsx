/**
 * 行操作列：[跟进] [···]
 *
 * ··· 菜单按权限码控制可见性，不可见就不渲染（不 disabled）。
 * 删除单独放最底 + danger + 二次确认。
 */

import { DownOutlined } from '@ant-design/icons';
import { useModel, useNavigate } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Dropdown, Modal, message, Space } from 'antd';
import React, { useState } from 'react';
import {
  type CustomerRow,
  claimCustomer,
  deleteCustomer,
  releaseCustomer,
  transferCustomer,
} from '@/services/crm';
import { usePermission } from '@/utils/permission';

export interface CustomerActionDropdownProps {
  record: CustomerRow;
  onChanged: () => void;
  /**
   * Phase 3 用：传入时点击 "跟进" 会调用此回调打开 Drawer 并跳到 followup tab；
   * 未传时退回原有 navigate 到详情页的行为。
   */
  onOpenFollowupDrawer?: (id: number) => void;
}

const CustomerActionDropdown: React.FC<CustomerActionDropdownProps> = ({
  record,
  onChanged,
  onOpenFollowupDrawer,
}) => {
  const can = usePermission();
  const navigate = useNavigate();
  const { initialState } = useModel('@@initialState');
  const currentUserId = initialState?.currentUser?.id;

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState('');

  const handleClaim = async () => {
    await claimCustomer(record.id);
    message.success('已认领到我的客户');
    onChanged();
  };

  const handleRelease = async () => {
    await releaseCustomer(record.id, releaseReason || undefined);
    message.success('客户已释放到公海');
    setReleaseOpen(false);
    setReleaseReason('');
    onChanged();
  };

  const handleTransfer = async () => {
    const targetUserId = Number(transferTarget);
    if (!targetUserId || Number.isNaN(targetUserId)) {
      message.error('请输入有效的目标用户 ID');
      return;
    }
    await transferCustomer(
      record.id,
      targetUserId,
      transferReason || undefined,
    );
    message.success('客户已转交');
    setTransferOpen(false);
    setTransferTarget('');
    setTransferReason('');
    onChanged();
  };

  const handleDelete = async () => {
    await deleteCustomer(record.id);
    message.success('已删除');
    onChanged();
  };

  const isOwned = record.poolStatus === 'owned';
  const isMine = isOwned && record.ownerUserId === currentUserId;

  type MenuKey =
    | 'open'
    | 'edit'
    | 'transfer'
    | 'release'
    | 'claim'
    | 'divider'
    | 'delete';

  const menuItems: MenuProps['items'] = [];
  menuItems.push({ key: 'open', label: '查看完整详情' });
  if (can('crm:customer:update')) {
    menuItems.push({ key: 'edit', label: '编辑客户' });
  }
  if (can('crm:customer:transfer') && isOwned) {
    menuItems.push({ key: 'transfer', label: '转交客户' });
  }
  if (can('crm:customer:release') && isOwned) {
    menuItems.push({ key: 'release', label: '释放到公海' });
  }
  if (can('crm:customer:claim') && !isOwned) {
    menuItems.push({ key: 'claim', label: '认领到我的客户' });
  }
  if (can('crm:customer:delete')) {
    menuItems.push({ key: 'divider', type: 'divider' });
    menuItems.push({ key: 'delete', label: '删除客户', danger: true });
  }

  const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent?.stopPropagation?.();
    switch (key as MenuKey) {
      case 'open':
        navigate(`/crm/customer-detail?id=${record.id}`);
        break;
      case 'edit':
        navigate(`/crm/customer-detail?id=${record.id}&edit=1`);
        break;
      case 'transfer':
        setTransferOpen(true);
        break;
      case 'release':
        setReleaseOpen(true);
        break;
      case 'claim':
        void handleClaim().catch((err: unknown) =>
          message.error((err as Error)?.message ?? '认领失败'),
        );
        break;
      case 'delete':
        Modal.confirm({
          title: `确认删除「${record.name}」？`,
          content: '删除后可在回收站中恢复。',
          okText: '删除',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: async () => {
            try {
              await handleDelete();
            } catch (err: unknown) {
              message.error((err as Error)?.message ?? '删除失败');
            }
          },
        });
        break;
      default:
        break;
    }
  };

  // 占位，移除 isMine 警告避免后续 lint 干扰
  void isMine;

  return (
    <Space size={12} onClick={(e) => e.stopPropagation()}>
      <a
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenFollowupDrawer) {
            onOpenFollowupDrawer(record.id);
          } else {
            navigate(`/crm/customers/${record.id}?focus=followup`);
          }
        }}
      >
        跟进
      </a>
      <Dropdown
        trigger={['click']}
        menu={{ items: menuItems, onClick: onMenuClick }}
      >
        <a>
          更多
          <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
        </a>
      </Dropdown>

      <Modal
        title={`转交客户「${record.name}」`}
        open={transferOpen}
        onCancel={() => setTransferOpen(false)}
        onOk={handleTransfer}
        okText="确认转交"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 4 }}>目标用户 ID</div>
            <input
              type="number"
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
              placeholder="请输入目标用户 ID"
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
              }}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>转交原因（可选）</div>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="区域调整 / 客户类型变更..."
              maxLength={500}
              style={{
                width: '100%',
                minHeight: 80,
                padding: 8,
                border: '1px solid #d9d9d9',
                borderRadius: 4,
              }}
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title={`释放客户「${record.name}」到公海`}
        open={releaseOpen}
        onCancel={() => setReleaseOpen(false)}
        onOk={handleRelease}
        okText="确认释放"
      >
        <p style={{ color: '#8c8c8c' }}>
          释放后该客户将进入公海，其他销售可认领。
        </p>
        <textarea
          value={releaseReason}
          onChange={(e) => setReleaseReason(e.target.value)}
          placeholder="释放原因（可选）"
          maxLength={500}
          style={{
            width: '100%',
            minHeight: 80,
            padding: 8,
            border: '1px solid #d9d9d9',
            borderRadius: 4,
          }}
        />
      </Modal>
    </Space>
  );
};

export default CustomerActionDropdown;
