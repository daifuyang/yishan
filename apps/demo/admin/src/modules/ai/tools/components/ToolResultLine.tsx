import { Typography } from 'antd';
import React from 'react';

/**
 * 工具卡片展开后的一行结果。
 *
 * 只显示结论，状态由工具标题负责。展开区里不出现
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
    <Typography.Text
      type={muted ? 'secondary' : undefined}
      style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
    >
      {text}
    </Typography.Text>
  );
}
