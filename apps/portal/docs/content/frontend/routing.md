---
title: 路由与菜单
---

# 路由与菜单

config/routes.ts 只维护框架路由，包括登录、首页容器、公开报价页和 404。业务菜单与页面来自后端授权菜单树，由 src/app.tsx 的 patchClientRoutes 动态注入。

后端菜单的 `component` 字段使用组件键，例如 `./system/user`、`./modules/portal/articles`。`plugin.ts` 在编译期为 `src/pages` 和已安装的 `src/modules/<id>/pages` 生成 `.umi/module-components.ts`，运行时据此动态 import 页面。

## 权限控制

src/access.ts 的 canDo 根据当前用户 accessPath 判断路由路径是否可访问。菜单和页面权限与后端授权保持一致；API 路由仍独立执行认证及权限校验。

组件键、菜单 URL 和权限码是不同字段。添加页面时，先确认 Demo manifest 已安装业务模块，再提供页面文件和模块菜单 seed；菜单 URL 遵循 `/<id>/...` 的模块约定。
