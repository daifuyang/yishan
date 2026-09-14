import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { listContracts, listPaymentsByContract, type PaymentRow } from '@/services/crm';
import { CrmEntityList, formatMoney } from '../_shared/CrmEntityList';

async function loadPayments(query: { page?: number; pageSize?: number }) {
  const contracts = await listContracts(query);
  const rows = (await Promise.all(contracts.data.map((contract) => listPaymentsByContract(contract.id)))).flat();
  return { data: rows, total: rows.length };
}
const columns: ProColumns<PaymentRow>[] = [
  { title: '合同', dataIndex: 'contractId' },
  { title: '客户', dataIndex: 'customerId', search: false },
  { title: '回款金额', dataIndex: 'amountCents', search: false, render: (_, row) => formatMoney(row.amountCents) },
  { title: '回款日期', dataIndex: 'paidAt', valueType: 'date' },
  { title: '方式', dataIndex: 'methodCode' },
];
export default function PaymentsPage() {
  return <CrmEntityList title="回款" columns={columns} load={loadPayments} fields={columns.filter((column) => typeof column.dataIndex === 'string').map((column) => ({ key: column.dataIndex as keyof PaymentRow, label: String(column.title) }))} />;
}
