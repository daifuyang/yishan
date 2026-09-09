/**
 * 客户 Drawer — 基本信息 Tab。
 *
 * 布局（与 LeadDetailDrawer 对齐）：
 *   左：分段详情（联系信息 / 业务信息 / 备注）
 *   右：CustomerActivityRail
 *
 * 视图自适应：
 *   - 桌面端（≥xl）：左 main + 右 rail 两栏
 *   - 移动端：堆叠，rail 在下方
 */

import { Divider, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import type { CustomerDetail, StatusRow } from '@/services/crm';
import { formatDateTime } from '@/utils/formatDate';
import CustomerActivityRail from '../sub/CustomerActivityRail';
import useDrawerBreakpoint from '../_shared/useBreakpoint';

const { Text } = Typography;

export interface BasicInfoTabProps {
  customer: CustomerDetail;
  statuses: StatusRow[];
  /** 写完一条跟进后通知父级（用于刷新客户详情里的 statusId / 时间戳）。 */
  onFollowUpSaved?: () => void;
}

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  span?: 1 | 2;
}

const DetailField: React.FC<DetailFieldProps> = ({ label, value, span = 1 }) => (
  <div style={{ gridColumn: span === 2 ? 'span 2' : undefined }}>
    <Text
      style={{ display: 'block', color: '#667085', fontSize: 13 }}
    >
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

const DetailSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section>
    <Text strong style={{ display: 'block', fontSize: 14 }}>
      {title}
    </Text>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        columnGap: 72,
        rowGap: 22,
        marginTop: 18,
      }}
    >
      {children}
    </div>
  </section>
);

const valueOrDash = (v: string | number | null | undefined) =>
  v || '—';

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  enterprise: '企业',
  individual: '个人',
};

const LEVEL_COLOR: Record<string, string> = {
  A: 'blue',
  B: 'geekblue',
  C: 'default',
  D: 'default',
};

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
  customer,
  statuses,
  onFollowUpSaved,
}) => {
  const isDesktop = useDrawerBreakpoint();

  const ownerValue =
    customer.poolStatus === 'public'
      ? '客户公海'
      : customer.ownerUserName?.trim() ||
        (customer.ownerUserId ? `用户 #${customer.ownerUserId}` : '暂未分配');

  const region = [customer.province, customer.city]
    .filter(Boolean)
    .join(' / ');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isDesktop
          ? 'minmax(0, 1fr) 420px'
          : 'minmax(0, 1fr)',
        width: '100%',
        minHeight: isDesktop ? 'calc(100dvh - 208px)' : 'auto',
        height: isDesktop ? 'calc(100dvh - 208px)' : undefined,
        alignItems: 'stretch',
      }}
    >
      <main
        style={{
          minWidth: 0,
          maxWidth: isDesktop ? 880 : undefined,
          paddingRight: isDesktop ? 40 : 0,
          overflowY: isDesktop ? 'auto' : undefined,
        }}
      >
        <DetailSection title="联系信息">
          <DetailField
            label="客户名称"
            value={valueOrDash(customer.name)}
          />
          <DetailField
            label="客户编号"
            value={valueOrDash(customer.code)}
          />
          <DetailField label="电话" value={valueOrDash(customer.phone)} />
          <DetailField label="官网" value={valueOrDash(customer.website)} />
          <DetailField
            label="地区"
            value={valueOrDash(region)}
            span={2}
          />
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
                  color={customer.poolStatus === 'public' ? 'default' : 'blue'}
                >
                  {customer.poolStatus === 'public' ? '公海' : '已分配'}
                </Tag>
                <span>{ownerValue}</span>
              </Space>
            }
          />
          <DetailField
            label="客户类型"
            value={valueOrDash(CUSTOMER_TYPE_LABEL[customer.type])}
          />
          <DetailField
            label="客户状态"
            value={
              customer.statusName ? (
                <Tag color="blue">{customer.statusName}</Tag>
              ) : (
                <span style={{ color: '#bfbfbf' }}>—</span>
              )
            }
          />
          <DetailField
            label="客户等级"
            value={
              customer.level ? (
                <Tag color={LEVEL_COLOR[customer.level] ?? 'default'}>
                  {customer.level}
                </Tag>
              ) : (
                <span style={{ color: '#bfbfbf' }}>—</span>
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
            label="标签"
            value={
              customer.tagIds.length > 0 ? (
                <span>
                  {customer.tagIds.map((id) => (
                    <Tag
                      key={id}
                      color="default"
                      style={{ marginInlineEnd: 6 }}
                    >
                      #{id}
                    </Tag>
                  ))}
                </span>
              ) : (
                <span style={{ color: '#bfbfbf' }}>—</span>
              )
            }
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
            fontSize: 12,
            color: '#98a2b3',
          }}
        >
          创建人：
          {customer.creatorId ? `用户 #${customer.creatorId}` : '—'}
          {' · 创建于 '}
          {customer.createdAt
            ? dayjs(customer.createdAt).format('YYYY-MM-DD HH:mm')
            : '—'}
          {' · 更新于 '}
          {customer.updatedAt
            ? dayjs(customer.updatedAt).format('YYYY-MM-DD HH:mm')
            : '—'}
        </Text>
      </main>

      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          borderLeft: isDesktop ? '1px solid #eaecf0' : undefined,
          paddingLeft: isDesktop ? 28 : 0,
        }}
      >
        <CustomerActivityRail
          customer={customer}
          statuses={statuses}
          onFollowUpSaved={onFollowUpSaved}
        />
      </div>
    </div>
  );
};

export default BasicInfoTab;