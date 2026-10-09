import { useEffect, useState } from 'react';

/**
 * CRM 抽屉最小宽度（像素）。
 *
 * 配合 activity 轨道固定 420px + 28px padding + 48px drawer 内边距，
 * 留出约 604px 的左侧正文给字段 Grid，每列 ~266px，长公司名/邮箱
 * 等字段不再换行，活动轨道也可观。低于此值的 resize 会被 clamp 拦下。
 */
export const MIN_DRAWER_SIZE = 1100;

/** 桌面端 ≥1280px 时的初始宽度（视口 80%），移动端 fallback 到最小值。 */
export const DESKTOP_VIEWPORT = 1280;

export function getInitialDrawerSize(viewportWidth: number): number {
  const desired = Math.round(viewportWidth * 0.8);
  return Math.max(MIN_DRAWER_SIZE, desired);
}

/**
 * Resize 回调里调用：把用户拖出来的新宽度钳制到 [MIN, ∞)。
 * antd Drawer 的 resizable 不直接支持 minWidth，这里手动 clamp。
 */
export function clampDrawerSize(next: number): number {
  return Math.max(MIN_DRAWER_SIZE, Math.round(next));
}

/**
 * Resizable Drawer 的 size 状态 hook。
 *
 * - 初始宽度 = viewport × 80%，下限 MIN_DRAWER_SIZE。
 * - 监听 window.resize：当 viewport 跨过桌面端断点变化时同步 size，
 *   避免移动端放大窗口后 drawer 残留 100% 宽度。
 *
 * 返回 [size, setSize] 兼容 antd Drawer 的 size / resizable.onResize API。
 */
export function useResizableDrawer(): [
  number,
  (next: number | ((prev: number) => number)) => void,
] {
  const [size, setSize] = useState<number>(() =>
    getInitialDrawerSize(
      typeof window === 'undefined' ? 1366 : window.innerWidth,
    ),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => {
      setSize((current) => {
        const target = getInitialDrawerSize(window.innerWidth);
        // 只在断点附近、且当前尺寸明显偏小时拉回；用户在拖动时不要覆盖他的意图。
        if (
          window.innerWidth >= DESKTOP_VIEWPORT &&
          current < MIN_DRAWER_SIZE
        ) {
          return target;
        }
        return current;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return [size, setSize];
}
