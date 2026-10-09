---
title: 目录结构
---

# 目录结构

~~~text
apps/demo/admin/
  config/routes.ts       框架路由
  config/proxy.ts        开发代理
  plugin.ts              公开 Umi 构建插件的产品适配入口
  src/pages/             登录、公开报价等产品框架页面
  src/modules/<id>/        就近组织的业务页面与组件
  src/services/generated/ OpenAPI 客户端和类型
  src/services/crm.ts    现有 CRM 请求边界
  src/types/sdk.ts       前端类型边界
  src/utils/             认证与小型工具
  src/requestErrorConfig.ts
  src/access.ts
~~~

系统页面位于 `packages/core/system-admin/src/pages/`，使用 user、role、menu、department、position、dict、region、site、storage、attachments、login-log 等目录，通过 `@yishan/core-system-admin` 的公开 exports 提供。公共运行时和 Umi 构建插件位于 `packages/core/admin`。两个包直接消费源码，不需要预构建。业务页面位于产品 `src/modules/<id>/pages/<page>/index.tsx`，组件与业务行为保留在对应模块。

产品 plugin.ts 调用 `@yishan/core-admin/umi-plugin` 生成系统和已安装模块的组件映射，例如 `./system/user` 与 `./modules/portal/articles`。后端菜单给出 URL 与组件键；前端动态注入路由。模块安装清单位于同产品 API 的 `src/manifest.ts`，Demo 的 CRM 源码保留但默认不进入页面映射。迁移保留菜单键、权限与线上 `/admin/` 路径。
