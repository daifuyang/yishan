import { Flex, Typography } from 'antd';
import React from 'react';
import type { ToolCallViewModel } from '../model';
import { formatValue } from '../safe-data';

/**
 * 调试用的详细信息区。
 *
 * 只在卡片展开后出现，且**始终经过脱敏**（`safe-data.ts`）：密码、令牌、私钥
 * 既不会出现在参数里，也不会出现在结果里。
 *
 * 原始输出只在「没有专属 Renderer」时才有值——有专属 Renderer 的结果已经由
 * 那个 Renderer 呈现过一遍了，再塞一份 JSON 只会让人读两遍。
 */
export function ToolDetails({ tool }: { tool: ToolCallViewModel }) {
  const hasInput = tool.details.input !== undefined;
  const hasOutput = tool.details.output !== undefined;
  if (!hasInput && !hasOutput) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        工具：{tool.toolName}
        {tool.operationId ? ` / ${tool.operationId}` : ''}
      </Typography.Text>
    );
  }
  return (
    <Flex vertical gap={8} style={{ fontSize: 12, minWidth: 0 }}>
      <Typography.Text type="secondary">
        工具：{tool.toolName}
        {tool.operationId ? ` / ${tool.operationId}` : ''}
      </Typography.Text>
      {Object.entries({
        参数: tool.details.input,
        结果: tool.details.output,
      }).map(([label, value]) =>
        value === undefined ? null : (
          <div key={label}>
            <Typography.Text type="secondary">{label}</Typography.Text>
            <pre
              style={{
                margin: '4px 0',
                maxWidth: '100%',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {formatValue(value)}
            </pre>
          </div>
        ),
      )}
    </Flex>
  );
}
