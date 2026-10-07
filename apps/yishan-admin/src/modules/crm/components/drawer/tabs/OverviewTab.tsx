import {
  Button,
  Divider,
  Skeleton,
  Space,
  Steps,
  Tag,
  Typography,
  message as antdMessage,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import type {
  ContractRow,
  CustomerDetail,
  OpportunityRow,
  PaymentRow,
} from '@/services/crm';
import {
  listAllPages,
  listContracts,
  listOpportunities,
  listPaymentsByContract,
  transitionCustomerRelationshipStatus,
} from '@/services/crm';
import { CUSTOMER_STATUSES } from '@/modules/crm/domain/statuses';
import { formatDateTime } from '@/utils/formatDate';
import useDrawerBreakpoint from '../_shared/useBreakpoint';
import CustomerActivityRail from '../sub/CustomerActivityRail';

const { Text } = Typography;
const money = (cents: number) =>
  `\u00a5${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const valueOrDash = (value: string | number | null | undefined) =>
  value || '\u2014';

const customerTypeLabels: Record<string, string> = {
  enterprise: '\u4f01\u4e1a',
  individual: '\u4e2a\u4eba',
};
const levelColors: Record<string, string> = {
  A: 'blue',
  B: 'geekblue',
  C: 'default',
  D: 'default',
};
const projectedStatuses = CUSTOMER_STATUSES.filter(
  (status) => status.value !== 'lost',
);
const lostReasonOptions = [
  { value: 'no_need', label: '\u65e0\u9700\u6c42' },
  { value: 'no_budget', label: '\u9884\u7b97\u4e0d\u8db3' },
  { value: 'competitor', label: '\u9009\u62e9\u7ade\u54c1' },
  { value: 'other', label: '\u5176\u4ed6' },
];

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  span?: 1 | 2;
}

const DetailField: React.FC<DetailFieldProps> = ({
  label,
  value,
  span = 1,
}) => (
  <div style={{ gridColumn: span === 2 ? 'span 2' : undefined }}>
    <Text style={{ display: 'block', color: '#667085', fontSize: 13 }}>
      {label}
    </Text>
    <div
      style={{
        marginTop: 6,
        color: '#1f2937',
        fontSize: 14,
        lineHeight: '22px',
      }}
    >
      {value}
    </div>
  </div>
);

const DetailSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section>
    <Text strong style={{ display: 'block', fontSize: 14 }}>
      {title}
    </Text>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        columnGap: 56,
        rowGap: 22,
        marginTop: 18,
      }}
    >
      {children}
    </div>
  </section>
);

const OverviewTab: React.FC<{
  customer: CustomerDetail;
  activityRefreshKey?: number;
  onCreateFollowUp?: () => void;
  onRelationshipStatusChanged?: () => void;
}> = ({
  customer,
  activityRefreshKey,
  onCreateFollowUp,
  onRelationshipStatusChanged,
}) => {
  const isDesktop = useDrawerBreakpoint();
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [relationshipAction, setRelationshipAction] = useState<
    'lost' | 'reactivate' | null
  >(null);
  const [relationshipSubmitting, setRelationshipSubmitting] = useState(false);
  const [relationshipReason, setRelationshipReason] = useState('');
  const [relationshipRemark, setRelationshipRemark] = useState('');
  const [relationshipError, setRelationshipError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listAllPages((page, pageSize) =>
        listOpportunities({ customerId: customer.id, page, pageSize }),
      ),
      listAllPages((page, pageSize) =>
        listContracts({ customerId: customer.id, page, pageSize }),
      ),
    ])
      .then(async ([opportunityResult, contractResult]) => {
        const paymentRows = await Promise.all(
          contractResult.map((contract) => listPaymentsByContract(contract.id)),
        );
        if (!active) return;
        setOpportunities(opportunityResult);
        setContracts(contractResult);
        setPayments(paymentRows.flat());
      })
      .catch(() => active && undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [customer.id]);

  const contractAmount = contracts.reduce(
    (sum, item) => sum + (item.amountCents ?? 0),
    0,
  );
  const receivedAmount = payments.reduce(
    (sum, item) => sum + (item.amountCents ?? 0),
    0,
  );
  const openOpportunity = opportunities.find(
    (item) => !['won', 'lost'].includes(item.stage),
  );
  const owner =
    customer.poolStatus === 'public'
      ? '\u5ba2\u6237\u516c\u6d77'
      : customer.ownerUserName?.trim() ||
        (customer.ownerUserId
          ? `\u7528\u6237 #${customer.ownerUserId}`
          : '\u6682\u672a\u5206\u914d');
  const region = [customer.province, customer.city].filter(Boolean).join(' / ');
  const statusIndex = Math.max(
    0,
    projectedStatuses.findIndex(
      (status) => status.value === customer.statusCode,
    ),
  );
  const isLost =
    customer.relationshipStatus === 'lost' || customer.statusCode === 'lost';

  const openRelationshipAction = (action: 'lost' | 'reactivate') => {
    setRelationshipReason('');
    setRelationshipRemark('');
    setRelationshipError(null);
    setRelationshipAction(action);
  };

  const submitRelationshipAction = async () => {
    const target = relationshipAction === 'reactivate' ? 'following' : 'lost';
    if (target === 'lost' && !relationshipReason) {
      setRelationshipError('\u8bf7\u9009\u62e9\u6d41\u5931\u539f\u56e0');
      return;
    }
    if (target === 'following' && !relationshipRemark.trim()) {
      setRelationshipError('\u8bf7\u8bf4\u660e\u91cd\u65b0\u6fc0\u6d3b\u539f\u56e0');
      return;
    }
    try {
      setRelationshipSubmitting(true);
      await transitionCustomerRelationshipStatus(customer.id, {
        target,
        ...(target === 'lost' ? { reasonCode: relationshipReason } : {}),
        ...(relationshipRemark.trim() ? { remark: relationshipRemark.trim() } : {}),
      });
      antdMessage.success(
        target === 'lost' ? '\u5df2\u6807\u8bb0\u6d41\u5931' : '\u5df2\u91cd\u65b0\u6fc0\u6d3b',
      );
      setRelationshipAction(null);
      onRelationshipStatusChanged?.();
    } catch (error: unknown) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      antdMessage.error(
        (error as Error)?.message ?? '\u5ba2\u6237\u5173\u7cfb\u72b6\u6001\u66f4\u65b0\u5931\u8d25',
      );
    } finally {
      setRelationshipSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '16px 0 24px' }}>
      <section
        aria-label="customer-lifecycle"
        style={{
          padding: '0 4px 22px',
          borderBottom: '1px solid #eaecf0',
          overflowX: 'auto',
        }}
      >
        <Steps
          current={statusIndex}
          size="small"
          responsive={false}
          status="process"
          items={projectedStatuses.map((status) => ({ title: status.label }))}
        />
        <Space style={{ marginTop: 12 }}>
          {isLost ? (
            <>
              <Tag color="error">{'\u5df2\u6d41\u5931'}</Tag>
              <Button
                size="small"
                onClick={() => openRelationshipAction('reactivate')}
              >
                {'\u91cd\u65b0\u6fc0\u6d3b'}
              </Button>
            </>
          ) : (
            <Button size="small" onClick={() => openRelationshipAction('lost')}>
              {'\u66f4\u591a'}
            </Button>
          )}
          {(customer.statusCode === 'opportunity' ||
            customer.statusCode === 'customer') && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {customer.statusCode === 'opportunity'
                ? '\u7531\u8d62\u5355\u5546\u673a\u6295\u5f71\uff0c\u8bf7\u5728\u5546\u673a\u4e2d\u5904\u7406\u3002'
                : '\u7531\u5c65\u7ea6\u5408\u540c\u6216\u65e0\u5408\u540c\u6210\u4ea4\u786e\u8ba4\u6295\u5f71\u3002'}
            </Text>
          )}
        </Space>
      </section>

      <div
        data-testid="customer-overview-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop
            ? 'minmax(0, 1fr) minmax(440px, 28%)'
            : 'minmax(0, 1fr)',
          minHeight: isDesktop ? 'calc(100dvh - 304px)' : undefined,
          height: isDesktop ? 'calc(100dvh - 304px)' : undefined,
          paddingTop: 24,
        }}
      >
        <main
          style={{
            minWidth: 0,
            paddingRight: isDesktop ? 40 : 0,
            overflowY: isDesktop ? 'auto' : undefined,
          }}
        >
          <DetailSection title="联系信息">
            <DetailField label="客户名称" value={valueOrDash(customer.name)} />
            <DetailField label="客户编号" value={valueOrDash(customer.code)} />
            <DetailField label="电话" value={valueOrDash(customer.phone)} />
            <DetailField label="官网" value={valueOrDash(customer.website)} />
            <DetailField label="地区" value={valueOrDash(region)} span={2} />
            <DetailField
              label="详细地址"
              value={valueOrDash(customer.address)}
              span={2}
            />
          </DetailSection>

          <Divider style={{ margin: '32px 0' }} />

          <DetailSection title="业务信息">
            <DetailField
              label="负责人"
              value={
                <Space size={6} align="center">
                  <Tag
                    color={
                      customer.poolStatus === 'public' ? 'default' : 'blue'
                    }
                  >
                    {customer.poolStatus === 'public'
                      ? '\u516c\u6d77'
                      : '\u5df2\u5206\u914d'}
                  </Tag>
                  <span>{owner}</span>
                </Space>
              }
            />
            <DetailField
              label="客户类型"
              value={valueOrDash(customerTypeLabels[customer.type])}
            />
            <DetailField
              label="客户状态"
              value={<Tag color="blue">{customer.statusName ?? '\u2014'}</Tag>}
            />
            <DetailField
              label="客户等级"
              value={
                customer.level ? (
                  <Tag color={levelColors[customer.level] ?? 'default'}>
                    {customer.level}
                  </Tag>
                ) : (
                  '\u2014'
                )
              }
            />
            <DetailField
              label="所属行业"
              value={valueOrDash(customer.industry)}
            />
            <DetailField
              label="客户来源"
              value={valueOrDash(customer.sourceName ?? customer.sourceId)}
            />
            <DetailField
              label="主要联系人"
              value={valueOrDash(customer.primaryContactName)}
            />
            <DetailField
              label="最近跟进"
              value={formatDateTime(customer.lastFollowUpAt)}
            />
            <DetailField
              label="下次跟进"
              value={formatDateTime(customer.nextFollowUpAt)}
            />
          </DetailSection>

          <Divider style={{ margin: '32px 0' }} />

          <DetailSection title="成交概况">
            <DetailField
              label="进行中商机"
              value={
                openOpportunity
                  ? `${openOpportunity.name} \u00b7 ${openOpportunity.amountCents === null ? '—' : money(openOpportunity.amountCents)}`
                  : '\u2014'
              }
              span={2}
            />
            {loading ? (
              <div style={{ gridColumn: 'span 2' }}>
                <Skeleton active paragraph={false} />
              </div>
            ) : (
              <>
                <DetailField
                  label="累计合同金额"
                  value={money(contractAmount)}
                />
                <DetailField label="累计回款" value={money(receivedAmount)} />
                <DetailField
                  label="待回款"
                  value={money(Math.max(0, contractAmount - receivedAmount))}
                />
              </>
            )}
          </DetailSection>

          {customer.remark && (
            <>
              <Divider style={{ margin: '32px 0' }} />
              <DetailSection title="备注">
                <DetailField
                  label="备注"
                  value={
                    <span style={{ whiteSpace: 'pre-wrap' }}>
                      {customer.remark}
                    </span>
                  }
                  span={2}
                />
              </DetailSection>
            </>
          )}

          <Text
            type="secondary"
            style={{
              display: 'block',
              marginTop: 28,
              color: '#98a2b3',
              fontSize: 12,
            }}
          >
            {`\u521b\u5efa\u4eba\uff1a${customer.creatorId ? `\u7528\u6237 #${customer.creatorId}` : '\u2014'} \u00b7 `}
            {`\u521b\u5efa\u4e8e ${customer.createdAt ? dayjs(customer.createdAt).format('YYYY-MM-DD HH:mm') : '\u2014'} \u00b7 `}
            {`\u66f4\u65b0\u4e8e ${customer.updatedAt ? dayjs(customer.updatedAt).format('YYYY-MM-DD HH:mm') : '\u2014'}`}
          </Text>
        </main>

        <aside
          style={{
            minWidth: 0,
            minHeight: 0,
            marginTop: isDesktop ? 0 : 32,
            paddingLeft: isDesktop ? 28 : 0,
            borderLeft: isDesktop ? '1px solid #eaecf0' : undefined,
            overflow: 'hidden',
          }}
        >
          <CustomerActivityRail
            customer={customer}
            refreshKey={activityRefreshKey}
            onCreateFollowUp={onCreateFollowUp}
          />
        </aside>
      </div>
      {relationshipAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            relationshipAction === 'reactivate'
              ? '\u91cd\u65b0\u6fc0\u6d3b\u5ba2\u6237'
              : '\u6807\u8bb0\u5ba2\u6237\u6d41\u5931'
          }
          style={{
            position: 'fixed',
            zIndex: 1200,
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(16, 24, 40, 0.45)',
          }}
        >
          <div
            style={{
              width: 420,
              maxWidth: 'calc(100vw - 32px)',
              padding: 24,
              background: '#fff',
              borderRadius: 8,
            }}
          >
            <Text strong>
              {relationshipAction === 'reactivate'
                ? '\u91cd\u65b0\u6fc0\u6d3b\u5ba2\u6237'
                : '\u6807\u8bb0\u5ba2\u6237\u6d41\u5931'}
            </Text>
            {relationshipAction === 'lost' && (
              <label style={{ display: 'block', marginTop: 20 }}>
                {'\u6d41\u5931\u539f\u56e0'}
                <select
                  aria-label={'\u6d41\u5931\u539f\u56e0'}
                  value={relationshipReason}
                  onChange={(event) => setRelationshipReason(event.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 8 }}
                >
                  <option value="">{'\u8bf7\u9009\u62e9'}</option>
                  {lostReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label style={{ display: 'block', marginTop: 20 }}>
              {'\u5907\u6ce8'}
              <textarea
                aria-label={'\u5907\u6ce8'}
                rows={3}
                maxLength={500}
                value={relationshipRemark}
                onChange={(event) => setRelationshipRemark(event.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 8 }}
              />
            </label>
            {relationshipError && (
              <Text type="danger" style={{ display: 'block', marginTop: 8 }}>
                {relationshipError}
              </Text>
            )}
            <Space style={{ marginTop: 20 }}>
              <Button onClick={() => setRelationshipAction(null)}>
                {'\u53d6\u6d88'}
              </Button>
              <Button
                type="primary"
                loading={relationshipSubmitting}
                onClick={submitRelationshipAction}
              >
                {'\u786e\u5b9a'}
              </Button>
            </Space>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
