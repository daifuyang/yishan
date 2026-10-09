/** Private customer views. Pending and A-level importance retain existing business rules. */
import type { CustomerListQuery } from '@/services/crm';

export type SystemViewId = 'all' | 'pending' | 'important';
export interface CustomerViewItem {
  id: SystemViewId;
  name: string;
  backendView: CustomerListQuery['view'];
  description?: string;
}
export const SYSTEM_VIEWS: CustomerViewItem[] = [
  {
    id: 'all',
    name: '全部',
    backendView: 'all',
    description: '当前数据权限范围内的全部私域客户',
  },
  {
    id: 'pending',
    name: '待跟进',
    backendView: 'pending',
    description: '下次跟进时间已到或已过',
  },
  {
    id: 'important',
    name: '重点客户',
    backendView: 'important',
    description: '客户等级 A',
  },
];
export function buildQueryFromView(
  view: SystemViewId,
  extra: Partial<CustomerListQuery> = {},
): CustomerListQuery {
  return {
    ...extra,
    view,
    poolStatus: 'owned',
  };
}
export function isSystemView(
  view: string | undefined | null,
): view is SystemViewId {
  return !!view && SYSTEM_VIEWS.some((v) => v.id === view);
}
/** Old mine/pool bookmarks resolve to the private all view; never to public data. */
export function normalizeCustomerView(
  view: string | undefined | null,
): SystemViewId {
  if (view === 'followup') return 'pending';
  return isSystemView(view) ? view : 'all';
}
