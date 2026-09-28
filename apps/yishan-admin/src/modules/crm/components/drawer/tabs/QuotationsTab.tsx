import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Empty, Skeleton, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { QUOTATION_STATUSES, statusOf } from '@/modules/crm/domain/statuses';
import {
  type ContactRow,
  type CustomerDetail,
  listContactsByCustomer,
  listOpportunities,
  listProducts,
  listQuotations,
  type OpportunityRow,
  type ProductRow,
  type QuotationRow,
} from '@/services/crm';
import { usePermission } from '@/utils/permission';
import QuotationCreateModal from './QuotationCreateModal';

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

export interface QuotationsTabProps {
  customer: CustomerDetail;
  refreshKey: number;
  /** 「+ 新建报价单」按钮回调 —— 由父级（CustomerDrawer）控制 Modal 打开。 */
  onCreateRequest?: () => void;
  /** 点击报价单行 → 进入详情（Phase 后续接）。 */
  onQuotationClick?: (id: number) => void;
}

export default function QuotationsTab({
  customer,
  refreshKey,
  onCreateRequest,
  onQuotationClick,
}: QuotationsTabProps) {
  const can = usePermission();
  const canCreate = can('crm:quotation:create');

  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void listQuotations({ customerId: customer.id, page: 1, pageSize: 100 })
      .then((result) => setRows(result.data))
      .finally(() => setLoading(false));
  }, [customer.id, refreshKey]);

  const columns: ProColumns<QuotationRow>[] = useMemo(
    () => [
      {
        title: '报价单号',
        dataIndex: 'quotationNo',
        width: 160,
      },
      {
        title: '报价单名称',
        dataIndex: 'name',
        width: 240,
        render: (_, row) => (
          <a onClick={() => onQuotationClick?.(row.id)}>
            {row.name || row.quotationNo}
          </a>
        ),
      },
      {
        title: '关联商机',
        dataIndex: 'opportunityName',
        width: 200,
        renderText: (value) => value || '—',
      },
      {
        title: '报价金额',
        dataIndex: 'totalCents',
        width: 140,
        align: 'right',
        render: (_, row) => (
          <Text style={{ fontWeight: 500 }}>{money(row.totalCents)}</Text>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (_, row) => {
          const s = statusOf(row.status, QUOTATION_STATUSES);
          return (
            <Tag color={s.semantic === 'default' ? undefined : s.semantic}>
              {s.label}
            </Tag>
          );
        },
      },
      {
        title: '有效期',
        dataIndex: 'validUntil',
        width: 110,
        render: (_, row) => dateOnly(row.validUntil),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 140,
        render: (_, row) =>
          row.createdAt ? dayjs(row.createdAt).format('YYYY-MM-DD') : '—',
      },
    ],
    [onQuotationClick],
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
          <span style={{ fontSize: 16, fontWeight: 600 }}>报价单</span>
          <span style={{ fontSize: 13, color: '#8c8c8c' }}>{rows.length}</span>
        </div>
        {canCreate && onCreateRequest && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateRequest}
          >
            新建报价单
          </Button>
        )}
      </div>
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无报价单" />
      ) : (
        <ProTable<QuotationRow>
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
 * QuotationsTab 的 standalone 包装：拉联系人 / 商机 / 商品作为 Modal 入参，
 * 由父级（CustomerDrawer）通过 createOpen / onCreateRequest 控制 Modal 开关。
 *
 * 写操作（create）走父级提供的 ModalForm，刷新通过 refreshKey 触发。
 */
interface QuotationsTabStandaloneProps {
  customer: CustomerDetail;
  refreshKey: number;
  createOpen: boolean;
  onCreateRequest: () => void;
  onModalOpenChange: (open: boolean) => void;
  /** 创建成功回调：父级用它刷新客户详情 + 报价单 refreshKey。 */
  onQuotationCreated?: () => void | Promise<void>;
}

export function QuotationsTabStandalone({
  customer,
  refreshKey,
  createOpen,
  onCreateRequest,
  onModalOpenChange,
  onQuotationCreated,
}: QuotationsTabStandaloneProps) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // 拉联系人 / 商机 / 商品（用于 Modal 入参）。
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
      listProducts({ page: 1, pageSize: 100 }).then((r) => r.data),
    ])
      .then(([c, o, p]) => {
        if (cancelled) return;
        setContacts(c);
        setOpportunities(o);
        setProducts(p);
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
      <QuotationsTab
        customer={customer}
        refreshKey={refreshKey}
        onCreateRequest={onCreateRequest}
      />
      <QuotationCreateModal
        open={createOpen}
        onOpenChange={onModalOpenChange}
        customerId={customer.id}
        customerName={customer.name}
        existingContacts={optionsLoading ? [] : contacts}
        existingOpportunities={optionsLoading ? [] : opportunities}
        existingProducts={optionsLoading ? [] : products}
        onSuccess={() => {
          void onQuotationCreated?.();
        }}
      />
    </>
  );
}
