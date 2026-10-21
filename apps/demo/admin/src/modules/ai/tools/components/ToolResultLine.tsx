import { CheckCircleOutlined } from '@ant-design/icons';
import { Flex, Typography } from 'antd';
import React from 'react';

/**
 * 工具卡片展开后的一行结果。
 *
 * 只有一句话 + 一个对勾：这是**给人看的结论**，不是原始数据。展开区里不出现
 * JSON、参数、字段定义或第二层折叠。
 */
export function ToolResultLine({
  text,
  muted = false,
}: {
  text: string;
  /** 语气弱一些（还没完成、执行中）。 */
  muted?: boolean;
}) {
  return (
    <Flex align="start" gap={8} style={{ minWidth: 0 }}>
      <CheckCircleOutlined
        aria-hidden
        style={{
          flex: 'none',
          marginTop: 4,
          color: muted ? 'var(--ant-color-text-tertiary)' : 'var(--ant-color-success)',
        }}
      />
      <Typography.Text
        type={muted ? 'secondary' : undefined}
        style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {text}
      </Typography.Text>
    </Flex>
  );
}
