import React, { useCallback } from 'react';
import type { QuotationRow } from '@/services/crm';
import { listQuotations } from '@/services/crm';
import { LifecycleListTab, statusTag } from './LifecycleListTab';

const money = (cents: number) => `￥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const QuotationsTab: React.FC<{ customerId: number }> = ({ customerId }) => {
  const load = useCallback(() => listQuotations({ customerId, page: 1, pageSize: 100 }).then((result) => result.data), [customerId]);
  return <LifecycleListTab<QuotationRow> load={load} emptyText="暂无报价单" columns={[{ title: '报价编号', dataIndex: 'quotationNo' }, { title: '总额', render: (_, row) => money(row.totalCents) }, { title: '状态', dataIndex: 'status', render: statusTag }, { title: '有效期', dataIndex: 'validUntil' }]} />;
};

export default QuotationsTab;
