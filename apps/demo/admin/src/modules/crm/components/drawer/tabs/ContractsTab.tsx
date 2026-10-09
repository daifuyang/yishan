import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Empty, Skeleton, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { CONTRACT_STATUSES, statusOf } from '@/modules/crm/domain/statuses';
import {
  type ContactRow,
  type ContractRow,
  type CustomerDetail,
  listContactsByCustomer,
  listContracts,
  listOpportunities,
  listQuotations,
  type OpportunityRow,
  type QuoteSeriesSummary,
} from '@/services/crm';
import { usePermission } from '@/utils/permission';
import ContractCreateModal from './ContractCreateModal';

const money = (cents: number | null | undefined) =>
  cents == null
    ? '—'
    : new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);

const dateOnly = (value: string | null) =>
  !value ? '—' : dayjs(value).format('YYYY-MM-DD');

export interface ContractsTabProps {
  customer: CustomerDetail;
  refreshKey: number;
  /** 「+ 新建合同」按钮回调 —— 由父级（CustomerDrawer）控制 Modal 打开。 */
  onCreateRequest?: () => void;
  /** 点击合同行 → 进入详情（Phase 后续接）。 */
  onContractClick?: (id: number) => void;
}

export default function ContractsTab({
  customer,
  refreshKey,
  onCreateRequest,
  onContractClick,
}: ContractsTabProps) {
  const can = usePermission();
  const canCreate = can('crm:contract:create');

  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void listContracts({ customerId: customer.id, page: 1, pageSize: 100 })
      .then((result) => setRows(result.data))
      .finally(() => setLoading(false));
  }, [customer.id, refreshKey]);

  const columns: ProColumns<ContractRow>[] = useMemo(
    () => [
      {
        title: '合同号',
        dataIndex: 'contractNo',
        width: 160,
      },
      {
        title: '合同名称',
        dataIndex: 'name',
        width: 240,
        render: (_, row) => (
          <a onClick={() => onContractClick?.(row.id)}>{row.name}</a>
        ),
      },
      {
        title: '关联商机',
        dataIndex: 'opportunityName',
        width: 200,
        renderText: (value) => value || '—',
      },
      {
        title: '合同金额',
        dataIndex: 'amountCents',
        width: 140,
        align: 'right',
        render: (_, row) => (
          <Text style={{ fontWeight: 500 }}>{money(row.amountCents)}</Text>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (_, row) => {
          const s = statusOf(row.status, CONTRACT_STATUSES);
          return (
            <Tag color={s.semantic === 'default' ? undefined : s.semantic}>
              {s.label}
            </Tag>
          );
        },
      },
      {
        title: '签约日期',
        dataIndex: 'signedAt',
        width: 110,
        render: (_, row) => dateOnly(row.signedAt),
      },
      {
        title: '合同期限',
        dataIndex: 'effectiveAt',
        width: 200,
        render: (_, row) => {
          const start = dateOnly(row.effectiveAt);
          const end = dateOnly(row.expiresAt);
          if (start === '—' && end === '—') return '—';
          return `${start} ~ ${end}`;
        },
      },
    ],
    [onContractClick],
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 40,
          marginBottom: rows.length ? 8 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>合同</span>
          <span style={{ fontSize: 13, color: '#8c8c8c' }}>{rows.length}</span>
        </div>
        {canCreate && onCreateRequest && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateRequest}
          >
            新建合同
          </Button>
        )}
      </div>
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无合同" />
      ) : (
        <ProTable<ContractRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          search={false}
          pagination={false}
          options={false}
          toolBarRender={false}
          cardBordered={false}
          scroll={{ x: 880 }}
          size="small"
        />
      )}
    </>
  );
}

// keep JSX happy with antd `Text` reference (used inside ProTable column render)
const Text = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => <span style={style}>{children}</span>;

/**
 * ContractsTab 的 standalone 包装：拉联系人 / 商机 / 报价单作为 Modal 入参，
 * 由父级（CustomerDrawer）通过 createOpen / onCreateRequest 控制 Modal 开关。
 *
 * 写操作（create）走父级提供的 ModalForm，刷新通过 refreshKey 触发。
 */
interface ContractsTabStandaloneProps {
  customer: CustomerDetail;
  refreshKey: number;
  createOpen: boolean;
  onCreateRequest: () => void;
  onModalOpenChange: (open: boolean) => void;
  /** 创建成功回调：父级用它刷新客户详情 + 合同 refreshKey。 */
  onContractCreated?: () => void | Promise<void>;
}

export function ContractsTabStandalone({
  customer,
  refreshKey,
  createOpen,
  onCreateRequest,
  onModalOpenChange,
  onContractCreated,
}: ContractsTabStandaloneProps) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [quotations, setQuotations] = useState<QuoteSeriesSummary[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // 拉联系人 / 商机 / 报价单（用于 Modal 入参）。
  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    Promise.all([
      listContactsByCustomer(customer.id).catch(() => [] as ContactRow[]),
      listOpportunities({
        customerId: customer.id,
        page: 1,
        pageSize: 100,
      }).then((r) => r.data),
      listQuotations({ customerId: customer.id, page: 1, pageSize: 100 }).then(
        (r) => r.data,
      ),
    ])
      .then(([c, o, q]) => {
        if (cancelled) return;
        setContacts(c);
        setOpportunities(o);
        setQuotations(q);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  return (
    <>
      <ContractsTab
        customer={customer}
        refreshKey={refreshKey}
        onCreateRequest={onCreateRequest}
      />
      <ContractCreateModal
        open={createOpen}
        onOpenChange={onModalOpenChange}
        customerId={customer.id}
        customerName={customer.name}
        existingContacts={optionsLoading ? [] : contacts}
        existingOpportunities={optionsLoading ? [] : opportunities}
        existingQuotations={optionsLoading ? [] : quotations}
        onSuccess={() => {
          void onContractCreated?.();
        }}
      />
    </>
  );
}
