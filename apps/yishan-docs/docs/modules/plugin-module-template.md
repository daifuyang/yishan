---
title: 模块文档模板
---

# 模块文档模板

新增或重写模块文档时，建议按以下结构维护，保证不同模块的信息密度一致。

## 适用范围

说明模块负责什么，不负责什么，是否属于 core 或 plugin。

## 页面入口

- 菜单路径：`/system/example` 或 `/plugins/yishan/example/list`
- 前端页面：`apps/yishan-admin/src/pages/...`
- 前端服务：`apps/yishan-admin/src/services/yishan-admin/...`

## API 与服务

- API 前缀：`/api/v1/admin/...` 或 `/api/modules/<module>/v1/...`
- 后端路由：`apps/yishan-api/src/core/routes/...` 或 `apps/yishan-api/src/plugins/modules/.../routes/...`
- 后端服务：`apps/yishan-api/src/core/services/...` 或插件模块服务

## 权限点

列出页面访问、列表、创建、编辑、删除、导入导出等权限点。

## 数据模型

列出相关 Prisma schema 文件和核心表。

## 关键业务规则

说明不可删除、不可禁用、软删除、唯一性、状态流转、缓存清理等规则。

## 常见问题

记录联调、权限、数据初始化、部署环境差异等问题。
