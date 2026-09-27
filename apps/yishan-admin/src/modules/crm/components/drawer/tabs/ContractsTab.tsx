import React, { useCallback } from 'react';
import type { ContractRow } from '@/services/crm';
import { listContracts } from '@/services/crm';
import { LifecycleListTab, statusTag } from './LifecycleListTab';
import { CONTRACT_STATUSES } from '@/modules/crm/domain/statuses';
const money = (cents: number) => `￥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const ContractsTab: React.FC<{ customerId: number }> = ({ customerId }) => {
  const load = useCallback(() => listContracts({ customerId, page: 1, pageSize: 100 }).then((result) => result.data), [customerId]);
  return <LifecycleListTab<ContractRow> load={load} emptyText="暂无合同" columns={[{ title: '合同编号', dataIndex: 'contractNo' }, { title: '合同名称', dataIndex: 'name' }, { title: '金额', render: (_, row) => money(row.amountCents) }, { title: '状态', dataIndex: 'status', render: (value) => statusTag(value, CONTRACT_STATUSES) }]} />;
};
export default ContractsTab;
