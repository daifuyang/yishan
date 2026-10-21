import React from 'react';
import { ToolCallCard } from '../components/ToolCallCard';
import type { ToolRendererProps } from '../model';

/**
 * 兜底渲染器：所有**没有专属 Renderer** 的工具都走这里。
 *
 * 它必须能在任何情况下渲染出来：数据缺失、结果结构异常、模型塞了乱七八糟的内容，
 * 都只影响卡片里的内容，不影响整条消息。
 */
export function GenericToolRenderer({ tool }: ToolRendererProps) {
  return <ToolCallCard tool={tool} />;
}
