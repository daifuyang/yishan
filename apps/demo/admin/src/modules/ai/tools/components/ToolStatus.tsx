import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import React from 'react';
import type { ToolCallStatus } from '../model';

const labels: Record<ToolCallStatus, string> = {
  pending: '等待执行',
  running: '执行中',
  success: '执行完成',
  error: '执行失败',
  cancelled: '已取消',
};

const icons = {
  pending: MinusCircleOutlined,
  running: LoadingOutlined,
  success: CheckCircleOutlined,
  error: CloseCircleOutlined,
  cancelled: MinusCircleOutlined,
};

/**
 * 统一的执行状态指示。
 *
 * 状态**不靠颜色区分**：图标形状（空心 / 旋转 / 对勾 / 叉 / 短横）各不相同，
 * 并带 `aria-label`，读屏与色觉障碍用户都能分辨。
 *
 * 注意「执行完成」只说明**工具跑完了**，不代表业务数据已经创建成功——业务结果
 * 由 `FormPreviewRenderer` / `ActionResultRenderer` 按真实回执展示。
 */
export function ToolStatus({ status, empty }: { status: ToolCallStatus; empty: boolean }) {
  const Icon = empty ? MinusCircleOutlined : icons[status];
  const label = empty ? '无匹配结果' : labels[status];
  return (
    <Typography.Text
      type={status === 'error' ? 'danger' : !empty && status === 'success' ? 'success' : 'secondary'}
      aria-label={label}
      title={label}
      style={{ flex: 'none' }}
    >
      <Icon spin={status === 'running'} />
    </Typography.Text>
  );
}
