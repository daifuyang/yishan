/**
 * @see https://umijs.org/docs/max/access#access
 * */
import { canAccessPath } from '@yishan/core-admin/permission';
import type { CurrentUser } from '@/types/sdk';

export interface Route {
  path: string;
}

export default function access(
  initialState: { currentUser?: CurrentUser } | undefined,
) {
  const { currentUser } = initialState ?? {};
  return {
    canDo: (route: Route) => {
      return canAccessPath(currentUser, route.path);
    },
  };
}
