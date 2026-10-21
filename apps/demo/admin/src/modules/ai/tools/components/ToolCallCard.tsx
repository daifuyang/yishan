import { Alert, Flex } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import type { ToolCallViewModel } from '../model';
import { ToolDetails } from './ToolDetails';
import { ToolHeader } from './ToolHeader';

const useStyles = createStyles(({ css }) => ({
  card: css`
    width: 100%;
    min-width: 0;
    pre { max-width: 100%; overflow: auto; }
  `,
}));

/**
 * 所有工具卡片共用的外壳。
 *
 * 展开状态是**受控**的（不是原生 `<details>`）：内容在展开前根本不进 DOM，
 * 一次查询返回几百行时不会先把整张表渲染出来再藏起来。
 *
 * `mode='detailed'` 表示这张卡片本身就是主要内容（表单草稿、删除确认），
 * 默认展开；其余卡片默认折叠。
 */
export function ToolCallCard({
  tool,
  children,
  actions,
  defaultExpanded = false,
  mode = 'compact',
  showDetails = true,
  showError = true,
  showChevron = false,
  expanded,
  onToggle,
}: {
  tool: ToolCallViewModel;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  defaultExpanded?: boolean;
  mode?: 'compact' | 'detailed';
  /**
   * 关掉卡片自带的调试详情区。
   *
   * 专属 Renderer 自己提供了折叠详情（例如 `discover_operations` 的「查看调用详情」）
   * 时传 `false`，避免同一份原始数据显示两遍。
   */
  showDetails?: boolean;
  /**
   * 关掉卡片自带的错误提示条。
   *
   * 专属 Renderer 把错误放进自己的展开内容里时传 `false`，避免同一条错误出现两遍。
   */
  showError?: boolean;
  /** 标题行右侧的折叠箭头。 */
  showChevron?: boolean;
  /**
   * 受控的展开状态。
   *
   * 传了 `expanded` 就由调用方决定展开与否（卡片只负责把切换事件回传），
   * 不传则沿用组件内部的 `defaultExpanded` 状态。
   */
  expanded?: boolean;
  onToggle?: (next: boolean) => void;
}) {
  const { styles } = useStyles();
  const [internalExpanded, setInternalExpanded] = useState(
    defaultExpanded || mode === 'detailed',
  );
  const controlled = expanded !== undefined;
  const isExpanded = controlled ? expanded : internalExpanded;
  const handleToggle = () => {
    const next = !isExpanded;
    if (!controlled) setInternalExpanded(next);
    onToggle?.(next);
  };
  return (
    <Flex vertical gap={6} style={{ width: '100%', minWidth: 0 }}>
      <div className={styles.card} data-tool-call-id={tool.id}>
        <ToolHeader
          tool={tool}
          expanded={isExpanded}
          onToggle={handleToggle}
          actions={actions}
          chevron={showChevron}
        />
        {isExpanded && (
          <Flex
            vertical
            gap={8}
            style={{ paddingBlock: 8, paddingInlineStart: 22, minWidth: 0 }}
          >
            {children}
            {showDetails && <ToolDetails tool={tool} />}
          </Flex>
        )}
      </div>
      {showError && tool.details.error && (
        <Alert type="error" showIcon title={tool.details.error.message} />
      )}
    </Flex>
  );
}
