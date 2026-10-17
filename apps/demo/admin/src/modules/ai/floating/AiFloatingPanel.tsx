import {
  isEventInsideAssistant,
  peekUserFormOverlay,
  registerAssistantEscape,
  registerAssistantRegion,
} from '@yishan/core-system-admin/form-assistance';
import { createStyles } from 'antd-style';
import React, { Suspense, useCallback, useEffect } from 'react';
import { AiChatView } from '../components/AiChatView';
import { useAiChat } from '../hooks/useAiChat';
import { AI_OVERLAY_Z_INDEX } from './aiOverlayLayers';
import { useFloatingDrag } from './useFloatingDrag';

/**
 * 客服式浮窗。非模态：没有遮罩、不锁定背景滚动，消息区独立滚动。
 *
 * 与业务 Modal/Drawer 的关系（设计 §4）：
 * - 层级高于业务弹层（`AI_OVERLAY_Z_INDEX`），入口与面板都随时可点；
 * - 可拖动，且**只在标题栏**拖动，位置被夹在可视区域内，resize 后不会跑出屏幕；
 * - 关闭面板时把焦点还给业务表单（焦点目标由表单通过协作契约声明），
 *   **不会**连带关闭未保存的业务表单。
 */
const useStyles = createStyles(({ token, css }) => ({
  panel: css`
    position: fixed; right: 24px; bottom: 96px; z-index: ${AI_OVERLAY_Z_INDEX};
    width: min(440px, calc(100vw - 32px));
    height: min(680px, calc(100dvh - 140px));
    overflow: hidden;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowSecondary};
    @media (max-width: 768px) {
      right: 8px; left: 8px; bottom: 8px; width: auto;
      height: calc(100dvh - env(safe-area-inset-bottom, 0px) - 16px);
    }
  `,
}));

export function AiFloatingPanel() {
  const chat = useAiChat();
  const { styles } = useStyles();
  const drag = useFloatingDrag(chat.identity);

  // 面板把自己的 DOM 区域登记给参与协作的表单：表单据此判断
  // 「这次 Esc 属于助手」而不是关掉自己。
  useEffect(
    () => registerAssistantRegion(() => drag.panelRef.current),
    [drag.panelRef],
  );

  const close = useCallback(() => {
    chat.setViewMode('closed');
    // 焦点回到业务表单的声明目标；表单没开时不抢焦点。
    const target = peekUserFormOverlay()?.returnFocusTarget ?? null;
    target?.focus?.();
  }, [chat]);

  // Esc 仲裁：参与协作的表单在场时由表单那一侧（document 捕获阶段）调用本处理函数；
  // 没有表单在场时助手自己收尾。两条路径只可能有一条生效，不会双重关闭。
  useEffect(
    () =>
      registerAssistantEscape(() => {
        close();
        return true;
      }),
    [close],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!isEventInsideAssistant(event.target)) return;
      if (peekUserFormOverlay()?.open === true) return;
      close();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [close]);

  return (
    <div
      ref={drag.panelRef}
      className={styles.panel}
      style={drag.style}
      role="dialog"
      aria-label="AI 助手"
      aria-modal={false}
    >
      <Suspense fallback={<div style={{ padding: 24 }}>加载 AI 助手…</div>}>
        <AiChatView
          floating
          headerProps={drag.handleProps}
          onExpand={chat.expand}
          onClose={close}
        />
      </Suspense>
    </div>
  );
}
