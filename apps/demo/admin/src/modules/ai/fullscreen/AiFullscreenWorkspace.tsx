import { createStyles } from 'antd-style';
import React, { Suspense, useEffect } from 'react';
import { AiChatView } from '../components/AiChatView';
import { AI_FULLSCREEN_Z_INDEX } from '../floating/aiOverlayLayers';
import { useAiChat } from '../hooks/useAiChat';

/**
 * 全屏 AI 工作台。以 Portal 覆盖在后台之上（顶部导航 / 左侧菜单 / 业务内容），
 * 但**不销毁**背景业务页面——它只是同一份聊天状态的另一种外层布局，
 * 没有任何路由跳转，因此地址栏保持当前业务 URL。
 */
const useStyles = createStyles(({ token, css }) => ({
  overlay: css`
    position: fixed; inset: 0; z-index: ${AI_FULLSCREEN_Z_INDEX};
    display: flex; flex-direction: column;
    background: ${token.colorBgLayout};
  `,
  surface: css`
    flex: 1; min-height: 0; margin: 12px;
    overflow: hidden;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    @media (max-width: 768px) { margin: 0; border-radius: 0; }
  `,
}));

export function AiFullscreenWorkspace() {
  const chat = useAiChat();
  const { styles } = useStyles();

  // Only the background scroll is locked; the workspace keeps its own scroll areas.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-label="AI 助手工作台"
      aria-modal
      onKeyDown={(event) => {
        // Only when focus is inside the overlay; higher-priority overlays stop propagation first.
        if (event.key === 'Escape') {
          event.stopPropagation();
          chat.minimize();
        }
      }}
    >
      <div className={styles.surface}>
        <Suspense fallback={<div style={{ padding: 24 }}>加载 AI 助手…</div>}>
          <AiChatView
            onMinimize={chat.minimize}
            onClose={() => chat.setViewMode('closed')}
          />
        </Suspense>
      </div>
    </div>
  );
}
