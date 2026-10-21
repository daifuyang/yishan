import { Typography } from 'antd';
import React, { useState } from 'react';
import { ToolCallCard } from '../components/ToolCallCard';
import { ToolResultLine } from '../components/ToolResultLine';
import type { ToolCallViewModel, ToolRendererProps } from '../model';

/**
 * `describe_operation` 的专属渲染器。
 *
 * 这个工具做的是「读一份操作定义」：读到了什么，只有助手自己用得上，
 * 用户只需要知道**读到了**。所以展开区只有一句话。
 *
 * 明确不做的事：
 *
 * - 不展示原始 Schema JSON、工具参数、完整字段定义——那是模型看的，不是人看的；
 * - 不做第二层折叠，也不加额外滚动容器；
 * - 不在这里放任何表单：表单补全在独立的补全面板里，不在工具记录里。
 */
export function DescribeOperationRenderer({ tool }: ToolRendererProps) {
  const running = tool.status === 'running' || tool.status === 'pending';
  const failed = tool.status === 'error' || tool.status === 'cancelled';
  /**
   * 展开状态由本组件掌握：**执行完成后默认收起**，用户手动展开后不再被
   * 后续的流式更新覆盖。
   */
  const [userExpanded, setUserExpanded] = useState<boolean | undefined>(undefined);
  const expanded = userExpanded ?? running;

  const isForm =
    tool.kind === 'form' ||
    tool.kind === 'draft' ||
    tool.operation?.kind === 'form' ||
    tool.operation?.kind === 'draft';

  const resultSummary = failed ? '未完成' : running ? '' : '已完成';
  const view: ToolCallViewModel = {
    ...tool,
    // 业务名已经写进标题，不再单独重复展示。
    subtitle: '',
    summary: [],
    note: undefined,
    resultSummary,
  };

  return (
    <ToolCallCard
      tool={view}
      showDetails={false}
      showError={false}
      showChevron
      expanded={expanded}
      onToggle={setUserExpanded}
    >
      {failed ? (
        <Typography.Text type="danger" style={{ overflowWrap: 'anywhere' }}>
          {tool.details.error?.message ||
            '本次读取未完成，可以重新生成回复再试一次。'}
        </Typography.Text>
      ) : (
        <ToolResultLine
          muted={running}
          text={
            isForm
              ? running
                ? '正在获取需要填写的信息及校验规则'
                : '已获取需要填写的信息及校验规则'
              : running
                ? '正在获取该操作的说明'
                : '已获取该操作的说明'
          }
        />
      )}
    </ToolCallCard>
  );
}
