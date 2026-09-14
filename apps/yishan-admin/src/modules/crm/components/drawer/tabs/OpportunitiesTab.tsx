/**
 * 客户 Drawer — Opportunities Tab。
 *
 * Phase 2 占位：商机模块（crm_opportunity / crm_quotation）尚未实现，
 * 只展示"开发中"空状态 + disabled [+ 新建商机] 按钮。
 */

import React, { useCallback } from 'react';
import type { OpportunityRow } from '@/services/crm';
import { listOpportunities } from '@/services/crm';
import { LifecycleListTab, statusTag } from './LifecycleListTab';

const money = (cents: number) => `￥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const OpportunitiesTab: React.FC<{ customerId: number }> = ({ customerId }) => {
  const load = useCallback(() => listOpportunities({ customerId, page: 1, pageSize: 100 }).then((result) => result.data), [customerId]);
  return <LifecycleListTab<OpportunityRow> load={load} emptyText="暂无商机" columns={[{ title: '商机名称', dataIndex: 'name' }, { title: '阶段', dataIndex: 'stageCode', render: statusTag }, { title: '预计金额', render: (_, row) => money(row.expectedAmountCents) }, { title: '预计成交', dataIndex: 'expectedCloseDate' }]} />;
};

export default OpportunitiesTab;
