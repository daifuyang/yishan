import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  type CustomerDetail,
  listContracts,
  listPayments,
  PAYMENT_METHOD_OPTIONS,
  type PaymentContractSummary,
  type PaymentCustomerSummary,
  type PaymentRow,
} from '@/services/crm';
import { usePermission } from '@/utils/permission';
import PaymentCreateModal from './PaymentCreateModal';

const { Text } = Typography;

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

const methodLabel = (code: string) =>
  PAYMENT_METHOD_OPTIONS.find((m) => m.value === code)?.label ?? code;

export interface PaymentsTabProps {
  customer: CustomerDetail;
  refreshKey: number;
  /** 「+ 登记回款」按钮回调 —— 由父级（CustomerDrawer）控制 Modal 打开。 */
  onCreateRequest?: () => void;
  /** 点击回款单号 → 进入详情（Phase 后续接）。 */
  onPaymentClick?: (id: number) => void;
}

export default function PaymentsTab({
  customer,
  refreshKey,
  onCreateRequest,
  onPaymentClick,
}: PaymentsTabProps) {
  const can = usePermission();
  const canCreate = can('crm:payment:create');

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentCustomerSummary>({
    totalContractCents: 0,
    paidCents: 0,
    outstandingCents: 0,
  });
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const [payments, contracts] = await Promise.all([
        listPayments({ customerId: customer.id, page: 1, pageSize: 100 }),
        listContracts({ customerId: customer.id, page: 1, pageSize: 100 }),
      ]);
      setRows(payments.data);
      // 简单聚合：合同金额 = 该客户所有合同 sum；已回款 = 该客户所有 payment sum
      let totalContractCents = 0;
      for (const c of contracts.data) {
        totalContractCents += c.amountCents;
      }
      const paidCents = payments.data.reduce(
        (sum, p) => sum + p.amountCents,
        0,
      );
      setSummary({
        totalContractCents,
        paidCents,
        outstandingCents: Math.max(0, totalContractCents - paidCents),
      });
    } catch {
      setRows([]);
      setSummary({ totalContractCents: 0, paidCents: 0, outstandingCents: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id, refreshKey]);

  const columns: ProColumns<PaymentRow>[] = useMemo(
    () => [
      {
        title: '回款单号',
        dataIndex: 'paymentNo',
        width: 170,
        render: (_, row) => (
          <a onClick={() => onPaymentClick?.(row.id)}>{row.paymentNo}</a>
        ),
      },
      {
        title: '关联合同',
        dataIndex: 'contractName',
        width: 220,
        render: (_, row) => (
          <span>
            <Text>{row.contractName ?? '—'}</Text>
            {row.contractNo && (
              <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                {row.contractNo}
              </Text>
            )}
          </span>
        ),
      },
      {
        title: '本次回款',
        dataIndex: 'amountCents',
        width: 140,
        align: 'right',
        render: (_, row) => <Text strong>{money(row.amountCents)}</Text>,
      },
      {
        title: '回款日期',
        dataIndex: 'paidAt',
        width: 110,
        render: (_, row) => dateOnly(row.paidAt),
      },
      {
        title: '收款方式',
        dataIndex: 'methodCode',
        width: 110,
        renderText: (value) => methodLabel(String(value)),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 90,
        render: (_, row) => (
          <Tag color="success">
            {row.status === 'confirmed' ? '已确认' : row.status}
          </Tag>
        ),
      },
      {
        title: '登记人',
        dataIndex: 'creatorName',
        width: 100,
        renderText: (value) => value || '—',
      },
    ],
    [onPaymentClick],
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 40,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>回款</span>
          <span style={{ fontSize: 13, color: '#8c8c8c' }}>{rows.length}</span>
        </div>
        {canCreate && onCreateRequest && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateRequest}
          >
            登记回款
          </Button>
        )}
      </div>
      {/* 顶部轻量汇总：合同金额 / 已回款 / 待回款 */}
      {!loading && summary.totalContractCents > 0 && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            color: '#595959',
            fontSize: 13,
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            background: '#fafafa',
          }}
        >
          <Space size={32} wrap>
            <span>
              合同金额{' '}
              <Text strong style={{ color: '#262626' }}>
                {money(summary.totalContractCents)}
              </Text>
            </span>
            <span>
              已回款{' '}
              <Text strong style={{ color: '#262626' }}>
                {money(summary.paidCents)}
              </Text>
            </span>
            <span>
              待回款{' '}
              <Text strong style={{ color: '#262626' }}>
                {money(summary.outstandingCents)}
              </Text>
            </span>
          </Space>
        </div>
      )}
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无回款" />
      ) : (
        <ProTable<PaymentRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          search={false}
          pagination={false}
          options={false}
          toolBarRender={false}
          cardBordered={false}
          scroll={{ x: 920 }}
          size="small"
        />
      )}
    </>
  );
}

/**
 * PaymentsTab 的 standalone 包装：拉合同列表（带已汇总 paid / outstanding）
 * 作为 Modal 入参；由父级（CustomerDrawer）通过 createOpen / onCreateRequest 控制 Modal。
 *
 * 写操作（create）走父级提供的 ModalForm，刷新通过 refreshKey 触发。
 */
interface PaymentsTabStandaloneProps {
  customer: CustomerDetail;
  refreshKey: number;
  createOpen: boolean;
  onCreateRequest: () => void;
  onModalOpenChange: (open: boolean) => void;
  /** 创建成功回调：父级用它刷新客户详情 + 回款 refreshKey。 */
  onPaymentCreated?: () => void | Promise<void>;
}

export function PaymentsTabStandalone({
  customer,
  refreshKey,
  createOpen,
  onCreateRequest,
  onModalOpenChange,
  onPaymentCreated,
}: PaymentsTabStandaloneProps) {
  const [contracts, setContracts] = useState<PaymentContractSummary[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // 拉合同列表（含已汇总 paid / outstanding）
  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    Promise.all([
      listContracts({ customerId: customer.id, page: 1, pageSize: 100 }).then(
        (r) => r.data,
      ),
      listPayments({ customerId: customer.id, page: 1, pageSize: 100 }).then(
        (r) => r.data,
      ),
    ])
      .then(([contractRows, paymentRows]) => {
        if (cancelled) return;
        const paidByContract = new Map<number, number>();
        for (const p of paymentRows) {
          paidByContract.set(
            p.contractId,
            (paidByContract.get(p.contractId) ?? 0) + p.amountCents,
          );
        }
        setContracts(
          contractRows.map((c) => {
            const paidCents = paidByContract.get(c.id) ?? 0;
            return {
              contractId: c.id,
              contractNo: c.contractNo,
              contractName: c.name,
              contractAmountCents: c.amountCents,
              paidCents,
              outstandingCents: Math.max(0, c.amountCents - paidCents),
            };
          }),
        );
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id, refreshKey]);

  return (
    <>
      <PaymentsTab
        customer={customer}
        refreshKey={refreshKey}
        onCreateRequest={onCreateRequest}
      />
      <PaymentCreateModal
        open={createOpen}
        onOpenChange={onModalOpenChange}
        contracts={optionsLoading ? [] : contracts}
        onSuccess={() => {
          void onPaymentCreated?.();
        }}
      />
    </>
  );
}
