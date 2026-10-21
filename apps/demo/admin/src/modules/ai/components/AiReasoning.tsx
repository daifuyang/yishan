import { Think } from '@ant-design/x';
import XMarkdown from '@ant-design/x-markdown';
import type { UIMessage } from 'ai';
import React from 'react';

/**
 * 模型的思考过程。
 *
 * 旧架构里它和工具调用混在同一个 `AiMessageProgress` 组件里，导致「思考」和
 * 「工具结果」两件事互相牵连。拆开之后，思考只是一段可折叠的文本。
 */
export function AiReasoning({
  message,
  streaming,
}: {
  message: UIMessage;
  streaming: boolean;
}) {
  const reasoning = message.parts.filter((part) => part.type === 'reasoning');
  const text = reasoning.map((part) => part.text).join('\n\n');
  const thinking =
    streaming && reasoning.some((part) => part.state === 'streaming');
  if (!text) return null;
  return (
    <Think title={thinking ? '思考中' : '思考过程'} loading={thinking} defaultExpanded={false}>
      <XMarkdown
        content={text}
        escapeRawHtml
        streaming={{ hasNextChunk: thinking, tail: thinking }}
      />
    </Think>
  );
}
