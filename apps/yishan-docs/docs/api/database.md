---
title: 数据库与模型
---

# 数据库与模型

使用 MySQL 与 Drizzle ORM 管理数据模型：

- DDL 真源：`drizzle/*.sql`
- 生成的 Drizzle 表与关系：`src/db/schema/{tables,relations,index}.ts`（运行 `pnpm --filter yishan-api db:generate` 生成，不手工修改）
- 数据库入口：`src/db/{client,manager,index}.ts`，业务代码从 `@/db` 导入 `drizzleDb`
- 初始化数据：`pnpm --filter yishan-api db:seed`（需要先构建 API）

服务层通过 `src/core/models/*` 与 `src/core/services/*` 访问数据库；插件模块可在 `src/plugins/modules/*` 下维护自己的 schema、service 或 model，并在路由中进行业务校验与响应。

## API 字段与 Drizzle 字段映射

面向前端和外部调用方的 HTTP/OpenAPI 字段使用小驼峰；MySQL 列使用下划线；Drizzle 的 TypeScript 属性使用小驼峰。例如，API 参数与 Drizzle 表属性为 `sortOrder`，数据库列为 `sort_order`：

```ts
const postOrderColumns = {
  sortOrder: sysPost.sortOrder,
  createdAt: sysPost.createdAt,
  updatedAt: sysPost.updatedAt,
} as const;

const sortBy = query.sortBy ?? 'sortOrder';
const orderColumn = postOrderColumns[sortBy];
const order = query.sortOrder === 'desc' ? desc : asc;

const rows = await drizzleDb
  .select()
  .from(sysPost)
  .orderBy(order(orderColumn));
```

不要将请求参数直接用作 `table[sortBy]`，也不要拼接到 SQL 中。动态排序、筛选和投影均应使用固定、类型化的列引用白名单；请求 Schema 只允许白名单中的小驼峰键，并且模型层要覆盖默认值及每个允许值的测试。
