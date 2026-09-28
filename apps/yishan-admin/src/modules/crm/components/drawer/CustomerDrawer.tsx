/**
 * 客户 Drawer 主壳。
 *
 * 职责：
 *   - 宽度由 useResizableDrawer 维护（≥1100px），可拖拽右边沿
 *   - open / customerId 由父组件传入；onClose 时清掉 URL 上的 customerId 由 hook 负责
 *   - 顶部 Header：CustomerDrawerHeader
 *   - 10 个 Tab：基本信息（分段详情 + 活动 rail）/ 联系人 / 商机 / 报价单 /
 *     合同 / 费用 / 已成交产品 / 任务 / 附件 / 操作日志
 *
 * 出错处理：
 *   - 404 → 提示 "客户不存在或已被删除"
 *   - 403 → 静默忽略（permission-denied silent）
 *   - 其他错误 → antd message.error
 */

import { message as antdMessage, Button, Skeleton, Tabs } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import {
  type ContactRow,
  type CustomerDetail,
  deleteContact,
  deleteCustomer,
  type EnumCodeNameItem,
  getCustomer,
  listContactsByCustomer,
  listEnumByType,
  updateContact,
} from '@/services/crm';
import DrawerChrome from './_shared/DrawerChrome';
import { useResizableDrawer } from './_shared/useResizableDrawer';
import CustomerDrawerHeader, {
  type CreateEntityKey,
} from './CustomerDrawerHeader';
import AttachmentsTab from './tabs/AttachmentsTab';
import ContactCreateModal from './tabs/ContactCreateModal';
import ContactsTab from './tabs/ContactsTab';
import { ContractsTabStandalone } from './tabs/ContractsTab';
import { OpportunitiesTabStandalone } from './tabs/OpportunitiesTab';
import OverviewTab from './tabs/OverviewTab';
import PaymentsTab from './tabs/PaymentsTab';
import { QuotationsTabStandalone } from './tabs/QuotationsTab';
import TasksTab from './tabs/TasksTab';

export type CustomerDrawerTabKey =
  | 'overview'
  | 'contacts'
  | 'opportunities'
  | 'quotations'
  | 'contracts'
  | 'payments'
  | 'tasks'
  | 'attachments';

const TAB_LABELS: Array<{ key: CustomerDrawerTabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'contacts', label: '联系人' },
  { key: 'opportunities', label: '商机' },
  { key: 'quotations', label: '报价单' },
  { key: 'contracts', label: '合同' },
  { key: 'payments', label: '回款' },
  { key: 'tasks', label: '任务' },
  { key: 'attachments', label: '附件' },
];

export interface CustomerDrawerProps {
  open: boolean;
  customerId: number | null;
  initialTab?: CustomerDrawerTabKey;
  onClose: () => void;
  /** 任意数据被变更后通知上层 reload 列表/计数。 */
  onChanged?: () => void;
  /** Drawer 右上"新增"子菜单回调映射；undefined 时该子项仍渲染但走 toast 占位。 */
  onCreateEntity?: (entity: CreateEntityKey) => void;
  /** Drawer 右上"转移"按钮回调；undefined 时走 toast 占位。 */
  onTransfer?: (customer: CustomerDetail) => void;
  onRelease?: (customer: CustomerDetail) => void;
  currentUser?: { id?: number; realName?: string; username?: string } | null;
}

const CustomerDrawer: React.FC<CustomerDrawerProps> = ({
  open,
  customerId,
  initialTab = 'overview',
  onClose,
  onChanged,
  onCreateEntity,
  onTransfer,
  onRelease,
}) => {
  const [size, setSize] = useResizableDrawer();
  const [activeTab, setActiveTab] = useState<CustomerDrawerTabKey>(initialTab);
  const [followUpRequest, setFollowUpRequest] = useState(0);
  const [customerRefreshKey, setCustomerRefreshKey] = useState(0);

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // 联系人新建 / 编辑 Modal 的开关与编辑对象。
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);

  const requestOpenCreateContact = useCallback(() => {
    setEditingContact(null);
    setCreateContactOpen(true);
  }, []);
  const requestOpenEditContact = useCallback((c: ContactRow) => {
    setEditingContact(c);
    setCreateContactOpen(true);
  }, []);
  const handleContactModalOpenChange = useCallback((next: boolean) => {
    setCreateContactOpen(next);
    if (!next) setEditingContact(null);
  }, []);

  // 商机新建 Modal 开关（Drawer + ModalForm 模式，与联系 Modal 对齐）。
  const [createOpportunityOpen, setCreateOpportunityOpen] = useState(false);
  const requestOpenCreateOpportunity = useCallback(() => {
    setCreateOpportunityOpen(true);
  }, []);
  const handleOpportunityModalOpenChange = useCallback((next: boolean) => {
    setCreateOpportunityOpen(next);
  }, []);

  // 报价单新建 Modal 开关（Drawer + ModalForm 模式，与联系 / 商机 Modal 对齐）。
  const [createQuotationOpen, setCreateQuotationOpen] = useState(false);
  const requestOpenCreateQuotation = useCallback(() => {
    setCreateQuotationOpen(true);
  }, []);
  const handleQuotationModalOpenChange = useCallback((next: boolean) => {
    setCreateQuotationOpen(next);
  }, []);

  // 合同新建 Modal 开关（Drawer + ModalForm 模式，与联系 / 商机 / 报价单 Modal 对齐）。
  const [createContractOpen, setCreateContractOpen] = useState(false);
  const requestOpenCreateContract = useCallback(() => {
    setCreateContractOpen(true);
  }, []);
  const handleContractModalOpenChange = useCallback((next: boolean) => {
    setCreateContractOpen(next);
  }, []);

  // customerId / open 变化时拉详情
  useEffect(() => {
    if (!open || !customerId) {
      setCustomer(null);
      setCustomerError(null);
      setCustomerLoading(false);
      setFollowUpRequest(0);
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
    if (entity === 'contact') {
      // 「联系人」走 ContactsTabStandalone 内部 ModalForm；不走父级回调，
      // 避免维护两套创建入口。
      requestOpenCreateContact();
      return;
    }
    if (entity === 'opportunity') {
      // 切到商机 Tab 并打开商机新建 Modal（Drawer + ModalForm）
      setActiveTab('opportunities');
      requestOpenCreateOpportunity();
      return;
    }
    if (entity === 'quotation') {
      // 切到报价单 Tab 并打开报价单新建 Modal（Drawer + ModalForm）
      setActiveTab('quotations');
      requestOpenCreateQuotation();
      return;
    }
    if (entity === 'contract') {
      // 切到合同 Tab 并打开合同新建 Modal（Drawer + ModalForm）
      setActiveTab('contracts');
      requestOpenCreateContract();
      return;
    }
    if (onCreateEntity) {
      onCreateEntity(entity);
    } else {
      const label = CREATE_ENTITY_TOAST[entity] ?? `${entity}功能开发中`;
      antdMessage.info(label);
    }
  };

  const handleOpportunityCreated = async () => {
    // 商机创建成功：刷新客户详情（status / lifecycle 可能变化）+ 商机列表 refreshKey++。
    if (!customerId) return;
    const refreshed = await getCustomer(customerId);
    setCustomer(refreshed);
    setCustomerRefreshKey((value) => value + 1);
    onChanged?.();
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
          <div style={{ fontSize: 14, marginBottom: 12 }}>{customerError}</div>
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
        destroyOnHidden={false}
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
      case 'overview':
        return (
          <OverviewTab
            customer={current}
            followUpRequest={followUpRequest}
            onFollowUpSaved={handleFollowUpSaved}
            onRelationshipStatusChanged={handleFollowUpSaved}
          />
        );
      case 'contacts':
        return (
          <ContactsTabStandalone
            customerId={current.id}
            ownerUserId={current.ownerUserId}
            createContactOpen={createContactOpen}
            editingContact={editingContact}
            onCreateContactRequest={requestOpenCreateContact}
            onEditContactRequest={requestOpenEditContact}
            onModalOpenChange={handleContactModalOpenChange}
          />
        );
      case 'opportunities':
        return (
          <OpportunitiesTabStandalone
            customer={current}
            refreshKey={customerRefreshKey}
            createOpen={createOpportunityOpen}
            onCreateRequest={requestOpenCreateOpportunity}
            onModalOpenChange={handleOpportunityModalOpenChange}
            onOpportunityCreated={handleOpportunityCreated}
          />
        );
      case 'quotations':
        return (
          <QuotationsTabStandalone
            customer={current}
            refreshKey={customerRefreshKey}
            createOpen={createQuotationOpen}
            onCreateRequest={requestOpenCreateQuotation}
            onModalOpenChange={handleQuotationModalOpenChange}
            onQuotationCreated={handleOpportunityCreated}
          />
        );
      case 'contracts':
        return (
          <ContractsTabStandalone
            customer={current}
            refreshKey={customerRefreshKey}
            createOpen={createContractOpen}
            onCreateRequest={requestOpenCreateContract}
            onModalOpenChange={handleContractModalOpenChange}
            onContractCreated={handleOpportunityCreated}
          />
        );
      case 'payments':
        return <PaymentsTab customerId={current.id} />;
      case 'tasks':
        return <TasksTab customerId={current.id} />;
      case 'attachments':
        return <AttachmentsTab customerId={current.id} />;
      default:
        return null;
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
          onEdit={() =>
            antdMessage.info('全屏编辑模式开发中；当前请在 Drawer 内操作')
          }
          onCreateEntity={handleCreateEntity}
          onTransfer={handleTransfer}
          onRelease={handleRelease}
          onDelete={handleDelete}
          onFollowUp={() => {
            setActiveTab('overview');
            setFollowUpRequest((request) => request + 1);
          }}
        />
      )}
      {renderBody()}
    </DrawerChrome>
  );
};

export default CustomerDrawer;

const CREATE_ENTITY_TOAST: Record<CreateEntityKey, string> = {
  followup: '请使用右侧动态中的新增跟进入口',
  contact: '新建联系人请到联系人 Tab 操作',
  opportunity: '新建商机功能开发中（Phase 3）',
  contract: '新建合同请到合同 Tab 操作',
  quotation: '新建报价单请到报价单 Tab 操作',
  payment: '新建回款记录功能开发中（Phase 3）',
};

/**
 * ContactsTab 的 standalone 包装：自己拉 listContactsByCustomer，
 * 因为 ContactsTab 设计是父级传 contacts 进来。
 *
 * 写操作（create / edit / setPrimary / delete）已接真实 API：
 *   - 新建 / 编辑：渲染 ContactCreateModal（受控开关由 CustomerDrawer 持有）
 *   - 设为主联系人：updateContact(id, { isPrimary: 1 })，后端事务内自动清零其他
 *   - 删除：deleteContact(id)
 *
 * 刷新策略：只刷新当前联系人列表（listContactsByCustomer），
 * 不动客户详情 / 跟进 / 流转等其它数据。
 */
interface ContactsTabStandaloneProps {
  customerId: number;
  ownerUserId: number | null;
  createContactOpen: boolean;
  editingContact: ContactRow | null;
  onCreateContactRequest: () => void;
  onEditContactRequest: (contact: ContactRow) => void;
  onModalOpenChange: (open: boolean) => void;
}

const ContactsTabStandalone: React.FC<ContactsTabStandaloneProps> = ({
  customerId,
  ownerUserId,
  createContactOpen,
  editingContact,
  onCreateContactRequest,
  onEditContactRequest,
  onModalOpenChange,
}) => {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [roleEnum, setRoleEnum] = useState<EnumCodeNameItem[]>([]);

  const reloadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listContactsByCustomer(customerId);
      setContacts(rows);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    reloadContacts().catch(() => undefined);
  }, [reloadContacts]);

  // 决策角色枚举：用于卡片展示 + 弹窗下拉选项。
  useEffect(() => {
    let cancelled = false;
    listEnumByType('crm_contact_role')
      .then((items) => {
        if (!cancelled) setRoleEnum(items);
      })
      .catch(() => {
        if (!cancelled) setRoleEnum([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetPrimary = async (c: ContactRow) => {
    try {
      await updateContact(c.id, { isPrimary: 1 });
      antdMessage.success(`已将「${c.name}」设为主联系人`);
      await reloadContacts();
    } catch (err) {
      antdMessage.error(
        err instanceof Error ? err.message : '设置主联系人失败',
      );
    }
  };

  const handleDelete = async (c: ContactRow) => {
    try {
      await deleteContact(c.id);
      antdMessage.success(`「${c.name}」已删除`);
      await reloadContacts();
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <>
      <ContactsTab
        contacts={contacts}
        loading={loading}
        roleEnum={roleEnum}
        onCreate={onCreateContactRequest}
        onEdit={onEditContactRequest}
        onSetPrimary={handleSetPrimary}
        onDelete={handleDelete}
      />
      <ContactCreateModal
        open={createContactOpen}
        onOpenChange={onModalOpenChange}
        customerId={customerId}
        ownerUserId={ownerUserId}
        existingContacts={contacts}
        editingContact={editingContact}
        onSuccess={() => {
          reloadContacts().catch(() => undefined);
        }}
      />
    </>
  );
};
