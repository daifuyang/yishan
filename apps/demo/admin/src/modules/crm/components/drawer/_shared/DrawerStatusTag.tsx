import { Tag } from 'antd';
import React from 'react';

/**
 * 统一的 status → antd Tag color 映射。
 *
 * 业务 status 是字符串；遇到未知 status 时 fallback 到 'default'，不抛错。
 */
const STATUS_COLOR: Record<string, string> = {
  pending: 'processing',
  contact_valid: 'success',
  contact_invalid: 'error',
  closed: 'default',
};

export interface DrawerStatusTagProps {
  status: string;
  label?: string;
}

/**
 * CRM 抽屉顶部 status tag。
 *
 * - 客户状态由后端动态 statusId 转 name，按 palette.primary 兜底
 *
 * 文案默认 = status 原值；调用方若需要本地化文案（如 "联系方式有效"），传 label。
 */
const DrawerStatusTag: React.FC<DrawerStatusTagProps> = ({ status, label }) => {
  const color = STATUS_COLOR[status] ?? 'default';
  return (
    <Tag
      color={color}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        marginInlineEnd: 0,
        lineHeight: '22px',
      }}
    >
      {label ?? status}
    </Tag>
  );
};

export default DrawerStatusTag;
