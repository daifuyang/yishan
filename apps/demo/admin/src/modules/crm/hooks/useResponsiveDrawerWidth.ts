/**
 * Drawer 响应式宽度 hook。
 *
 * 桌面 / 平板 → clamp(860px, 68vw, 1320px)
 * 手机         → '100vw'
 *
 * 监听 window.resize，简单 setTimeout 150ms 防抖；
 * 卸载时清掉定时器和事件监听。
 */

import { useEffect, useState } from 'react';

export type ResponsiveDrawerWidth = 'clamp(860px, 68vw, 1320px)' | '100vw';

const MOBILE_BREAKPOINT = 768;
const FLUID_DRAWER_WIDTH = 'clamp(860px, 68vw, 1320px)' as const;
const FULL_VIEWPORT_WIDTH = '100vw' as const;

function resolveWidth(innerWidth: number): ResponsiveDrawerWidth {
  if (typeof window === 'undefined') return FLUID_DRAWER_WIDTH;
  return innerWidth < MOBILE_BREAKPOINT
    ? FULL_VIEWPORT_WIDTH
    : FLUID_DRAWER_WIDTH;
}

export function useResponsiveDrawerWidth(): ResponsiveDrawerWidth {
  const [width, setWidth] = useState<ResponsiveDrawerWidth>(() =>
    typeof window === 'undefined'
      ? FLUID_DRAWER_WIDTH
      : resolveWidth(window.innerWidth),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setWidth(resolveWidth(window.innerWidth));
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return width;
}

export default useResponsiveDrawerWidth;
