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
