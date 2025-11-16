---
title: 路由与菜单
---

# 路由与菜单

路由在 `config/routes.ts` 统一维护，并与菜单项关联。示例：

```ts title="config/routes.ts 部分"
// /system 下包含用户、角色、菜单、部门、岗位
{
  path: '/system',
  name: 'system',
  icon: 'setting',
  access: 'canDo',
  routes: [
    { path: '/system/user', name: 'user', component: './system/user', access: 'canDo' },
    { path: '/system/role', name: 'role', component: './system/role', access: 'canDo' },
    { path: '/system/menu', name: 'menu', component: './system/menu', access: 'canDo' },
    { path: '/system/department', name: 'department', component: './system/department', access: 'canDo' },
    { path: '/system/post', name: 'post', component: './system/post', access: 'canDo' },
  ],
}
```

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