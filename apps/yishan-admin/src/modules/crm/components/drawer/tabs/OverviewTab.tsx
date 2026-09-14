import { Descriptions, Empty, Skeleton, Statistic, Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import type { ContractRow, CustomerDetail, OpportunityRow, PaymentRow, StatusRow } from '@/services/crm';
import { listContracts, listOpportunities, listPaymentsByContract } from '@/services/crm';
import { formatDateTime } from '@/utils/formatDate';
import CustomerActivityRail from '../sub/CustomerActivityRail';

const money = (cents: number) => `￥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const OverviewTab: React.FC<{ customer: CustomerDetail; statuses: StatusRow[]; followUpRequest?: number; onFollowUpSaved?: () => void }> = ({ customer, statuses, followUpRequest, onFollowUpSaved }) => {
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listOpportunities({ customerId: customer.id, page: 1, pageSize: 50 }),
      listContracts({ customerId: customer.id, page: 1, pageSize: 50 }),
    ])
      .then(async ([opportunityResult, contractResult]) => {
        const paymentRows = await Promise.all(contractResult.data.map((contract) => listPaymentsByContract(contract.id)));
        if (!active) return;
        setOpportunities(opportunityResult.data);
        setContracts(contractResult.data);
        setPayments(paymentRows.flat());
      })
      .catch(() => active && undefined)
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customer.id]);

  const contractAmount = contracts.reduce((sum, item) => sum + item.amountCents, 0);
  const receivedAmount = payments.reduce((sum, item) => sum + item.amountCents, 0);
  const openOpportunity = opportunities.find((item) => !['won', 'lost'].includes(item.stageCode));

  return (
    <div style={{ padding: '8px 0 24px' }}>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small" styles={{ label: { color: '#667085', width: 88 } }}>
        <Descriptions.Item label="负责人">{customer.ownerUserName ?? '未分配'}</Descriptions.Item>
        <Descriptions.Item label="客户状态"><Tag color="blue">{customer.statusName ?? '—'}</Tag></Descriptions.Item>
        <Descriptions.Item label="客户等级">{customer.level ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="客户来源">{customer.sourceName ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="所属行业">{customer.industry ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="所在地区">{[customer.province, customer.city].filter(Boolean).join(' / ') || '—'}</Descriptions.Item>
        <Descriptions.Item label="主要联系人">{customer.primaryContactName ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="最近跟进">{formatDateTime(customer.lastFollowUpAt)}</Descriptions.Item>
        <Descriptions.Item label="下次跟进">{formatDateTime(customer.nextFollowUpAt)}</Descriptions.Item>
        <Descriptions.Item label="进行中商机">{openOpportunity ? `${openOpportunity.name} · ${money(openOpportunity.expectedAmountCents)}` : '—'}</Descriptions.Item>
      </Descriptions>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, marginTop: 20, borderTop: '1px solid #eaecf0', borderBottom: '1px solid #eaecf0', background: '#eaecf0' }}>
        {loading ? <Skeleton active paragraph={false} style={{ padding: 16, background: '#fff' }} /> : <>
          <Metric label="累计合同" value={money(contractAmount)} />
          <Metric label="已回款" value={money(receivedAmount)} tone="#1677ff" />
          <Metric label="待回款" value={money(Math.max(0, contractAmount - receivedAmount))} tone="#d46b08" />
        </>}
      </div>
      {!loading && contracts.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无合同与回款" style={{ margin: '24px 0 0' }} />}
      <div style={{ marginTop: 24, borderTop: '1px solid #eaecf0', paddingTop: 16 }}>
        <CustomerActivityRail customer={customer} statuses={statuses} followUpRequest={followUpRequest} onFollowUpSaved={onFollowUpSaved} />
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = '#101828' }) => (
  <div style={{ padding: '14px 16px', background: '#fff' }}><Statistic title={label} value={value} styles={{ content: { fontSize: 20, color: tone } }} /></div>
);

export default OverviewTab;
