import type { UIMessage } from 'ai';
import { Flex } from 'antd';
import React from 'react';
import { toToolCalls, type OperationInfo } from '../adapter';
import type { ToolCallViewModel } from '../model';
import { toolRegistry } from '../renderers';

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
  const tools = toToolCalls(message, streaming, { operations }).filter((tool) => {
    if (draftToolIds && isDraftTool(tool)) return draftToolIds.has(tool.id);
    return true;
  });
  if (!tools.length) return null;
  return <Flex vertical gap={8}>{renderTools(tools)}</Flex>;
}

function isDraftTool(tool: ToolCallViewModel): boolean {
  return (
    tool.presentation.type === 'form-preview' &&
    tool.presentation.data.mode === 'draft'
  );
}

/**
 * 工具卡片一律平铺：**单层折叠**。
 *
 * 以前连续的「准备阶段」工具会再套一层 `<details>`，于是卡片里还嵌着折叠区，
 * 展开路径变成两层。这里取消外层折叠：每张卡片自己管自己的展开状态，
 * 用户手动展开后不会被后续的流式更新覆盖。
 */
function renderTools(tools: ToolCallViewModel[]) {
  return tools.map((tool) => <ToolCall key={tool.id} tool={tool} />);
}

function ToolCall({ tool }: { tool: ToolCallViewModel }) {
  const Renderer = toolRegistry.resolve(tool.presentation.type, tool.toolName);
  return <Renderer tool={tool} />;
}
