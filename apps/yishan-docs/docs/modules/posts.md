---
title: 岗位管理
---

# 岗位管理

前端入口：`/system/position`（`src/pages/system/position`）

后端路由：`/api/v1/admin/positions/*`

岗位属于 System 组织管理能力，接口位于 `packages/core/system-api`，不依赖 Portal 模块。

功能点：
- 岗位信息维护
- 与用户/部门的关联

## 列表排序契约

岗位列表支持 `page`、`pageSize`、`keyword`、`status`、`sortBy` 与 `sortOrder`。其中 `sortBy` 只接受 `sortOrder`、`createdAt`、`updatedAt`，默认 `sortOrder`；`sortOrder` 只接受 `asc`、`desc`，默认 `asc`。

`sortOrder` 是查询参数中的小驼峰字段，仓储通过白名单将其映射为 `sysPost.sortOrder` 列引用，Drizzle 再映射至数据库 `sort_order` 列。岗位模型使用 Position 命名，数据库仍保留历史表名 `sys_post`。不能直接按请求字符串读取 Drizzle 表属性。详见[数据库与模型](/docs/api/database)。
