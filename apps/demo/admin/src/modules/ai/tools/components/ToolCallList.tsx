import type { UIMessage } from 'ai';
import { Flex, Typography } from 'antd';
import React from 'react';
import { toToolCalls, type OperationInfo } from '../adapter';
import type { ToolCallViewModel } from '../model';
import { toolRegistry } from '../renderers';
import { ToolCallCard } from './ToolCallCard';
import { record, text } from '../safe-data';

/**
 * 一条消息里的所有工具调用。
 *
 * 这里是「展示模型 → 组件」的唯一入口：Renderer 的选择只经过注册表，
 * 模型给的任何字符串都影响不到加载哪个组件。
 */
export function ToolCallList({
  message,
  streaming,
  operations,
  draftToolIds,
}: {
  message: UIMessage;
  streaming: boolean;
  operations?: ReadonlyMap<string, OperationInfo>;
  /** 只保留这些草稿调用（同一份草稿的多次写入只展示最后一次）。 */
  draftToolIds?: ReadonlySet<string>;
}) {
  const tools = toToolCalls(message, streaming, { operations }).filter(
    (tool) => {
      if (draftToolIds && isDraftTool(tool)) return draftToolIds.has(tool.id);
      return true;
    },
  );
  if (!tools.length) return null;
  return (
    <Flex vertical gap={8}>
      {renderTools(tools)}
    </Flex>
  );
}

function isDraftTool(tool: ToolCallViewModel): boolean {
  return (
    tool.presentation.type === 'form-preview' &&
    tool.presentation.data.mode === 'draft'
  );
}

function renderTools(tools: ToolCallViewModel[]) {
  const groups: ToolCallViewModel[][] = [];
  const preparation = (tool: ToolCallViewModel) =>
    ['discover_operations', 'describe_operation', 'update_form_draft'].includes(
      tool.toolName,
    );
  for (const tool of tools) {
    const previous = groups.at(-1);
    // 查询结果和不同业务操作是准备任务的边界。
    if (
      preparation(tool) &&
      previous?.every(preparation) &&
      (!tool.operationId ||
        previous.every(
          (entry) =>
            !entry.operationId || entry.operationId === tool.operationId,
        ))
    ) {
      previous.push(tool);
    } else groups.push([tool]);
  }
  return groups.map((group) =>
    preparation(group[0]) ? (
      <PreparationGroup key={group[0].id} tools={group} />
    ) : (
      <ToolCall key={group[0].id} tool={group[0]} />
    ),
  );
}

function preparationTitle(tool: ToolCallViewModel) {
  if (tool.toolName !== 'discover_operations') return tool.title;
  const target = text(record(tool.details.input).keyword, 60) || tool.subtitle;
  if (tool.status === 'running' || tool.status === 'pending')
    return target ? `正在查找${target}功能…` : '正在查找业务功能…';
  return target ? `查找${target}功能` : '查找业务功能';
}

function PreparationGroup({ tools }: { tools: ToolCallViewModel[] }) {
  const single = tools.length === 1;
  const first = tools[0];
  const Renderer = toolRegistry.resolve(
    first.presentation.type,
    first.toolName,
  );
  const status = tools.some((tool) => tool.status === 'error')
    ? 'error'
    : tools.some((tool) => tool.status === 'cancelled')
      ? 'cancelled'
      : tools.some((tool) => tool.status === 'running')
        ? 'running'
        : tools.some((tool) => tool.status === 'pending')
          ? 'pending'
          : 'success';
  const titles = {
    error: '信息准备失败',
    cancelled: '信息准备已取消',
    running: '正在准备信息',
    pending: '准备信息',
    success: '已完成信息准备',
  };
  const labels = {
    error: '执行失败',
    cancelled: '已取消',
    running: '执行中',
    pending: '准备中',
    success: '已完成',
  };
  const view: ToolCallViewModel = {
    ...first,
    status,
    title: single ? preparationTitle(first) : titles[status],
    subtitle: '',
    summary: [],
    note: undefined,
    resultSummary: single ? labels[status] : `${tools.length} 项操作`,
    empty: false,
    details: {
      error:
        status === 'error'
          ? {
              message: tools
                .filter((tool) => tool.status === 'error')
                .map((tool) => tool.details.error?.message || '本次操作未完成')
                .join('；'),
            }
          : undefined,
    },
  };
  return (
    <ToolCallCard tool={view} showChevron showDetails={false}>
      {single
        ? status !== 'error' && <Renderer tool={first} bodyOnly />
        : tools.map((tool) => (
            <Flex
              key={tool.id}
              justify="space-between"
              align="start"
              gap={16}
              data-tool-call-id={tool.id}
            >
              <Typography.Text
                style={{ minWidth: 0, overflowWrap: 'anywhere' }}
              >
                {preparationTitle(tool)}
              </Typography.Text>
              <Typography.Text
                type={tool.status === 'error' ? 'danger' : 'secondary'}
                style={{ flexShrink: 0 }}
              >
                {labels[tool.status]}
              </Typography.Text>
            </Flex>
          ))}
    </ToolCallCard>
  );
}

function ToolCall({ tool }: { tool: ToolCallViewModel }) {
  const Renderer = toolRegistry.resolve(tool.presentation.type, tool.toolName);
  return <Renderer tool={tool} />;
}
