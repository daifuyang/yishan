import { Drawer } from 'antd';
import type { DrawerProps } from 'antd';
import React from 'react';
import { clampDrawerSize } from './useResizableDrawer';

/**
 * CRM 抽屉统一外壳。
 *
 * 统一行为：
 *   - resizable：可拖拽右边沿调整宽度，下限由 useResizableDrawer / clampDrawerSize 控制
 *   - destroyOnClose：关闭后卸载内部状态（防 stale 客户/活动数据）
 *   - closable={false}：关闭 icon 由调用方通过 DrawerCloseButton 自定义位置
 *   - maskClosable=true：点击遮罩关闭（默认）
 *
 * 内部宽度由父组件用 useResizableDrawer 维护，这里只接收 size + setSize。
 */
export interface DrawerChromeProps
  extends Omit<DrawerProps, 'size' | 'resizable' | 'destroyOnClose' | 'closable'> {
  size: number;
  setSize: (next: number) => void;
}

const DrawerChrome: React.FC<DrawerChromeProps> = ({
  size,
  setSize,
  children,
  ...rest
}) => (
  <Drawer
    {...rest}
    size={size}
    destroyOnClose
    closable={false}
    resizable={{
      onResize: (next) => setSize(clampDrawerSize(next)),
      onResizeEnd: () => undefined,
    }}
  >
    {children}
  </Drawer>
);

export default DrawerChrome;
