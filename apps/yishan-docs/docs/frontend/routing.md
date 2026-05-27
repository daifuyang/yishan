---
title: 路由与菜单
---

# 路由与菜单

路由在 `config/routes.ts` 维护页面挂载与访问控制，菜单不再写死在前端，而是以后端授权菜单树与插件 manifest 同步结果为准。示例：

```ts title="config/routes.ts 部分"
// 核心系统页面直接挂载，菜单由后端返回
{
  path: '/system/user',
  component: './system/user',
  access: 'canDo',
}
```

插件页面由 `src/plugins/modules/*.manifest.ts` 生成到 `config/generated/plugin-routes.ts`，例如 `/plugins/yishan/portal/articles`。

## 权限控制

`src/access.ts` 提供 `canDo` 校验，根据当前用户的 `accessPath` 判断是否允许访问某个路径：

```ts title="src/access.ts"
export default function access(initialState: { currentUser?: API.userProfile } | undefined) {
  const { currentUser } = initialState ?? {};
  return {
    canDo: (route: { path: string }) => currentUser?.accessPath?.includes(route.path),
  };
}
```
