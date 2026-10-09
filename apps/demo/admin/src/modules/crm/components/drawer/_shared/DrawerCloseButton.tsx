import { CloseOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import React from 'react';

export interface DrawerCloseButtonProps {
  onClose: () => void;
  /** 鼠标悬停提示文案；为空则不渲染 Tooltip。 */
  tooltip?: string;
  /** a11y 标签，默认「关闭」。 */
  ariaLabel?: string;
}

/**
 * CRM 抽屉右上角 × 按钮。
 *
 * 视觉：text icon button，无 padding 占用，hover 时背景轻微变化。
 * 之所以不直接用 antd 自带 closable：因为我们要 × 紧贴右上角、
 * 与「新窗口打开」按钮并排，自带 closable 不能灵活控制位置。
 */
const DrawerCloseButton: React.FC<DrawerCloseButtonProps> = ({
  onClose,
  tooltip = '关闭',
  ariaLabel = '关闭',
}) => {
  const button = (
    <Button
      type="text"
      icon={<CloseOutlined />}
      onClick={onClose}
      aria-label={ariaLabel}
    />
  );
  return tooltip ? (
    <Tooltip title={tooltip}>{button}</Tooltip>
  ) : (
    button
  );
};

export default DrawerCloseButton;
