import { Divider, Space } from 'antd';
import React from 'react';

export interface DrawerMetaItem {
  /** 二级灰色 label，如「负责人」「最近跟进」。为空则不渲染 label。 */
  label?: React.ReactNode;
  /** 主要文字。 */
  value: React.ReactNode;
}

export interface DrawerMetaRowProps {
  items: DrawerMetaItem[];
  /** 字号，默认 13。 */
  fontSize?: number;
  /** 字段间距，默认 12。 */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Drawer 标题下方的二级元数据行。
 *
 * 视觉：一行 key-value 用 antd Divider vertical 分隔，统一灰色；
 * 这是 LeadDetailDrawer 与 CustomerDrawer 顶部 meta 行的唯一统一抽象。
 * 业务字段顺序 / 文案由调用方决定。
 */
const DrawerMetaRow: React.FC<DrawerMetaRowProps> = ({
  items,
  fontSize = 13,
  size = 12,
  className,
  style,
}) => (
  <Space
    size={size}
    split={<Divider type="vertical" />}
    wrap
    className={className}
    style={{ marginTop: 6, fontSize, color: '#475569', ...style }}
  >
    {items.map((item) => (
      // 静态展示行：label+value 组成稳定 key（不依赖 index）
      <span key={`${String(item.label ?? '')}|${String(item.value ?? '')}`}>
        {item.label && (
          <span style={{ color: '#94a3b8', marginRight: 2 }}>{item.label}</span>
        )}
        {item.value}
      </span>
    ))}
  </Space>
);

export default DrawerMetaRow;
