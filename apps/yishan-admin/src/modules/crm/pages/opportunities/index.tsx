import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { listOpportunities, type OpportunityRow } from '@/services/crm';
import { OPPORTUNITY_STAGES } from '@/modules/crm/domain/statuses';
import { CrmEntityList, formatMoney } from '../_shared/CrmEntityList';

const columns: ProColumns<OpportunityRow>[] = [
  { title: '商机名称', dataIndex: 'name' },
  { title: '客户', dataIndex: 'customerId', search: false },
  { title: '阶段', dataIndex: 'stageCode', valueEnum: Object.fromEntries(OPPORTUNITY_STAGES.map((item) => [item.value, item.label])) },
  { title: '预计金额', dataIndex: 'expectedAmountCents', search: false, render: (_, row) => formatMoney(row.expectedAmountCents) },
  { title: '预计成交', dataIndex: 'expectedCloseDate', valueType: 'date', search: false },
];

export default function OpportunitiesPage() {
  return <CrmEntityList title="商机" columns={columns} load={listOpportunities} fields={columns.filter((column) => typeof column.dataIndex === 'string').map((column) => ({ key: column.dataIndex as keyof OpportunityRow, label: String(column.title) }))} />;
}
