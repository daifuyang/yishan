import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { listQuotations, type QuotationRow } from '@/services/crm';
import { QUOTATION_STATUSES } from '@/modules/crm/domain/statuses';
import { CrmEntityList, formatMoney } from '../_shared/CrmEntityList';

const columns: ProColumns<QuotationRow>[] = [
  { title: '报价单号', dataIndex: 'quotationNo' },
  { title: '客户', dataIndex: 'customerId', search: false },
  { title: '状态', dataIndex: 'status', valueEnum: Object.fromEntries(QUOTATION_STATUSES.map((item) => [item.value, item.label])) },
  { title: '总额', dataIndex: 'totalCents', search: false, render: (_, row) => formatMoney(row.totalCents) },
  { title: '有效期', dataIndex: 'validUntil', valueType: 'date', search: false },
];

export default function QuotationsPage() {
  return <CrmEntityList title="报价单" columns={columns} load={listQuotations} fields={columns.filter((column) => typeof column.dataIndex === 'string').map((column) => ({ key: column.dataIndex as keyof QuotationRow, label: String(column.title) }))} />;
}
