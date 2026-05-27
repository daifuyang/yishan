---
title: 后端概览
---

# 后端概览（yishan-api）

后端采用 Fastify + TypeScript + Prisma 的组合，提供标准化的认证、业务码、响应与缓存机制。

## 模块与插件

- 核心插件：数据库、JWT 鉴权、Redis、Swagger、错误处理等，位于 `src/core/plugins/*`
- 核心路由：`/api/v1/auth`、`/api/v1/admin/*`（用户、角色、菜单、部门、系统管理等）
- 插件路由：`/api/modules/<module>/v1/*`，如门户插件 `portal`
- 模型与服务：`src/core/models/*`、`src/core/services/*`
- 校验 Schema：`src/core/schemas/*`（TypeBox 定义）
