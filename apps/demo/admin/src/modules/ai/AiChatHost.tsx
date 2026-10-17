import { ConfigProvider } from 'antd';
import React, { lazy, Suspense } from 'react';
import { AiFloatingLauncher } from './floating/AiFloatingLauncher';
import { AI_POPUP_Z_INDEX_BASE } from './floating/aiOverlayLayers';
import { useAiChat } from './hooks/useAiChat';

/**
 * 唯一的展示控制器。viewMode 只有一个来源，任何组件都不再各自维护 open 状态。
 *
 * 浮窗与全屏是互斥的两层，同一时刻最多挂载一个 AiChatView；聊天状态始终留在
 * Provider 里，因此形态切换、切换业务路由都不会重建 useChat 或清空会话。
 * 懒加载保证未打开助手时不加载 Ant Design X 的聊天视图代码。
 */
const AiFloatingPanel = lazy(() =>
  import('./floating/AiFloatingPanel').then((m) => ({
    default: m.AiFloatingPanel,
  })),
);
const AiFullscreenWorkspace = lazy(() =>
  import('./fullscreen/AiFullscreenWorkspace').then((m) => ({
    default: m.AiFullscreenWorkspace,
  })),
);

export function AiChatHost() {
  const chat = useAiChat();
  if (!chat.authorized) return null;
  return (
    // 统一处理子弹层：助手内部的 Select / Tooltip / Popover 默认会落到
    // zIndexPopupBase（1050~1070），在业务 Modal 后面。这里抬高一档，
    // 只抬入口的 z-index 是不够的（设计 §4）。
    <ConfigProvider
      theme={{ token: { zIndexPopupBase: AI_POPUP_Z_INDEX_BASE } }}
    >
      <Suspense fallback={null}>
        {chat.viewMode === 'floating' && <AiFloatingPanel />}
        {chat.viewMode === 'fullscreen' && <AiFullscreenWorkspace />}
      </Suspense>
      <AiFloatingLauncher />
    </ConfigProvider>
  );
}
