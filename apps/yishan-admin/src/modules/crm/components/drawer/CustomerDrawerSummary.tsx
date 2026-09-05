/**
 * 客户 Drawer 标题下方的 5 列摘要条。
 *
 *   负责人 | 最近跟进 | 下次跟进 | 客户等级 | 当前状态
 *
 * 每个 cell：label (12px 灰色) + value (14px)。null 显示 #bfbfbf '—'。
 * 时间字段走 dayjs(value).format('YYYY-MM-DD HH:mm')。
 */

import dayjs from 'dayjs';
import React from 'react';

const LABEL_COLOR = '#8c8c8c';
const VALUE_COLOR = '#262626';
const PLACEHOLDER_COLOR = '#bfbfbf';

export interface CustomerDrawerSummaryProps {
  ownerName: string | null;
  lastFollowUpAt: string | null;
  nextFollowUpAt: string | null;
  level: string | null;
  statusName: string | null;
}

function formatTime(value: string | null): string {
  if (!value) return '—';
  const d = dayjs(value);
  if (!d.isValid()) return '—';
  return d.format('YYYY-MM-DD HH:mm');
}

interface CellProps {
  label: string;
  value: string;
}

const Cell: React.FC<CellProps> = ({ label, value }) => {
  const isPlaceholder = value === '—';
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '0 8px' }}>
      <div
        style={{
          fontSize: 12,
          color: LABEL_COLOR,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: isPlaceholder ? PLACEHOLDER_COLOR : VALUE_COLOR,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  );
};

const CustomerDrawerSummary: React.FC<CustomerDrawerSummaryProps> = ({
  ownerName,
  lastFollowUpAt,
  nextFollowUpAt,
  level,
  statusName,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: '12px 4px',
      }}
    >
      <Cell label="负责人" value={ownerName ?? '—'} />
      <Cell label="最近跟进" value={formatTime(lastFollowUpAt)} />
      <Cell label="下次跟进" value={formatTime(nextFollowUpAt)} />
      <Cell label="客户等级" value={level ?? '—'} />
      <Cell label="当前状态" value={statusName ?? '—'} />
    </div>
  );
};

export default CustomerDrawerSummary;
