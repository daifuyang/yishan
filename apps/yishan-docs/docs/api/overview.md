---
title: 后端概览
---

# 后端概览

Demo API 采用 Fastify 5、TypeScript、MySQL 与 Drizzle，通过公开包接口组合数据库、系统身份及业务模块。

## 模块与插件

- `packages/core/api`：Fastify 工厂、模块依赖排序、生命周期、权限目录、启停 gate 与通用插件。
- `packages/core/system-api`：用户、角色、菜单、部门、字典、JWT/PAT、RBAC 和 `sys_*` 表。
- `packages/core/database`：连接、事务、关闭和迁移执行；不拥有业务表。
- `packages/core/contracts`：与平台无关的模块及扩展契约类型。
- `apps/demo/api/src/manifest.ts`：显式安装 demo、portal、shop；CRM 源码保留但默认不安装。

System 保留 `/api/v1/auth`、`/api/v1/admin/*` 等 URL。业务模块默认使用 `/api/<id>/v1/*`，内部按 routes → services → repositories → db/schema 组织。模块可以加载自己的路由目录；Core 不扫描业务模块目录。
