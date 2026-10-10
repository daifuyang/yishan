---
title: 插件与中间件
---

# 插件与中间件

Fastify 插件在应用装配时注册。通用协议能力由 @yishan/core-api/plugins 提供，System 专属能力由 packages/core/system-api/src/setup.ts 组合。

- Swagger、TypeBox、Cookie、Multipart、Sensible：packages/core/api/src/plugins.ts。
- 统一错误处理：packages/core/api/src/error-handler.ts。
- JWT/PAT、RBAC、限流、安全、审计：packages/core/system-api/src/core/plugins/external/。
- 密码策略和字典映射：packages/core/system-api/src/core/plugins/app/。
- Redis：System setup 使用实例配置注册 @fastify/redis；公开 runtime 选项可以禁用连接。
- 静态上传资源及 Admin SPA：System 的 static 插件使用产品提供的资源根目录。

Swagger UI 为 /api/docs，JSON 为 /api/docs/json。业务模块由 apps/demo/api/src/manifest.ts 显式安装；模块可以 AutoLoad 自己的 routes/，Core 负责校验依赖、排序、注册、启停 gate 和关闭生命周期。
