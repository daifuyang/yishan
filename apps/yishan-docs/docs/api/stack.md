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

- 开发：`pnpm --filter yishan-api dev`
- 构建并启动：`pnpm --filter yishan-api start`
- 生成 Prisma 客户端：`pnpm --filter yishan-api db:generate`
- 数据库迁移：`pnpm --filter yishan-api db:init`
- 初始化数据：`pnpm --filter yishan-api db:seed`
- 重置数据库：`pnpm --filter yishan-api db:reset`
