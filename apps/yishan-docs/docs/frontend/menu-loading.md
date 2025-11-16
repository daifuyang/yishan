---
title: 菜单加载与动态权限
---

# 菜单加载与动态权限

菜单并非写死在前端，系统通过后端授权菜单树动态生成：

- 在 `src/app.tsx` 的 `getInitialState` 定义 `fetchMenus`，调用 `getAuthorizedMenuTree`
- 将菜单树转换为 `MenuDataItem`，过滤按钮类型（`type !== 2`）并按层级组织
- 布局的 `menu.request` 使用 `userId` 参数来加载对应用户的菜单

结合 `src/access.ts` 的路径权限校验（`accessPath`），前端实现了路由级的访问控制与菜单渲染。