import { ConfigProvider } from 'antd';
import React from 'react';
import { AI_POPUP_Z_INDEX_BASE } from './aiOverlayLayers';

/**
 * 助手子树的层级外壳（设计 §4：不能只抬入口）。
 *
 * 单独导出是为了让它本身可测：助手内部的 Select / Tooltip / Popover 默认会落在
 * Ant Design 的 `zIndexPopupBase`（1050~1070），在业务 Modal 后面。这里把它们
 * 抬到助手面板之上，而且**只**影响助手子树 —— 业务弹层沿用自己的层级。
 *
 * 只包助手，不包业务页面：因此加一层 ConfigProvider 不会动到 Modal / Drawer。
 */
export function AiOverlayProvider({ children }: React.PropsWithChildren) {
  return (
    <ConfigProvider
      theme={{ token: { zIndexPopupBase: AI_POPUP_Z_INDEX_BASE } }}
    >
      {children}
    </ConfigProvider>
  );
}
