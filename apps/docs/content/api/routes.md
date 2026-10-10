---
title: 路由设计
---

# 路由设计

System 路由按照 `api/v1` 版本划分，`admin` 下为系统管理模块。业务模块默认使用 `/api/<id>/v1/*` 前缀，由显式安装清单中的模块定义决定。

## 认证模块

`/api/v1/auth`：登录/登出/刷新/当前用户信息。

## 系统管理模块

`/api/v1/admin/users`、`roles`、`menus`、`departments`、`positions`、`dicts`、`attachments` 等。

## 插件模块

门户插件示例：

- `GET /api/portal/v1/articles/` 文章列表
- `GET /api/portal/v1/pages/` 页面列表

以用户模块为例：

- `GET /api/v1/admin/users` 分页列表
- `GET /api/v1/admin/users/:id` 详情（含缓存）
- `POST /api/v1/admin/users` 新增
- `PUT /api/v1/admin/users/:id` 更新（含禁用校验）
- `DELETE /api/v1/admin/users/:id` 软删除并清理缓存

所有接口均通过 `ResponseUtil` 输出统一结构，并基于业务码控制 HTTP 状态码。

路由通过公开 `createRouteRegistrar` 声明权限及是否公开访问。受保护接口依次认证、校验权限；公开声明在 OpenAPI 中使用空 `security`。开发模块管理接口仅在 development 环境注册，并且只管理 manifest 中已安装的模块。
