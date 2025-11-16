---
title: 数据库与模型
---

# 数据库与模型

使用 Prisma 管理数据模型：

- 模型定义：`prisma/schema.prisma`
- 生成客户端：`npm run postinstall` 或 `npx prisma generate`
- 迁移：`npm run db:init`
- 初始化数据：`npm run db:seed`

服务层通过 `src/models/*` 与 `src/services/*` 访问数据库，并在路由中进行业务校验与响应。