import { Tooltip } from 'antd';
import {
  peekUserFormOverlay,
  subscribeUserFormOverlay,
} from '@yishan/core-system-admin/form-assistance';
import { createStyles } from 'antd-style';
import { Sparkles } from 'lucide-react';
import React, { useSyncExternalStore } from 'react';
import { useAiChat } from '../hooks/useAiChat';
import { AI_OVERLAY_Z_INDEX } from './aiOverlayLayers';

/**
 * 右下角常驻入口。恒定 56px 正圆 + 主色渐变，任何时刻都不变形、不占额外横向空间。
 * 名称靠 Tooltip 承载（hover 才出现），不常驻占位。
 *
 * 实现约束：用原生 <button> 而非 antd <Button shape="circle">，后者自带
 * `.ant-btn-circle { width: auto }`，与外部尺寸规则同为单类优先级，注入顺序
 * 不保证，宽度会被吃掉、按钮塌成椭圆。
 *
 * 层级（设计 §4）：必须**高于**业务 Modal / Drawer（Ant Design 默认 1000），
 * 否则入口会被业务遮罩盖住、用户再也唤不起助手。旧的 900 正是这个 bug。
 */
const useStyles = createStyles(({ token, css }) => ({
  launcher: css`
    position: fixed; right: 24px; bottom: 24px; z-index: ${AI_OVERLAY_Z_INDEX};
    @media (max-width: 768px) { right: 16px; bottom: 16px; }
  `,
  withForm: css`
    @media (max-width: 768px) {
      bottom: calc(160px + env(safe-area-inset-bottom, 0px));
    }
  `,
  button: css`
    display: flex; align-items: center; justify-content: center;
    flex: none; box-sizing: border-box;
    width: 56px; height: 56px; min-width: 56px; min-height: 56px;
    padding: 0; border: none; border-radius: 50%;
    color: ${token.colorTextLightSolid}; font-size: ${token.fontSizeHeading1}px;
    line-height: 1; cursor: pointer;
    background: linear-gradient(
      135deg,
      ${token.colorPrimaryHover} 0%,
      ${token.colorPrimary} 55%,
      ${token.colorPrimaryActive} 100%
    );
    /* 两层 box-shadow：前者纯 token 兜底，后者用 color-mix 上主色 */
    box-shadow: ${token.boxShadowTertiary};
    box-shadow:
      0 6px 16px -6px ${token.colorPrimary},
      0 2px 6px -2px ${token.colorBgMask},
      inset 0 1px 0 rgb(255 255 255 / 28%);
    transition:
      box-shadow ${token.motionDurationMid},
      transform ${token.motionDurationMid};
    &:hover {
      transform: translateY(-2px);
      box-shadow:
        0 10px 24px -8px ${token.colorPrimary},
        0 2px 6px -2px ${token.colorBgMask},
        inset 0 1px 0 rgb(255 255 255 / 28%);
    }
    &:focus-visible {
      outline: ${token.lineWidth * 2}px solid ${token.colorPrimaryBorder};
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      transition: none;
      &:hover { transform: none; }
    }
  `,
}));

export function AiFloatingLauncher() {
  const chat = useAiChat();
  const { styles } = useStyles();
  const formOpen = useSyncExternalStore(
    subscribeUserFormOverlay,
    () => peekUserFormOverlay()?.open === true,
    () => false,
  );
  if (!chat.authorized) return null;
  return (
    <div
      className={[styles.launcher, formOpen ? styles.withForm : '']
        .filter(Boolean)
        .join(' ')}
    >
      <Tooltip title="AI 助手" placement="left">
        <button
          type="button"
          className={styles.button}
          aria-label="打开 AI 助手"
          aria-expanded={chat.viewMode !== 'closed'}
          onClick={chat.toggleFloating}
        >
          <Sparkles size={24} strokeWidth={1.8} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}
