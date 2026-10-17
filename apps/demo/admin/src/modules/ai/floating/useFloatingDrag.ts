import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FLOATING_VIEWPORT_MARGIN } from './aiOverlayLayers';

export interface FloatingPosition {
  left: number;
  top: number;
}

export interface FloatingDragApi {
  /** 挂到浮窗根节点上：拖动时用来量尺寸与初始位置。 */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** `null` = 仍用 CSS 默认锚点（右下角）；有值 = 用户拖到了具体位置。 */
  position: FloatingPosition | null;
  style: CSSProperties | undefined;
  /** 挂到**标题栏**上：只有按住标题栏才拖，消息区/输入区不会误拖。 */
  handleProps: {
    onMouseDown: (event: React.MouseEvent) => void;
    onTouchStart: (event: React.TouchEvent) => void;
  };
  reset: () => void;
}

/** 把 `value` 夹在 `[margin, max - size - margin]`；空间不足时退化为 margin。 */
export function clampToViewport(
  value: number,
  max: number,
  size: number,
  margin: number = FLOATING_VIEWPORT_MARGIN,
): number {
  const upper = Math.max(margin, max - size - margin);
  return Math.min(Math.max(value, margin), upper);
}

/**
 * 浮窗拖动（设计 §4）：只在标题栏生效、限制在可视区域内、窗口 resize 后不跑出屏幕。
 *
 * 有两个刻意的约束：
 *
 * - **只有标题栏能拖**：`handleProps` 必须挂在标题栏而不是浮窗根节点，
 *   否则用户在消息区选中文本时会连窗一起拖走。
 * - **身份变化即复位**：切换账号后旧位置与旧手势引用都作废，
 *   否则新用户会继承上一个用户的窗口位置与半截未松手的拖动。
 */
export function useFloatingDrag(identity: string | null): FloatingDragApi {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  /** 手势过程存在 ref 里：它不需要触发渲染，只有落定的位置才需要。 */
  const drag = useRef<{
    pointerX: number;
    pointerY: number;
    rectLeft: number;
    rectTop: number;
    width: number;
    height: number;
  } | null>(null);

  const clearDrag = useCallback(() => {
    drag.current = null;
  }, []);

  const endDrag = useCallback(() => {
    if (!drag.current) return;
    clearDrag();
    document.body.style.userSelect = '';
  }, [clearDrag]);

  const move = useCallback((clientX: number, clientY: number) => {
    const current = drag.current;
    const panel = panelRef.current;
    if (!current || !panel) return;
    const next = {
      left: clampToViewport(
        current.rectLeft + (clientX - current.pointerX),
        window.innerWidth,
        current.width || panel.offsetWidth,
      ),
      top: clampToViewport(
        current.rectTop + (clientY - current.pointerY),
        window.innerHeight,
        current.height || panel.offsetHeight,
      ),
    };
    setPosition((previous) =>
      previous && previous.left === next.left && previous.top === next.top
        ? previous
        : next,
    );
  }, []);

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      drag.current = {
        pointerX: clientX,
        pointerY: clientY,
        rectLeft: rect.left,
        rectTop: rect.top,
        width: rect.width,
        height: rect.height,
      };
      document.body.style.userSelect = 'none';
      move(clientX, clientY);
    },
    [move],
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!drag.current) return;
      move(event.clientX, event.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!drag.current) return;
      const touch = event.touches[0];
      if (touch) move(touch.clientX, touch.clientY);
    };
    const onUp = () => endDrag();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
      document.body.style.userSelect = '';
    };
  }, [endDrag, move]);

  // 窗口尺寸变化后把窗口夹回可视区域：缩窄浏览器不该让面板停在屏幕外。
  useEffect(() => {
    const onResize = () => {
      const current = drag.current;
      const panel = panelRef.current;
      setPosition((previous) => {
        if (!previous || !panel) return previous;
        return {
          left: clampToViewport(
            previous.left,
            window.innerWidth,
            panel.offsetWidth,
          ),
          top: clampToViewport(
            previous.top,
            window.innerHeight,
            panel.offsetHeight,
          ),
        };
      });
      // 未落定位置时无需处理；current 仅用于让 resize 不打断进行中的手势。
      void current;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 身份变化：丢掉拖动位置与手势引用（切账号不留旧窗口位置）。
  useEffect(() => {
    drag.current = null;
    document.body.style.userSelect = '';
    setPosition(null);
  }, [identity]);

  const handleProps = createHandleProps(startDrag);

  return {
    panelRef,
    position,
    style: position
      ? {
          left: position.left,
          top: position.top,
          right: 'auto',
          bottom: 'auto',
        }
      : undefined,
    handleProps,
    reset: () => {
      drag.current = null;
      setPosition(null);
    },
  };
}

function createHandleProps(
  startDrag: (clientX: number, clientY: number) => void,
): FloatingDragApi['handleProps'] {
  return {
    onMouseDown: (event: React.MouseEvent) => {
      // 只认鼠标左键 / 单指；右键与多指手势不当作拖动起点。
      if (event.button !== 0) return;
      event.preventDefault();
      startDrag(event.clientX, event.clientY);
    },
    onTouchStart: (event: React.TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      startDrag(touch.clientX, touch.clientY);
    },
  };
}
