/**
 * 客户表列定义。
 *
 * 列（设计稿）：
 *   □ / 客户名称 / 联系人 / 客户状态 / 客户等级 / 负责人 / 最近跟进 / 下次跟进 / 来源 / 更新时间 / 操作
 *
 * - 客户名称：第一行客户名；第二行次级类型文字
 * - 联系人：姓名 + 手机号，悬停时可快速复制
 * - 状态：用 Tag 而不是 render 自定义节点
 * - 等级：A/B/C 用蓝色 Tag
 * - 负责人：纯文本（避免 list 加 Avatar + name 占用过多空间）
 * - 时间：valueType: 'dateTime' 让 ProTable 自己渲染
 * - 操作：宽度 160 / fixed: right / dataIndex: 'option' / valueType: 'option'
 *
 * "客户名称"列整行 clickable 由 ProTable 的 onRow 控制；本组件只产 ProColumns。
 */

import type { ProColumns } from '@ant-design/pro-components';
import { Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import type { CustomerRow, SourceRow, StatusRow, TagRow } from '@/services/crm';
import CustomerActionDropdown from './CustomerActionDropdown';
import CustomerContactCell from './CustomerContactCell';
import CustomerNameCell from './CustomerNameCell';

export interface CustomerTableColumnsOptions {
  canFilterOwners?: boolean;
  ownerOptions?: Array<{ id: number; name: string }>;
  statuses: StatusRow[];
  sources: SourceRow[];
  tags: TagRow[];
  currentUserId?: number;
  currentUserName?: string;
  primaryContactMap: Map<number, { name: string; mobile: string | null }>;
  ownerNameMap: Map<number, string>;
  onOpenDetail: (id: number) => void;
  onChanged: () => void;
  /** Phase 3：行内"跟进"点击触发；当前未传则按 navigate 行为。 */
  onOpenFollowupDrawer?: (id: number) => void;
}

export function buildCustomerTableColumns(
  opts: CustomerTableColumnsOptions,
): ProColumns<CustomerRow>[] {
  const {
    statuses,
    sources,
    tags,
    canFilterOwners = false,
    ownerOptions = [],
    primaryContactMap,
    ownerNameMap,
    onOpenDetail,
    onChanged,
    onOpenFollowupDrawer,
  } = opts;

  const statusNameMap = new Map<number, string>();
  for (const s of statuses) statusNameMap.set(s.id, s.name);

  const sourceNameMap = new Map<number, string>();
  for (const s of sources) sourceNameMap.set(s.id, s.name);

  const statusValueEnum = Object.fromEntries(
    statuses
      .filter((s) => s.enabled === 1)
      .map((s) => [s.id, { text: s.name }]),
  );
  const sourceValueEnum = Object.fromEntries(
    sources.filter((s) => s.enabled === 1).map((s) => [s.id, { text: s.name }]),
  );
  const tagValueEnum = Object.fromEntries(
    tags
      .filter((tag) => tag.enabled === 1)
      .map((tag) => [tag.id, { text: tag.name }]),
  );

  return [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: {
        placeholder: '客户名称、联系人、手机号',
      },
    },
    {
      title: '负责人',
      dataIndex: 'ownerUserId',
      valueType: 'select',
      hideInTable: true,
      search: canFilterOwners ? undefined : false,
      valueEnum: Object.fromEntries(
        ownerOptions.map((owner) => [owner.id, { text: owner.name }]),
      ),
      fieldProps: {
        placeholder: '全部负责人',
        allowClear: true,
        showSearch: true,
        optionFilterProp: 'label',
      },
    },
    {
      title: '客户类型',
      dataIndex: 'type',
      valueType: 'select',
      hideInTable: true,
      valueEnum: {
        enterprise: { text: '企业' },
        individual: { text: '个人' },
      },
    },
    {
      title: '客户标签',
      dataIndex: 'tagIds',
      valueType: 'select',
      hideInTable: true,
      valueEnum: tagValueEnum,
      fieldProps: { mode: 'multiple' },
    },
    {
      title: '客户名称',
      dataIndex: 'name',
      width: 240,
      fixed: 'left',
      render: (_, r) => (
        <CustomerNameCell
          id={r.id}
          name={r.name}
          type={r.type}
          onOpenDetail={onOpenDetail}
        />
      ),
    },
    {
      title: '联系人',
      dataIndex: 'primaryContactName',
      width: 160,
      search: false,
      render: (_, r) => {
        const c = r.primaryContactName
          ? {
              name: r.primaryContactName,
              mobile: r.primaryContactMobile ?? null,
            }
          : primaryContactMap.get(r.id);
        if (!c) return <span style={{ color: '#bfbfbf' }}>—</span>;
        return <CustomerContactCell name={c.name} phone={c.mobile} />;
      },
    },
    {
      title: '客户状态',
      dataIndex: 'statusId',
      width: 110,
      valueType: 'select',
      valueEnum: statusValueEnum,
      render: (_, r) => {
        const name = r.statusId ? statusNameMap.get(r.statusId) : null;
        if (!name) return <Tag color="default">未设置</Tag>;
        return <Tag color="blue">{name}</Tag>;
      },
    },
    {
      title: '客户等级',
      dataIndex: 'level',
      width: 90,
      valueType: 'select',
      valueEnum: {
        A: { text: 'A' },
        B: { text: 'B' },
        C: { text: 'C' },
        D: { text: 'D' },
      },
      render: (_, r) => {
        if (!r.level) return <span style={{ color: '#bfbfbf' }}>—</span>;
        const color =
          r.level === 'A' ? 'blue' : r.level === 'B' ? 'geekblue' : 'default';
        return <Tag color={color}>{r.level}</Tag>;
      },
    },
    {
      title: '负责人',
      dataIndex: 'ownerUserId',
      width: 110,
      search: false,
      render: (_, r) => {
        if (r.poolStatus === 'public') return <Tag color="default">公海</Tag>;
        if (!r.ownerUserId)
          return <span style={{ color: '#bfbfbf' }}>未分配</span>;
        return (
          r.ownerUserName ||
          ownerNameMap.get(r.ownerUserId) || (
            <span style={{ color: '#bfbfbf' }}>—</span>
          )
        );
      },
    },
    {
      title: '最近跟进',
      dataIndex: 'lastFollowUpAt',
      width: 160,
      search: false,
      render: (_, r) => formatRelative(r.lastFollowUpAt),
    },
    {
      title: '下次跟进',
      dataIndex: 'nextFollowUpAt',
      width: 170,
      search: false,
      render: (_, r) => formatNextFollowUp(r.nextFollowUpAt),
    },
    {
      title: '来源',
      dataIndex: 'sourceId',
      width: 110,
      valueType: 'select',
      valueEnum: sourceValueEnum,
      search: false,
      render: (_, r) => {
        if (!r.sourceId) return <span style={{ color: '#bfbfbf' }}>—</span>;
        return (
          sourceNameMap.get(r.sourceId) ?? (
            <span style={{ color: '#bfbfbf' }}>—</span>
          )
        );
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      search: false,
      valueType: 'dateTime',
      render: (_, row) => {
        const date = dayjs(row.updatedAt);
        if (!row.updatedAt || !date.isValid()) return '—';
        return (
          <Tooltip title={date.format('YYYY-MM-DD HH:mm:ss')}>
            <time dateTime={date.toISOString()}>
              {date.format('MM-DD HH:mm')}
            </time>
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <CustomerActionDropdown
          record={record}
          onChanged={onChanged}
          onOpenFollowupDrawer={onOpenFollowupDrawer}
        />
      ),
    },
  ];
}

function formatRelative(value: string | null): React.ReactNode {
  if (!value) return <span style={{ color: '#bfbfbf' }}>—</span>;
  const d = dayjs(value);
  if (!d.isValid()) return <span style={{ color: '#bfbfbf' }}>—</span>;
  const diffMin = dayjs().diff(d, 'minute');
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)} 小时前`;
  if (diffMin < 60 * 24 * 30) return `${Math.floor(diffMin / (60 * 24))} 天前`;
  return d.format('YYYY-MM-DD HH:mm');
}

function formatNextFollowUp(value: string | null): React.ReactNode {
  if (!value) return <span style={{ color: '#bfbfbf' }}>—</span>;
  const d = dayjs(value);
  if (!d.isValid()) return <span style={{ color: '#bfbfbf' }}>—</span>;
  const diffMin = d.diff(dayjs(), 'minute');
  let label: string;
  if (diffMin < 0) label = `已逾期 ${formatAbsDuration(-diffMin)}`;
  else if (diffMin < 60) label = `${diffMin} 分钟后`;
  else if (diffMin < 60 * 24) label = `${Math.floor(diffMin / 60)} 小时后`;
  else if (diffMin < 60 * 24 * 7)
    label = `${Math.floor(diffMin / (60 * 24))} 天后`;
  else label = d.format('YYYY-MM-DD');

  const overdue = diffMin < 0;
  const soon = !overdue && diffMin < 60 * 24;
  const color = overdue ? '#ff4d4f' : soon ? '#1677ff' : '#262626';
  return <span style={{ color }}>{label}</span>;
}

function formatAbsDuration(min: number): string {
  if (min < 60) return `${min} 分钟`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} 小时`;
  return `${Math.floor(min / (60 * 24))} 天`;
}
