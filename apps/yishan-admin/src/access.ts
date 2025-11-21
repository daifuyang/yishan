/**
 * @see https://umijs.org/docs/max/access#access
 * */

export interface Route {
  path: string;
}

export default function access(
  initialState: { currentUser?: API.currentUser } | undefined,
) {
  const { currentUser } = initialState ?? {};
  return {
    canDo: (route: Route) => {
      return currentUser?.accessPath?.includes(route.path);
    },
  };
}
