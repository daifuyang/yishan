---
title: 路由设计
---

# 路由设计

核心路由按照 `api/v1` 版本划分，`admin` 下为系统管理模块。插件模块使用 `/api/modules/<module>/v1/*` 前缀。

## 认证模块

`/api/v1/auth`：登录/登出/刷新/当前用户信息。

## 系统管理模块

`/api/v1/admin/users`、`roles`、`menus`、`departments`、`dicts`、`attachments`、`apps` 等。

## 插件模块

门户插件示例：

- `GET /api/modules/portal/v1/admin/articles` 文章列表
- `GET /api/modules/portal/v1/admin/pages` 页面列表
- `GET /api/modules/portal/v1/admin/posts` 岗位列表

以用户模块为例：

- `GET /api/v1/admin/users` 分页列表
- `GET /api/v1/admin/users/:id` 详情（含缓存）
- `POST /api/v1/admin/users` 新增
- `PUT /api/v1/admin/users/:id` 更新（含禁用校验）
- `DELETE /api/v1/admin/users/:id` 软删除并清理缓存

所有接口均通过 `ResponseUtil` 输出统一结构，并基于业务码控制 HTTP 状态码。
