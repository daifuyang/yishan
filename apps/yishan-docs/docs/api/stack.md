---
title: 技术栈与命令
---

# 技术栈与命令

## 依赖概览

- 框架：`fastify` v5、`fastify-cli`
- 类型/校验：`typescript`、`@sinclair/typebox`
- ORM：`prisma`
- 认证：`@fastify/jwt`
- 文档：`@fastify/swagger`、`@fastify/swagger-ui`
- 缓存：`@fastify/redis`
- 测试：`vitest`

详见 `apps/yishan-api/package.json`。

## 常用命令

- 开发：`npm run dev`
- 构建并启动：`npm run start`
- 数据库迁移：`npm run db:init`
- 数据库初始化：`npm run db:seed`
- 重置数据库：`npm run db:reset`