/**
 * @see https://umijs.org/docs/max/access#access
 * */
import type { CurrentUser } from '@yishan/admin-sdk';

export interface Route {
  path: string;
}

export default function access(
  initialState: { currentUser?: CurrentUser } | undefined,
) {
  const { currentUser } = initialState ?? {};
  return {
    canDo: (route: Route) => {
      return currentUser?.accessPath?.includes(route.path);
    },
  };
}
