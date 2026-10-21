import { Typography } from 'antd';
import React, { useState } from 'react';
import { ToolCallCard } from '../components/ToolCallCard';
import { ToolResultLine } from '../components/ToolResultLine';
import type { ToolCallViewModel, ToolRendererProps } from '../model';

/**
 * `update_form_draft` 的专属渲染器。
 *
 * 这个工具做的是「把助手已经拿到的信息写进**草稿**」。它离「业务数据创建成功」
 * 还差两步：用户补全信息 → 用户确认 → 走原有业务接口创建。
 *
 * 所以这张卡片**只**记录草稿这件事：
 *
 * - 不把整份表单塞进工具记录（表单在独立的补全面板里）；
 * - 不重复列出已填字段（用户看的是「还差什么」，不是「已经填了什么」）；
 * - 不放「继续填写」按钮（补全入口只有一个，就是补全面板）；
 * - 不出现部门、头像这类业务控件（那是业务表单的事）。
 */
export function UpdateFormDraftRenderer({ tool }: ToolRendererProps) {
  const running = tool.status === 'running' || tool.status === 'pending';
  const failed = tool.status === 'error' || tool.status === 'cancelled';
  /**
   * 展开状态由本组件掌握：**执行完成后默认收起**，用户手动展开后不再被
   * 后续的流式更新覆盖。
   */
  const [userExpanded, setUserExpanded] = useState<boolean | undefined>(undefined);
  const expanded = userExpanded ?? running;

  const resultSummary = failed ? '未完成' : running ? '' : '已完成';
  const view: ToolCallViewModel = {
    ...tool,
    // 业务名已经写进标题（「准备新增用户信息」），不再单独重复展示。
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
            '本次保存未完成，可以重新生成回复再试一次。'}
        </Typography.Text>
      ) : (
        <ToolResultLine
          muted={running}
          text={
            running ? '正在把提供的信息填入表单草稿' : '已将提供的信息填入表单草稿'
          }
        />
      )}
    </ToolCallCard>
  );
}
