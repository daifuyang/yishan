import { ExportOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import React from 'react';

export interface DrawerNewWindowButtonProps {
  onOpen: () => void;
  tooltip?: string;
  ariaLabel?: string;
}

/**
 * CRM 抽屉右上角「↗ 新窗口打开」按钮。
 *
 * 业务用途：客户 drawer 里有这个按钮（点击 → 打开全屏编辑 / 详情路由）；
 * 线索 drawer 没有这个入口（私海/公海操作不需要）。
 */
const DrawerNewWindowButton: React.FC<DrawerNewWindowButtonProps> = ({
  onOpen,
  tooltip = '在新窗口打开完整详情',
  ariaLabel = '新窗口打开',
}) => (
  <Tooltip title={tooltip}>
    <Button
      type="text"
      icon={<ExportOutlined />}
      onClick={onOpen}
      aria-label={ariaLabel}
    />
  </Tooltip>
);

export default DrawerNewWindowButton;
