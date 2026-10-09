---
title: 前端概览
---

# 前端概览（yishan-admin）

管理后台使用 Umi Max、React 19、Ant Design 6 和 Pro Components，代码质量检查使用 Biome 与 TypeScript，单元测试使用 Jest。

## 关键目录

- config/routes.ts：登录、首页容器、404 等框架路由。
- src/pages/system/：用户、角色、菜单、部门、岗位、存储等系统页面。
- `src/modules/<id>/pages/`：模块业务页面；CRM 的表单、抽屉与领域映射就近组织在 CRM 模块中。
- src/services/generated/：OpenAPI 生成客户端；现有 CRM 手写请求在 src/services/crm.ts。
- src/types/sdk.ts：前端使用的类型边界。
- src/utils/token.ts、src/utils/auth.ts：认证与本地状态。
- src/requestErrorConfig.ts：请求、响应和错误处理。

## 菜单、页面和权限

/api/v1/auth/me 返回 accessPath，src/access.ts 按路径校验权限。后端授权菜单树的 component 字段驱动 src/app.tsx 的 patchClientRoutes 动态注入业务路由。

plugin.ts 在编译期收集系统页面及已安装模块页面，生成 .umi/module-components.ts 中的动态 import 映射。业务模块是否安装以 apps/demo/api/src/manifest.ts 为准，Admin 不执行后端模块代码，也不通过 meta.enabled 判断安装状态。
