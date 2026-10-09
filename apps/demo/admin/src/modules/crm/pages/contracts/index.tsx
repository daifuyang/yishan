import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { listContracts, listPaymentsByContract, type ContractRow } from '@/services/crm';
import { CONTRACT_STATUSES } from '@/modules/crm/domain/statuses';
import { CrmEntityList, formatMoney } from '../_shared/CrmEntityList';
import type { CrmEntityListProps } from '../_shared/CrmEntityList';

export async function getContractAmounts(contract: ContractRow) {
  const payments = await listPaymentsByContract(contract.id);
  const received = payments.reduce((total, payment) => total + payment.amountCents, 0);
  return { received, remaining: Math.max(contract.amountCents - received, 0) };
}

const columns: ProColumns<ContractRow>[] = [
  { title: '合同编号', dataIndex: 'contractNo' },
  { title: '合同名称', dataIndex: 'name' },
  { title: '客户', dataIndex: 'customerId', search: false },
  { title: '合同金额', dataIndex: 'amountCents', search: false, render: (_, row) => formatMoney(row.amountCents) },
  { title: '状态', dataIndex: 'status', valueEnum: Object.fromEntries(CONTRACT_STATUSES.map((item) => [item.value, item.label])) },
  { title: '签约日期', dataIndex: 'signedAt', valueType: 'date', search: false },
];

const fields: CrmEntityListProps<ContractRow>['fields'] = [
  { key: 'contractNo' as const, label: '合同编号' },
  { key: 'name' as const, label: '合同名称' },
  { key: 'customerId' as const, label: '客户' },
  { key: 'amountCents' as const, label: '合同金额', render: (value) => formatMoney(value as number) },
  { key: 'status' as const, label: '状态' },
  { key: 'signedAt' as const, label: '签约日期' },
];

export default function ContractsPage() {
  return <CrmEntityList title="合同" columns={columns} load={listContracts} fields={fields} />;
}
