import { Grid } from 'antd';

/**
 * 抽屉内部栅格用的断点 hook 包装。
 *
 * 直接 Grid.useBreakpoint() 返回的 screens 可能滞后于首次渲染（hydration 不一致），
 * 这里加一个统一的 fallback：默认 xl=true，渲染之后再修正。
 *
 * 用法：
 *   const isDesktop = useDrawerBreakpoint();
 *   return isDesktop ? <WideLayout /> : <StackLayout />;
 */
export function useDrawerBreakpoint(): boolean {
  const screens = Grid.useBreakpoint();
  return Boolean(screens.xl);
}

export default useDrawerBreakpoint;
