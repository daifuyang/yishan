---
title: 前端列表规范
---

# 前端列表规范

本项目在列表页的数据与分页处理上采用统一规范，核心要点：

- 参数：`page`、`pageSize`，排序：`sortBy`、`sortOrder`
- 响应：严格依赖 `success` 字段判断成功与否
- 列表数据：统一返回 `data: T[]`，分页信息位于 `pagination`
- ProTable 的 `request` 统一处理响应并返回 `{ data, success, total }`

示例与最佳实践详见源码文档：`apps/yishan-admin/docs/LIST_SPECIFICATION.md`