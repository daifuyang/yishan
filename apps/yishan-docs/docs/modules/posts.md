---
title: 岗位管理
---

# 岗位管理

前端入口：`/system/post`（`src/pages/system/post`）

后端路由：`/api/modules/portal/v1/admin/posts/*`

领域说明：当前岗位接口位于 `portal` 插件模块下，页面仍挂载在 `/system/post`。后续如果拆分组织域，应同步迁移接口命名、权限点和文档。

功能点：
- 岗位信息维护
- 与用户/部门的关联

## 列表排序契约

岗位列表支持 `page`、`pageSize`、`keyword`、`status`、`sortBy` 与 `sortOrder`。其中 `sortBy` 只接受 `sortOrder`、`createdAt`、`updatedAt`，默认 `sortOrder`；`sortOrder` 只接受 `asc`、`desc`，默认 `asc`。

`sortOrder` 是 API 的小驼峰字段，模型实现必须通过白名单将其映射为 Drizzle 的 `sysPost.sortOrder` 列引用后再排序；Drizzle 再将其映射至数据库 `sort_order` 列。不能直接按请求字符串读取 Drizzle 表属性。详见[数据库与模型](/docs/api/database#api-字段与-drizzle-字段映射)。
