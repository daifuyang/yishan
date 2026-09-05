/**
 * Customer Drawer URL 同步 hook。
 *
 * 设计：
 * - URL 是单一真相源：?customerId=N 决定 Drawer 是否打开 / 展示哪个客户。
 * - 可选 ?focus=followup：打开 Drawer 时自动跳到跟进 tab + focus 表单。
 *   Phase 3 通过 row action "跟进" 触发。
 * - 切换客户时直接改 URL search（pathname 不变），保留 view / filter / page 等其余参数。
 * - 关闭 Drawer 只删 customerId 一个键，其余参数原样保留。
 *
 * 用法：
 *   const drawer = useCustomerDrawer()
 *   <CustomerDrawer
 *     open={drawer.open}
 *     customerId={drawer.customerId}
 *     initialTab={drawer.initialTab}
 *     onClose={drawer.closeDrawer}
 *   />
 *
 *   drawer.openDrawer(id)                // 打开，默认 tab
 *   drawer.openDrawer(id, 'followup')    // 打开并切到跟进 tab
 *   drawer.closeDrawer()                 // 关闭
 */

import { useLocation, useNavigate } from '@umijs/max';
import { useCallback, useMemo } from 'react';

const CUSTOMER_ID_KEY = 'customerId';
const FOCUS_KEY = 'focus';

export type DrawerTabKey =
  | 'overview'
  | 'followup'
  | 'contacts'
  | 'opportunities'
  | 'more';

export interface UseCustomerDrawerReturn {
  open: boolean;
  customerId: number | null;
  initialTab: DrawerTabKey;
  openDrawer: (id: number, tab?: DrawerTabKey) => void;
  closeDrawer: () => void;
  setCustomerId: (id: number | null, tab?: DrawerTabKey) => void;
}

/** 安全地把任意值解析成正整数；解析失败返回 null。 */
function parseCustomerId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

const VALID_TABS: ReadonlySet<DrawerTabKey> = new Set([
  'overview',
  'followup',
  'contacts',
  'opportunities',
  'more',
]);

function parseFocus(raw: string | null): DrawerTabKey {
  if (raw && VALID_TABS.has(raw as DrawerTabKey)) return raw as DrawerTabKey;
  return 'overview';
}

/** 序列化 + 拼接 search；空串返回 pathname。 */
function buildQueryString(
  pathname: string,
  params: URLSearchParams,
): string {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function useCustomerDrawer(): UseCustomerDrawerReturn {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const customerId = useMemo(
    () => parseCustomerId(searchParams.get(CUSTOMER_ID_KEY)),
    [searchParams],
  );
  const initialTab = useMemo(
    () => parseFocus(searchParams.get(FOCUS_KEY)),
    [searchParams],
  );

  const open = customerId !== null;

  const setCustomerId = useCallback(
    (id: number | null, tab?: DrawerTabKey) => {
      const next = new URLSearchParams(location.search);
      if (id === null || !Number.isFinite(id) || id <= 0) {
        next.delete(CUSTOMER_ID_KEY);
        next.delete(FOCUS_KEY);
      } else {
        next.set(CUSTOMER_ID_KEY, String(id));
        if (tab && VALID_TABS.has(tab) && tab !== 'overview') {
          next.set(FOCUS_KEY, tab);
        } else {
          next.delete(FOCUS_KEY);
        }
      }
      navigate(buildQueryString(location.pathname, next), { replace: false });
    },
    [location.pathname, location.search, navigate],
  );

  const openDrawer = useCallback(
    (id: number, tab?: DrawerTabKey) => {
      setCustomerId(id, tab);
    },
    [setCustomerId],
  );

  const closeDrawer = useCallback(() => {
    setCustomerId(null);
  }, [setCustomerId]);

  return {
    open,
    customerId,
    initialTab,
    openDrawer,
    closeDrawer,
    setCustomerId,
  };
}

export default useCustomerDrawer;
