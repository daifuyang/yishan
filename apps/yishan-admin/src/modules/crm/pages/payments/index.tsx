import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { listPayments, type PaymentRow } from '@/services/crm';
import { CrmEntityList, formatMoney } from '../_shared/CrmEntityList';

const loadPayments = listPayments;
const columns: ProColumns<PaymentRow>[] = [
  { title: '合同', dataIndex: 'contractName', search: false, render: (_, row) => row.contractName || row.contractNo || row.contractId },
  { title: '客户', dataIndex: 'customerName', search: false, render: (_, row) => row.customerName || row.customerId },
  { title: '回款金额', dataIndex: 'amountCents', search: false, render: (_, row) => formatMoney(row.amountCents) },
  { title: '回款日期', dataIndex: 'paidAt', valueType: 'date' },
  { title: '方式', dataIndex: 'methodCode' },
];
export default function PaymentsPage() {
  return <CrmEntityList title="回款" columns={columns} load={loadPayments} fields={columns.filter((column) => typeof column.dataIndex === 'string').map((column) => ({ key: column.dataIndex as keyof PaymentRow, label: String(column.title) }))} />;
}
