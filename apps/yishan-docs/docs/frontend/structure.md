---
title: 目录结构
---

# 目录结构

~~~text
apps/yishan-admin/
  config/routes.ts       框架路由
  config/proxy.ts        开发代理
  plugin.ts              编译期页面组件映射
  src/pages/system/      系统页面
  src/modules/<id>/        就近组织的业务页面与组件
  src/services/generated/ OpenAPI 客户端和类型
  src/services/crm.ts    现有 CRM 请求边界
  src/types/sdk.ts       前端类型边界
  src/utils/             认证与小型工具
  src/requestErrorConfig.ts
  src/access.ts
~~~

系统页面使用 user、role、menu、department、position、dict、region、site、storage、attachments、login-log 等目录。业务页面位于 `src/modules/<id>/pages/<page>/index.tsx`，组件与业务行为保留在对应模块。

plugin.ts 生成系统和已安装模块的组件映射，例如 ./system/user 与 ./modules/portal/articles。后端菜单给出 URL 与组件键；前端动态注入路由。模块安装清单位于 Demo API 的 src/manifest.ts，CRM 源码保留但默认不进入页面映射。
