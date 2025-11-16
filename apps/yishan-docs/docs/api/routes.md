---
title: 路由设计
---

# 路由设计

路由按照 `api/v1` 版本划分，`admin` 下为系统管理模块。

## 认证模块

`/api/v1/auth`：登录/登出/刷新/当前用户信息。

## 系统管理模块

`/api/v1/admin/users`、`roles`、`menus`、`departments`、`posts` 等。

以用户模块为例：

- `GET /api/v1/admin/users` 分页列表
- `GET /api/v1/admin/users/:id` 详情（含缓存）
- `POST /api/v1/admin/users` 新增
- `PUT /api/v1/admin/users/:id` 更新（含禁用校验）
- `DELETE /api/v1/admin/users/:id` 软删除并清理缓存

所有接口均通过 `ResponseUtil` 输出统一结构，并基于业务码控制 HTTP 状态码。