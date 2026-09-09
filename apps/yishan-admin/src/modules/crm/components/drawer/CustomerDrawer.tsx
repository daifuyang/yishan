/**
 * 客户 Drawer 主壳（对齐线索 Drawer 风格的 Workspace 重构版）。
 *
 * 职责：
 *   - 宽度由 useResizableDrawer 维护（≥1100px），可拖拽右边沿
 *   - open / customerId 由父组件传入；onClose 时清掉 URL 上的 customerId 由 hook 负责
 *   - 顶部 Header：CustomerDrawerHeader
 *   - 11 个 Tab：基本信息（分段详情 + 活动 rail）/ 联系人 / 线索 / 商机 / 报价单 /
 *     合同 / 费用 / 已成交产品 / 任务 / 附件 / 操作日志
 *
 * 出错处理：
 *   - 404 → 提示 "客户不存在或已被删除"
 *   - 403 → 静默忽略（permission-denied silent）
 *   - 其他错误 → antd message.error
 */

import { Button, Skeleton, Tabs, message as antdMessage } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  type ContactRow,
  type CustomerDetail,
  type StatusRow,
  deleteCustomer,
  getCustomer,
  listContactsByCustomer,
} from '@/services/crm';
import DrawerChrome from './_shared/DrawerChrome';
import { useResizableDrawer } from './_shared/useResizableDrawer';
import CustomerDrawerHeader, {
  type CreateEntityKey,
} from './CustomerDrawerHeader';
import BasicInfoTab from './tabs/BasicInfoTab';
import ContactsTab from './tabs/ContactsTab';
import OpportunitiesTab from './tabs/OpportunitiesTab';
import PlaceholderTab from './tabs/PlaceholderTab';

export type CustomerDrawerTabKey =
  | 'basic'
  | 'contacts'
  | 'leads'
  | 'opportunities'
  | 'quotations'
  | 'contracts'
  | 'expenses'
  | 'products'
  | 'tasks'
  | 'attachments'
  | 'activityLog';

const TAB_LABELS: Array<{ key: CustomerDrawerTabKey; label: string }> = [
  { key: 'basic', label: '基本信息' },
  { key: 'contacts', label: '联系人' },
  { key: 'leads', label: '线索' },
  { key: 'opportunities', label: '商机' },
  { key: 'quotations', label: '报价单' },
  { key: 'contracts', label: '合同' },
  { key: 'expenses', label: '费用' },
  { key: 'products', label: '已成交产品' },
  { key: 'tasks', label: '任务' },
  { key: 'attachments', label: '附件' },
  { key: 'activityLog', label: '操作日志' },
];

const PLACEHOLDER_TABS: Array<{
  key: CustomerDrawerTabKey;
  entity: string;
}> = [
  { key: 'leads', entity: '线索' },
  { key: 'opportunities', entity: '商机' },
  { key: 'quotations', entity: '报价单' },
  { key: 'contracts', entity: '合同' },
  { key: 'expenses', entity: '费用' },
  { key: 'products', entity: '已成交产品' },
  { key: 'tasks', entity: '任务' },
  { key: 'attachments', entity: '附件' },
  { key: 'activityLog', entity: '操作日志' },
];

export interface CustomerDrawerProps {
  open: boolean;
  customerId: number | null;
  initialTab?: CustomerDrawerTabKey;
  onClose: () => void;
  /** 任意数据被变更后通知上层 reload 列表/计数。 */
  onChanged?: () => void;
  statuses: StatusRow[];
  /** Drawer 右上"新增"子菜单回调映射；undefined 时该子项仍渲染但走 toast 占位。 */
  onCreateEntity?: (entity: CreateEntityKey) => void;
  /** Drawer 右上"转移"按钮回调；undefined 时走 toast 占位。 */
  onTransfer?: (customer: CustomerDetail) => void;
  onRelease?: (customer: CustomerDetail) => void;
}

const CustomerDrawer: React.FC<CustomerDrawerProps> = ({
  open,
  customerId,
  initialTab = 'basic',
  onClose,
  onChanged,
  statuses,
  onCreateEntity,
  onTransfer,
  onRelease,
}) => {
  const [size, setSize] = useResizableDrawer();
  const [activeTab, setActiveTab] =
    useState<CustomerDrawerTabKey>(initialTab);

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // customerId / open 变化时拉详情
  useEffect(() => {
    if (!open || !customerId) {
      setCustomer(null);
      setCustomerError(null);
      setCustomerLoading(false);
      return;
    }
    let cancelled = false;
    setCustomerLoading(true);
    setCustomerError(null);
    setCustomer(null);
    setActiveTab(initialTab);

    const run = async () => {
      try {
        const c = await getCustomer(customerId);
        if (cancelled) return;
        setCustomer(c);
      } catch (err: unknown) {
        if (cancelled) return;
        const e = err as { name?: string; response?: { status?: number } };
        const status = e?.response?.status ?? e?.name;
        if (status === 404 || status === 'NotFoundError') {
          setCustomerError('客户不存在或已被删除');
        } else if (status === 403 || status === 'ForbiddenError') {
          setCustomerError('没有访问权限');
        } else {
          const msg = (err as Error)?.message ?? '客户详情加载失败';
          setCustomerError(msg);
          antdMessage.error(msg);
        }
      } finally {
        if (!cancelled) setCustomerLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, customerId, initialTab]);

  const handleFollowUpSaved = () => {
    // 跟进写完后，可能改了 statusId；主动重拉详情同步头部 MetaRow 与 status tag
    if (!customerId) return;
    getCustomer(customerId)
      .then((c) => setCustomer(c))
      .catch(() => undefined);
    onChanged?.();
  };

  const handleCreateEntity = (entity: CreateEntityKey) => {
    if (onCreateEntity) {
      onCreateEntity(entity);
    } else {
      const label =
        CREATE_ENTITY_TOAST[entity] ?? `${entity}功能开发中`;
      antdMessage.info(label);
    }
  };

  const handleTransfer = () => {
    if (!customer) return;
    if (onTransfer) onTransfer(customer);
    else antdMessage.info('转交（Phase 3 接入弹窗）');
  };

  const handleRelease = () => {
    if (!customer) return;
    if (onRelease) onRelease(customer);
    else antdMessage.info('释放到公海（Phase 3 接入弹窗）');
  };

  const handleDelete = async () => {
    if (!customer) return;
    try {
      await deleteCustomer(customer.id);
      antdMessage.success('已删除');
      onChanged?.();
      onClose();
    } catch (err: unknown) {
      antdMessage.error((err as Error)?.message ?? '删除失败');
    }
  };

  const renderBody = () => {
    if (customerLoading && !customer) {
      return (
        <div style={{ padding: 24 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      );
    }
    if (customerError) {
      return (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: '#8c8c8c',
          }}
        >
          <div style={{ fontSize: 14, marginBottom: 12 }}>
            {customerError}
          </div>
          <Button onClick={onClose}>关闭</Button>
        </div>
      );
    }
    if (!customer) {
      return (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: '#8c8c8c',
          }}
        >
          请选择一个客户
        </div>
      );
    }

    return (
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as CustomerDrawerTabKey)}
        destroyInactiveTabPane={false}
        style={{ padding: '0 20px' }}
        items={TAB_LABELS.map((t) => ({
          key: t.key,
          label: t.label,
          children: renderTab(t.key, customer),
        }))}
      />
    );
  };

  const renderTab = (key: CustomerDrawerTabKey, current: CustomerDetail) => {
    switch (key) {
      case 'basic':
        return (
          <BasicInfoTab
            customer={current}
            statuses={statuses}
            onFollowUpSaved={handleFollowUpSaved}
          />
        );
      case 'contacts':
        return <ContactsTabStandalone customerId={current.id} />;
      case 'opportunities':
        return <OpportunitiesTab />;
      default: {
        const placeholder = PLACEHOLDER_TABS.find((p) => p.key === key);
        if (placeholder) {
          return <PlaceholderTab entity={placeholder.entity} />;
        }
        return null;
      }
    }
  };

  return (
    <DrawerChrome
      open={open}
      onClose={onClose}
      size={size}
      setSize={setSize}
      maskClosable
      styles={{
        header: { padding: 0 },
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        },
      }}
    >
      {customer && (
        <CustomerDrawerHeader
          customer={customer}
          onClose={onClose}
          onEdit={() => antdMessage.info('全屏编辑模式开发中；当前请在 Drawer 内操作')}
          onCreateEntity={handleCreateEntity}
          onTransfer={handleTransfer}
          onRelease={handleRelease}
          onDelete={handleDelete}
        />
      )}
      {renderBody()}
    </DrawerChrome>
  );
};

export default CustomerDrawer;

const CREATE_ENTITY_TOAST: Record<CreateEntityKey, string> = {
  contact: '新建联系人请到基本信息 tab 的联系人入口（Phase 3 接入表单）',
  opportunity: '新建商机功能开发中（Phase 3）',
  contract: '新建合同功能开发中（Phase 3）',
  expense: '新建费用功能开发中（Phase 3）',
  quotation: '新建报价单功能开发中（Phase 3）',
  payment: '新建回款记录功能开发中（Phase 3）',
  invoice: '新建开票记录功能开发中（Phase 3）',
};

/**
 * ContactsTab 的 standalone 包装：自己拉 listContactsByCustomer，
 * 因为 ContactsTab 设计是父级传 contacts 进来。
 *
 * 写操作（create/edit/delete）目前都走 toast 占位。
 */
const ContactsTabStandalone: React.FC<{ customerId: number }> = ({
  customerId,
}) => {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listContactsByCustomer(customerId)
      .then((rows) => {
        if (!cancelled) setContacts(rows);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <ContactsTab
      contacts={contacts}
      loading={loading}
      onCreate={() =>
        antdMessage.info('新建联系人（Phase 3 接入表单）')
      }
      onEdit={(c) =>
        antdMessage.info(`编辑联系人「${c.name}」（Phase 3 接入表单）`)
      }
      onDelete={(c) =>
        antdMessage.info(`删除联系人「${c.name}」（Phase 3 接入接口）`)
      }
    />
  );
};