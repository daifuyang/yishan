import React, { useCallback } from 'react';
import type { PaymentRow } from '@/services/crm';
import { listContracts, listPaymentsByContract } from '@/services/crm';
import { LifecycleListTab } from './LifecycleListTab';
const money = (cents: number) => `￥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const PaymentsTab: React.FC<{ customerId: number }> = ({ customerId }) => {
  const load = useCallback(async () => (await Promise.all((await listContracts({ customerId, page: 1, pageSize: 100 })).data.map((item) => listPaymentsByContract(item.id)))).flat(), [customerId]);
  return <LifecycleListTab<PaymentRow> load={load} emptyText="暂无回款" columns={[{ title: '回款金额', render: (_, row) => money(row.amountCents) }, { title: '回款日期', dataIndex: 'paidAt' }, { title: '方式', dataIndex: 'methodCode' }, { title: '备注', dataIndex: 'remark' }]} />;
};
export default PaymentsTab;
