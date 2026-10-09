import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { Flex, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { listQuotations, type QuoteSeriesSummary } from '@/services/crm';
import { QUOTATION_STATUSES } from '@/modules/crm/domain/statuses';
import QuoteDetailModal, {
  QUOTATION_CHANGED_EVENT,
} from '../../components/quotation/QuoteDetailModal';
import { formatQuoteMoney } from '../../utils/quotationMoney';
import QuoteActions from '../../components/quotation/QuoteActions';

export default function QuotationsPage() {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailAction, setDetailAction] = useState<'generate'>();
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
      search: false,
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
    { title: '关键词', dataIndex: 'keyword', hideInTable: true },
    {
      title: '状态',
      dataIndex: 'currentStatus',
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
      search: false,
      align: 'right',
      render: (_, row) => formatQuoteMoney(row.currentAmount ?? 0),
    },
    {
      title: '有效期',
      dataIndex: 'validUntil',
      valueType: 'date',
      search: false,
    },
    { title: '负责人', dataIndex: 'ownerUserName', search: false },
    {
      title: '客户查看',
      dataIndex: 'customerViewStatus',
      search: false,
      render: (_, row) => row.customerViewStatus === 'viewed'
        ? `已查看${row.viewCount ? ` · 共${row.viewCount}次` : ''}`
        : '未查看',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
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
          }}
        />
      ),
    },
  ];
  return (
    <PageContainer>
      <ProTable<QuoteSeriesSummary>
        actionRef={actionRef}
        rowKey="seriesId"
        columns={columns}
        headerTitle="报价单列表"
        request={async (params) => ({
          ...(await listQuotations({
            page: params.current,
            pageSize: params.pageSize,
            keyword: params.keyword,
            status: params.status,
          })),
          success: true,
        })}
      />
      <QuoteDetailModal
        quotationId={selectedId}
        initialAction={detailAction}
        onClose={() => setSelectedId(null)}
      />
    </PageContainer>
  );
}
