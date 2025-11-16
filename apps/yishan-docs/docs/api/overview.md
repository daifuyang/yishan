---
title: 后端概览
---

# 后端概览（yishan-api）

后端采用 Fastify + TypeScript + Prisma 的组合，提供标准化的认证、业务码、响应与缓存机制。

## 模块与插件

- 插件：数据库、JWT 鉴权、Redis、Swagger、错误处理等
- 路由：`/api/v1/auth`、`/api/v1/admin/*`（用户、角色、菜单、部门、岗位、系统管理）
- 模型与服务：`src/models/*`、`src/services/*`
- 校验 Schema：`src/schemas/*`（TypeBox 定义）