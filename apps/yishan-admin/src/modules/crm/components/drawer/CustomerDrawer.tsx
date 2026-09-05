/**
 * 客户 Drawer 主壳（Phase 2）。
 *
 * 职责：
 * - 宽度由 useResponsiveDrawerWidth() 决定（1100 / 900 / '80vw'）
 * - open / customerId 由父组件传入；onClose 时清掉 URL 上的 customerId 由 hook 负责
 * - 内部管理活动 tab + 详情/活动/联系人/流转的数据拉取
 *   · 客户详情 + 流转记录：customerId 变化即全量拉
 *   · 联系人：ContactsTab 首次激活时拉
 *   · 活动：FollowUpTab / MoreTab 首次激活时拉；保存跟进后强制刷新
 *
 * 出错处理：
 * - 404 → 提示 "客户不存在或已被删除"
 * - 403 → 静默忽略（permission-denied silent）
 * - 其他错误 → antd message.error
 */

import { Button, Drawer, Modal, Skeleton, Tabs, message } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ActivityRow,
  type ContactRow,
  type CustomerDetail,
  type StatusRow,
  type TagRow,
  type TransferLogRow,
  createActivity,
  getCustomer,
  listActivitiesByCustomer,
  listContactsByCustomer,
  listTransfers,
} from '@/services/crm';
import { useResponsiveDrawerWidth } from '../../hooks/useResponsiveDrawerWidth';
import CustomerDrawerHeader from './CustomerDrawerHeader';
import CustomerDrawerSummary from './CustomerDrawerSummary';
import CustomerStagePipeline from './CustomerStagePipeline';
import ContactsTab from './tabs/ContactsTab';
import FollowUpTab, { type FollowUpFormValues } from './tabs/FollowUpTab';
import MoreTab from './tabs/MoreTab';
import OpportunitiesTab from './tabs/OpportunitiesTab';
import OverviewTab from './tabs/OverviewTab';

export type CustomerDrawerTabKey =
  | 'overview'
  | 'followup'
  | 'contacts'
  | 'opportunities'
  | 'more';

const TAB_LABELS: Array<{ key: CustomerDrawerTabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'followup', label: '跟进' },
  { key: 'contacts', label: '联系人' },
  { key: 'opportunities', label: '商机' },
  { key: 'more', label: '更多' },
];

export interface CustomerDrawerProps {
  open: boolean;
  customerId: number | null;
  initialTab?: CustomerDrawerTabKey;
  onClose: () => void;
  /** 任意数据被变更后通知上层 reload 列表/计数。 */
  onChanged?: () => void;
  statuses: StatusRow[];
  /** 当前未使用，预留给 DrawerHeader "更多" 菜单的标签过滤。 */
  tags?: TagRow[];
}

const CustomerDrawer: React.FC<CustomerDrawerProps> = ({
  open,
  customerId,
  initialTab = 'overview',
  onClose,
  onChanged,
  statuses,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tags: _tags,
}) => {
  const width = useResponsiveDrawerWidth();
  const [activeTab, setActiveTab] =
    useState<CustomerDrawerTabKey>(initialTab);
  const [requestFollowUpFocus, setRequestFollowUpFocus] = useState(false);

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const [_transfers, setTransfers] = useState<TransferLogRow[]>([]);

  // 用于 tab 内"操作后"局部刷新（比如保存跟进）—— 用 ref 避免重置初始 fetch
  const customerRef = useRef<CustomerDetail | null>(null);
  customerRef.current = customer;

  // ---- 详情 / 流转：customerId 变化时拉
  useEffect(() => {
    if (!open || !customerId) {
      setCustomer(null);
      setCustomerError(null);
      setCustomerLoading(false);
      setTransfers([]);
      return;
    }
    let cancelled = false;
    setCustomerLoading(true);
    setCustomerError(null);
    setCustomer(null);
    setContacts([]);
    setContactsLoaded(false);
    setActivities([]);
    setActivitiesLoaded(false);
    setActiveTab(initialTab);
    setRequestFollowUpFocus(initialTab === 'followup');

    const run = async () => {
      try {
        const [c, tr] = await Promise.all([
          getCustomer(customerId),
          listTransfers(customerId).catch(() => [] as TransferLogRow[]),
        ]);
        if (cancelled) return;
        setCustomer(c);
        setTransfers(tr);
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
          message.error(msg);
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

  // ---- 联系人：ContactsTab 首次激活时拉
  const ensureContacts = useCallback(async () => {
    if (!customerId || contactsLoaded || contactsLoading) return;
    setContactsLoading(true);
    try {
      const rows = await listContactsByCustomer(customerId);
      setContacts(rows);
      setContactsLoaded(true);
    } catch (err: unknown) {
      message.error((err as Error)?.message ?? '联系人加载失败');
    } finally {
      setContactsLoading(false);
    }
  }, [customerId, contactsLoaded, contactsLoading]);

  // ---- 活动：FollowUp / More 首次激活时拉
  const ensureActivities = useCallback(async () => {
    if (!customerId || activitiesLoaded || activitiesLoading) return;
    setActivitiesLoading(true);
    try {
      const res = await listActivitiesByCustomer(customerId);
      setActivities(res.items ?? []);
      setActivitiesLoaded(true);
    } catch (err: unknown) {
      message.error((err as Error)?.message ?? '跟进记录加载失败');
    } finally {
      setActivitiesLoading(false);
    }
  }, [customerId, activitiesLoaded, activitiesLoading]);

  useEffect(() => {
    if (!open) return;
    if (activeTab === 'contacts') {
      void ensureContacts();
    } else if (
      activeTab === 'followup' ||
      activeTab === 'more'
    ) {
      void ensureActivities();
    }
  }, [open, activeTab, ensureContacts, ensureActivities]);

  // ---- 操作回调 ----
  const handleFollowUpClick = () => {
    setActiveTab('followup');
    setRequestFollowUpFocus(true);
    void ensureActivities();
  };

  const handleFollowUpSubmit = async (values: FollowUpFormValues) => {
    if (!customerId) return;
    try {
      await createActivity(customerId, {
        type: values.type,
        content: values.content,
        occurredAt: new Date().toISOString(),
        nextFollowUpAt: values.nextFollowUpAt
          ? values.nextFollowUpAt.toISOString()
          : undefined,
      });
      // 阶段变化：父级 reload 详情即可（CRM 实体可能需要专门接口，Phase 3 完善）
      if (values.statusId && customerRef.current?.statusId !== values.statusId) {
        try {
          const { updateCustomer } = await import('@/services/crm');
          await updateCustomer(customerId, { statusId: values.statusId });
        } catch {
          /* statusId 同步失败不影响跟进保存 */
        }
      }
      message.success('跟进已记录');
      // 刷新活动 + 客户（statusId 可能已变）
      setActivitiesLoaded(false);
      void ensureActivities();
      try {
        const c = await getCustomer(customerId);
        setCustomer(c);
      } catch {
        /* ignore */
      }
      setRequestFollowUpFocus(false);
      onChanged?.();
    } catch (err: unknown) {
      message.error((err as Error)?.message ?? '保存跟进失败');
      throw err;
    }
  };

  const handleCreateContact = () => {
    message.info('新建联系人请到 FollowUp / 顶部 [+ 新建联系人]（Phase 3 接入表单）');
  };

  const handleEditCustomer = () => {
    if (!customerId) return;
    if (typeof window !== 'undefined') {
      window.open(`/crm/customer-detail?id=${customerId}&edit=1`, '_blank');
    }
  };

  const handleDeleteCustomer = () => {
    if (!customer) return;
    Modal.confirm({
      title: `确认删除「${customer.name}」？`,
      icon: <ExclamationCircleOutlined />,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const { deleteCustomer } = await import('@/services/crm');
          await deleteCustomer(customer.id);
          message.success('已删除');
          onChanged?.();
          onClose();
        } catch (err: unknown) {
          message.error((err as Error)?.message ?? '删除失败');
        }
      },
    });
  };

  // ---- 渲染 ----
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 阶段管道 */}
        <div style={{ padding: '12px 20px 0' }}>
          <CustomerStagePipeline
            statuses={statuses}
            currentStatusId={customer.statusId ?? null}
            currentStatusCode={null}
            currentStatusName={customer.statusName ?? null}
            stageEnteredAt={customer.lastFollowUpAt ?? null}
            createdAt={customer.createdAt ?? null}
          />
        </div>

        {/* 5 列摘要条 */}
        <div style={{ padding: '0 20px' }}>
          <CustomerDrawerSummary
            ownerName={customer.ownerUserName ?? null}
            lastFollowUpAt={customer.lastFollowUpAt ?? null}
            nextFollowUpAt={customer.nextFollowUpAt ?? null}
            level={customer.level ?? null}
            statusName={customer.statusName ?? null}
          />
        </div>

        {/* Tab 区 */}
        <div style={{ padding: '0 20px 20px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as CustomerDrawerTabKey)}
            destroyInactiveTabPane={false}
            items={TAB_LABELS.map((t) => ({
              key: t.key,
              label: t.label,
              children: renderTab(t.key),
            }))}
          />
        </div>
      </div>
    );
  };

  const renderTab = (key: CustomerDrawerTabKey) => {
    if (!customer) return null;
    switch (key) {
      case 'overview':
        return (
          <OverviewTab
            customer={customer}
            activities={activities}
            activitiesLoading={activitiesLoading}
            contacts={contacts}
            contactsLoading={contactsLoading}
            onJumpToContacts={() => {
              setActiveTab('contacts');
              void ensureContacts();
            }}
            onAdjustNextFollowUp={handleFollowUpClick}
          />
        );
      case 'followup':
        return (
          <FollowUpTab
            customer={customer}
            statuses={statuses}
            activities={activities}
            loading={activitiesLoading}
            requestFocus={requestFollowUpFocus}
            onSubmit={handleFollowUpSubmit}
          />
        );
      case 'contacts':
        return (
          <ContactsTab
            contacts={contacts}
            loading={contactsLoading}
            onCreate={handleCreateContact}
            onEdit={(c) =>
              message.info(`编辑联系人「${c.name}」（Phase 3 接入表单）`)
            }
            onDelete={(c) =>
              message.info(`删除联系人「${c.name}」（Phase 3 接入接口）`)
            }
          />
        );
      case 'opportunities':
        return <OpportunitiesTab />;
      case 'more':
        return (
          <MoreTab
            customer={customer}
            activities={activities}
            activitiesLoading={activitiesLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={width}
      destroyOnClose
      closable={false}
      maskClosable
      styles={{
        body: { padding: 0, background: '#f5f7fa' },
        header: { display: 'none' },
      }}
      title={null}
      footer={null}
    >
      {customer && (
        <CustomerDrawerHeader
          customer={customer}
          onClose={onClose}
          onFollowUp={handleFollowUpClick}
          onCreateContact={handleCreateContact}
          onEdit={handleEditCustomer}
          onTransfer={() => message.info('转交（Phase 3 接入弹窗）')}
          onRelease={() => message.info('释放到公海（Phase 3 接入弹窗）')}
          onChangeOwner={() => message.info('修改负责人（Phase 3 接入弹窗）')}
          onArchive={() => message.info('归档（Phase 3 接入）')}
          onDelete={handleDeleteCustomer}
        />
      )}
      <div style={{ background: '#f5f7fa' }}>{renderBody()}</div>
    </Drawer>
  );
};

export default CustomerDrawer;
