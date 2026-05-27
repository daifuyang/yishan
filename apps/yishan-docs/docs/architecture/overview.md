---
title: 架构总览
---

# 架构总览

移山采用 monorepo 组织，核心应用如下：

```text
apps/
├─ yishan-admin/                    # Umi Max + Ant Design 的管理后台
├─ yishan-api/                      # Fastify + Prisma 的 API 服务
├─ yishan-docs/                     # Docusaurus 文档站
└─ yishan-components/yishan-tiptap/ # TipTap React 组件库
```

## 分层关系

- `yishan-admin` 负责后台页面、动态菜单渲染、权限拦截与 OpenAPI 服务调用。
- `yishan-api` 负责认证、系统模块、插件模块、OpenAPI/Swagger、静态资源托管与数据持久化。
- `yishan-tiptap` 是 admin 的 workspace 依赖，构建 admin 前应先构建该组件库。
- `yishan-docs` 是团队文档唯一主入口，根目录与应用内 Markdown 作为源码附近说明或历史资料。

## 后端结构现状

后端已经从 Fastify 初始目录演进为 core + plugins 的结构：

```text
apps/yishan-api/src
├─ core/
│  ├─ plugins/      # 核心 Fastify 插件：数据库、JWT、Swagger、错误处理等
│  ├─ routes/       # 核心 API 路由：认证、用户、角色、菜单、系统配置等
│  ├─ schemas/      # TypeBox schema
│  ├─ services/     # 核心领域服务
│  └─ models/       # Prisma 访问封装
├─ plugins-runtime/ # 插件运行时：发现、注册、生命周期、持久化
├─ plugins/modules/ # 业务插件模块，如 portal、hello
├─ config/
├─ constants/
├─ exceptions/
├─ utils/
└─ app.ts
```

## 数据模型

Prisma 使用多文件 schema：

```text
apps/yishan-api/prisma/schema/
├─ base.prisma
├─ system.prisma
├─ app.prisma
└─ portal.prisma
```

生成客户端与迁移命令仍通过 `pnpm --filter yishan-api db:*` 执行。

## 构建顺序

推荐顺序：

1. `pnpm --filter yishan-tiptap build`
2. `pnpm --filter yishan-admin build`
3. `pnpm --filter yishan-api db:generate`
4. `pnpm --filter yishan-api build:ts`
5. `pnpm --filter yishan-api test`

部署到 FC3 时，admin 的 `dist/` 会同步到 `apps/yishan-api/public/admin/`，由 API 服务统一承载。
