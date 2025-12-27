---
title: 数据库与模型
---

# 数据库与模型

使用 Prisma 管理数据模型：

- 模型定义：`prisma/schema.prisma`
- 生成客户端：`pnpm --filter yishan-api db:generate`（或 `npx prisma generate`）
- 迁移：`pnpm --filter yishan-api db:init`
- 初始化数据：`pnpm --filter yishan-api db:seed`

服务层通过 `src/models/*` 与 `src/services/*` 访问数据库，并在路由中进行业务校验与响应。
