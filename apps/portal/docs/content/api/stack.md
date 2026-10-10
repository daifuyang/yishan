---
title: 技术栈与命令
---

# 技术栈与命令

## 依赖概览

- 框架：`fastify` v5
- 类型/校验：`typescript`、`@sinclair/typebox`
- 数据库：MySQL、`drizzle-orm`、`mysql2`；迁移生成使用 `drizzle-kit`
- 认证：`@fastify/jwt`
- 文档：`@fastify/swagger`、`@fastify/swagger-ui`
- 缓存：`@fastify/redis`
- 测试：`vitest`

使用 Node 22.22.1 和 pnpm 8.15.9。运行依赖按职责声明在 Demo 和四个 Core 包的 `package.json` 中。

## 常用命令

- 开发：`pnpm dev:api`，监听 Core 和 Demo 源码，构建成功后重启。
- 构建：`pnpm build:api`，按依赖顺序构建五个包。
- 启动已编译应用：`pnpm --filter @yishan/demo-api start`。
- 生成新的 System 迁移：`pnpm db:generate`；业务模块的迁移在对应模块配置下生成。
- 检查发布历史和安装计划：`pnpm check:migrations`。
- 数据库迁移：`pnpm db:migrate --dry-run`，检查后明确执行 `pnpm db:migrate --apply`。
- 初始化数据：`pnpm db:seed`，只为显式安装模块执行 seed。
- 验证：`pnpm typecheck:api`、`pnpm test:api`、`pnpm test:integration`。

启动和构建不会自动生成或应用迁移。迁移 CLI 不提供 reset，也不会在缺少执行参数时写数据库。
