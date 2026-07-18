---
title: 前端列表规范
---

# 前端列表规范

本项目在列表页的数据与分页处理上采用统一规范，核心要点：

- 参数：`page`、`pageSize`，排序：`sortBy`、`sortOrder`
- 响应：严格依赖 `success` 字段判断成功与否
- 列表数据：统一返回 `data: T[]`，分页信息位于 `pagination`
- ProTable 的 `request` 统一处理响应并返回 `{ data, success, total }`
- 操作列统一固定在右侧，使用 `<Space size={16}>` 排布链接；宽度按操作文本、间距及安全留白计算，具体公式见源码规范的“操作列规范”。

示例与最佳实践详见源码文档：[LIST_SPECIFICATION.md](https://github.com/zerocmf/yishan/blob/main/apps/yishan-admin/docs/LIST_SPECIFICATION.md)
