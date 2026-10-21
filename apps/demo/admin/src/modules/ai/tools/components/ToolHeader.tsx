import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { Flex, Typography } from 'antd';
import React from 'react';
import type { ToolCallViewModel } from '../model';
import { ToolStatus } from './ToolStatus';

/**
 * 工具卡片的标题区。
 *
 * 标题分四层，职责不重叠：
 * - `title`：面向用户的动作名（「查询业务记录」）。
 * - `subtitle`：当前操作的上下文（对象、路径、检索词）。
 * - `summary`：少量安全的标量参数。
 * - `resultSummary`：一句话结果（「共 20 条，返回 1 条」）。
 *
 * 工具的 description（给模型看的能力说明）**不出现在这里**。
 */
export function ToolHeader({
  tool,
  onToggle,
  expanded,
  actions,
  chevron = false,
}: {
  tool: ToolCallViewModel;
  onToggle?: () => void;
  expanded?: boolean;
  actions?: React.ReactNode;
  /**
   * 是否显示折叠指示箭头。
   *
   * 默认关：不是每个工具卡片都需要箭头（有些卡片的标题不是折叠入口）。
   * 需要时由调用方显式打开，箭头随 `expanded` 切换方向。
   */
  chevron?: boolean;
}) {
  const label = (
    <Flex component="span" align="baseline" gap={8} style={{ minWidth: 0 }}>
      <span style={{ overflowWrap: 'anywhere' }}>
        {tool.title || '工具调用'}
      </span>
      {tool.subtitle && (
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12, overflowWrap: 'anywhere' }}
        >
          {tool.subtitle}
        </Typography.Text>
      )}
    </Flex>
  );
  return (
    <Flex vertical gap={4} style={{ width: '100%', minWidth: 0 }}>
      <Flex align="baseline" gap={8} style={{ width: '100%', minWidth: 0 }}>
        <ToolStatus status={tool.status} empty={tool.empty} />
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              font: 'inherit',
              color: 'inherit',
              textAlign: 'start',
              cursor: 'pointer',
              minWidth: 0,
              flex: 1,
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
            }}
          >
            {label}
            <span
              style={{ marginInlineStart: 'auto', flexShrink: 0, fontSize: 12 }}
            >
              {tool.resultSummary}
            </span>
            {chevron && (
              <span aria-hidden style={{ flex: 'none' }}>
                {expanded ? <DownOutlined /> : <RightOutlined />}
              </span>
            )}
          </button>
        ) : (
          label
        )}
        {!onToggle && (
          <Typography.Text
            type={tool.status === 'error' ? 'danger' : 'secondary'}
            style={{
              marginInlineStart: 'auto',
              fontSize: 12,
              overflowWrap: 'anywhere',
            }}
          >
            {tool.resultSummary}
          </Typography.Text>
        )}
        {actions}
      </Flex>
      {tool.summary.length > 0 && (
        <Flex wrap gap={8} style={{ paddingInlineStart: 22 }}>
          {tool.summary.map((item) => (
            <Typography.Text
              type="secondary"
              key={item.label}
              style={{ fontSize: 12, overflowWrap: 'anywhere' }}
            >
              {item.label}：{item.value}
            </Typography.Text>
          ))}
        </Flex>
      )}
      {tool.note && (
        <Typography.Text
          type="secondary"
          style={{
            fontSize: 12,
            overflowWrap: 'anywhere',
            paddingInlineStart: 22,
          }}
        >
          {tool.note}
        </Typography.Text>
      )}
    </Flex>
  );
}
