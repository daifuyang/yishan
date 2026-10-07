import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { QUOTATION_STATUSES } from '@/modules/crm/domain/statuses';
import {
  listQuotations,
  type CustomerDetail,
  type QuoteSeriesSummary,
} from '@/services/crm';
import QuoteCreateModal from '../../quotation/QuoteCreateModal';
import QuoteActions from '../../quotation/QuoteActions';
import QuoteDetailModal, {
  QUOTATION_CHANGED_EVENT,
} from '../../quotation/QuoteDetailModal';
import { formatQuoteMoney } from '../../../utils/quotationMoney';

export interface QuotationsTabProps {
  customer: CustomerDetail;
  refreshKey: number;
  createRequestKey?: number;
  onCreateRequestHandled?: () => void;
  onQuotationCreated?: () => void | Promise<void>;
}
export default function QuotationsTab({
  customer,
  refreshKey,
  createRequestKey,
  onCreateRequestHandled,
  onQuotationCreated,
}: QuotationsTabProps) {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailAction, setDetailAction] = useState<'generate'>();
  useEffect(() => {
    void actionRef.current?.reload();
  }, [refreshKey, customer.id]);
  useEffect(() => {
    const reload = () => {
      void actionRef.current?.reload();
    };
    window.addEventListener(QUOTATION_CHANGED_EVENT, reload);
    return () => window.removeEventListener(QUOTATION_CHANGED_EVENT, reload);
  }, []);
  const columns: ProColumns<QuoteSeriesSummary>[] = [
    {
      title: '报价名称',
      dataIndex: 'title',
      width: 380,
      ellipsis: true,
      render: (_, row) => (
        <Flex vertical gap={2} style={{ minWidth: 0 }}>
          <Typography.Link
            title={row.title || row.seriesNo || ''}
            ellipsis
            onClick={() => {
              setDetailAction(undefined);
              if (row.currentQuoteId != null) setSelectedId(row.currentQuoteId);
            }}
          >
            {row.title || row.seriesNo || '报价'}
          </Typography.Link>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
            {row.seriesNo ?? '—'} · V{row.currentVersion ?? 1} · 共{row.versionCount ?? 1}版
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: '状态',
      dataIndex: 'currentStatus',
      width: 72,
      valueEnum: Object.fromEntries(
        QUOTATION_STATUSES.map((item) => [
          item.value,
          { text: item.label, status: item.semantic },
        ]),
      ),
    },
    {
      title: '金额',
      dataIndex: 'currentAmount',
      align: 'right',
      width: 96,
      render: (_, row) => formatQuoteMoney(row.currentAmount ?? 0),
    },
    {
      title: '有效期',
      dataIndex: 'validUntil',
      width: 84,
      render: (_, row) =>
        row.validUntil ? (
          <span title={dayjs(row.validUntil).format('YYYY-MM-DD')}>
            {dayjs(row.validUntil).format(
              dayjs(row.validUntil).year() === dayjs().year()
                ? 'MM-DD'
                : 'YYYY-MM-DD',
            )}
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: '客户查看',
      dataIndex: 'customerViewStatus',
      width: 158,
      ellipsis: true,
      render: (_, row) => row.customerViewStatus === 'viewed'
        ? `已查看${row.viewCount ? ` · 共${row.viewCount}次` : ''}`
        : '未查看',
    },
    { title: '负责人', dataIndex: 'ownerUserName', width: 72, ellipsis: true },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      fixed: 'right',
      render: (_, row) => (
        <QuoteActions
          quote={row}
          onDetail={() => {
            setDetailAction(undefined);
            if (row.currentQuoteId != null) setSelectedId(row.currentQuoteId);
          }}
          onGenerate={() => {
            setDetailAction('generate');
            if (row.currentQuoteId != null) setSelectedId(row.currentQuoteId);
          }}
          onChanged={() => {
            void actionRef.current?.reload();
            return onQuotationCreated?.();
          }}
        />
      ),
    },
  ];
  return (
    <>
      <Flex
        align="center"
        justify="space-between"
        style={{ minHeight: 40, marginBottom: 8 }}
      >
        <Flex align="baseline" gap={8}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            报价单
          </Typography.Text>
          <Typography.Text type="secondary">{total}</Typography.Text>
        </Flex>
        <QuoteCreateModal
          customerId={customer.id}
          customerName={customer.name}
          requestKey={createRequestKey}
          onRequestHandled={onCreateRequestHandled}
          onChanged={onQuotationCreated}
          renderTrigger={(open) => (
            <Button type="primary" icon={<PlusOutlined />} onClick={open}>
              新建报价
            </Button>
          )}
        />
      </Flex>
      <ProTable<QuoteSeriesSummary>
        actionRef={actionRef}
        rowKey="seriesId"
        columns={columns}
        search={false}
        options={false}
        toolBarRender={false}
        size="small"
        scroll={{ x: 1060 }}
        locale={{ emptyText: '暂无报价' }}
        pagination={{ defaultPageSize: 10 }}
        request={async (params) => {
          const result = await listQuotations({
            customerId: customer.id,
            page: params.current,
            pageSize: params.pageSize,
          });
          setTotal(result.total);
          return { ...result, success: true };
        }}
      />
      <QuoteDetailModal
        quotationId={selectedId}
        initialAction={detailAction}
        onClose={() => setSelectedId(null)}
        onChanged={onQuotationCreated}
      />
    </>
  );
}
export const QuotationsTabStandalone = QuotationsTab;
