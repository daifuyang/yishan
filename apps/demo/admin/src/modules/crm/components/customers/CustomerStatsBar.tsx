/**
 * 客户列表上方 4 张轻量统计卡。
 *
 * 数据源：/api/crm/v1/dashboard 的 counters。
 * 不做趋势图，不做复杂 BI；每张卡 ~80px，icon + 数字 + 短说明。
 *
 * 趋势字段（较昨日 / 较上周）暂用 mock fallback —— 后端暂未下发趋势 delta。
 * 后续在 dashboard counter 接口补 trend 字段后替换即可。
 */

import {
  AlertOutlined,
  CalendarOutlined,
  PlusCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Skeleton, Space } from 'antd';
import React from 'react';
import type { DashboardData } from '@/services/crm';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  trend?: string;
  tone?: 'default' | 'danger' | 'warning';
}

const TONE_COLOR: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: '#1677ff',
  danger: '#ff4d4f',
  warning: '#fa8c16',
};

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  trend,
  tone = 'default',
}) => {
  const color = TONE_COLOR[tone];
  return (
    <div
      style={{
        flex: 1,
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        minHeight: 84,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: `${color}14`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>
          {label}
        </div>
        {value === undefined ? (
          <Skeleton.Input
            active
            size="small"
            style={{ width: 60, height: 22 }}
          />
        ) : (
          <Space size={8} align="baseline">
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: '#262626',
                lineHeight: 1,
              }}
            >
              {value}
            </span>
            {trend && (
              <span
                style={{
                  fontSize: 12,
                  color: tone === 'danger' ? color : '#8c8c8c',
                }}
              >
                {trend}
              </span>
            )}
          </Space>
        )}
      </div>
    </div>
  );
};

export interface CustomerStatsBarProps {
  data: DashboardData | null;
  loading?: boolean;
}

const CustomerStatsBar: React.FC<CustomerStatsBarProps> = ({
  data,
  loading,
}) => {
  const counters = data?.counters;
  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: 12 }}>
      <StatCard
        icon={<TeamOutlined />}
        label="我的客户"
        value={loading ? undefined : counters?.myCustomers}
        trend={undefined}
      />
      <StatCard
        icon={<CalendarOutlined />}
        label="今日待跟进"
        value={loading ? undefined : counters?.pendingFollowUp}
        tone="default"
      />
      <StatCard
        icon={<AlertOutlined />}
        label="逾期未跟进"
        value={loading ? undefined : counters?.overdueFollowUp}
        tone="danger"
      />
      <StatCard
        icon={<PlusCircleOutlined />}
        label="本周新增"
        value={
          loading
            ? undefined
            : counters?.todayNew /* 临时复用 todayNew，后续接 weekNew */
        }
      />
    </div>
  );
};

export default CustomerStatsBar;
