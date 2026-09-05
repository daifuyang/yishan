/**
 * 紧凑筛选工具条：
 *   [搜索框] [负责人] [状态] [等级] [类型] [更多筛选] ... [重置]
 *
 * 不套用 ProTable 默认的 search form —— 那个会生成"客户名称：[     ] 类型：[    ]"，
 * 老表单观感。本组件手动管理一行布局。
 *
 * 字段变化自动触发查询；右侧 [重置] 一键清空所有筛选 + 跳回第 1 页。
 */

import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Select, Space } from 'antd';
import React from 'react';
import type { CustomerListQuery, SourceRow, StatusRow } from '@/services/crm';

const LEVEL_OPTIONS = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
];

const TYPE_OPTIONS = [
  { value: 'enterprise', label: '企业' },
  { value: 'individual', label: '个人' },
];

export interface CustomerFilterBarProps {
  filters: Partial<CustomerListQuery>;
  onFilterChange: <K extends keyof CustomerListQuery>(
    key: K,
    value: CustomerListQuery[K] | undefined,
  ) => void;
  onKeywordChange: (keyword: string) => void;
  onReset: () => void;
  onOpenAdvanced: () => void;
  statuses: StatusRow[];
  sources: SourceRow[];
  /** 负责人下拉选项；为 undefined 时显示"我自己"占位。 */
  ownerOptions?: Array<{ value: number; label: string }>;
  /** 当前用户 ID；用于负责人下拉的"我自己"快捷项。 */
  currentUserId?: number;
  currentUserName?: string;
}

const CustomerFilterBar: React.FC<CustomerFilterBarProps> = ({
  filters,
  onFilterChange,
  onKeywordChange,
  onReset,
  onOpenAdvanced,
  statuses,
  sources,
  ownerOptions,
  currentUserId,
  currentUserName,
}) => {
  const statusOptions = React.useMemo(
    () =>
      statuses
        .filter((s) => s.enabled === 1)
        .map((s) => ({ value: s.id, label: s.name })),
    [statuses],
  );
  const _sourceOptions = React.useMemo(
    () =>
      sources
        .filter((s) => s.enabled === 1)
        .map((s) => ({ value: s.id, label: s.name })),
    [sources],
  );

  const ownerSelectOptions = React.useMemo(() => {
    const me: Array<{ value: number; label: string }> =
      currentUserId !== undefined
        ? [
            {
              value: currentUserId,
              label: `我自己${currentUserName ? `（${currentUserName}）` : ''}`,
            },
          ]
        : [];
    return [...me, ...(ownerOptions ?? [])];
  }, [currentUserId, currentUserName, ownerOptions]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索客户名称、联系人、手机号"
        style={{ width: 320 }}
        value={filters.keyword ?? ''}
        onChange={(e) => onKeywordChange(e.target.value)}
        onPressEnter={(e) =>
          onKeywordChange((e.target as HTMLInputElement).value)
        }
      />

      <Space size={8} wrap>
        <Select
          allowClear
          placeholder="负责人"
          style={{ width: 140 }}
          value={filters.ownerUserId}
          onChange={(v) => onFilterChange('ownerUserId', v)}
          options={ownerSelectOptions}
          showSearch
          optionFilterProp="label"
        />
        <Select
          allowClear
          placeholder="客户状态"
          style={{ width: 130 }}
          value={filters.statusId}
          onChange={(v) => onFilterChange('statusId', v)}
          options={statusOptions}
        />
        <Select
          allowClear
          placeholder="客户等级"
          style={{ width: 110 }}
          value={filters.level}
          onChange={(v) => onFilterChange('level', v)}
          options={LEVEL_OPTIONS}
        />
        <Select
          allowClear
          placeholder="客户类型"
          style={{ width: 110 }}
          value={filters.type}
          onChange={(v) => onFilterChange('type', v)}
          options={TYPE_OPTIONS}
        />
        <Button onClick={onOpenAdvanced}>更多筛选</Button>
      </Space>

      <div style={{ flex: 1 }} />

      <Button icon={<ReloadOutlined />} onClick={onReset}>
        重置
      </Button>
    </div>
  );
};

export default CustomerFilterBar;
