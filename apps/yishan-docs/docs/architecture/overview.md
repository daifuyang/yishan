---
title: 架构总览
---

# 架构总览

项目采用 pnpm monorepo，产品 API 与共享后端包分离：

~~~text
apps/
  demo/api/                       Fastify Demo 产品 API
  yishan-admin/                   Umi Max / React 19 管理后台
  yishan-app/                     小程序
  yishan-docs/                    Docusaurus 文档站
  yishan-components/yishan-tiptap/ 共享编辑器
packages/core/
  contracts/                      平台无关契约类型
  api/                            Fastify 工厂、模块生命周期、公共插件
  database/                       MySQL 连接、事务、迁移执行
  system-api/                     系统身份、RBAC、sys_* 表和系统路由
~~~

## 产品装配

Demo 的 main.ts 负责读取环境、监听与退出；app.ts 创建 Database 和 System runtime，并把 manifest.ts 的显式清单交给 createYishanApi。默认安装 demo、portal、shop，CRM 源码保留但默认不安装。Core 不导入应用或业务模块，也不通过目录扫描安装模块。

System 保留 `/api/v1/...` 等现有路径；业务模块默认使用 `/api/<id>/v1/...`。模块内部按 routes → services → repositories → db/schema 分层，仓储独占 SQL 查询。业务模块不能读取 `sys_*` 或其他模块的表；用户身份与扩展通过 System 的公开能力获取。

## 数据和实例边界

MySQL schema 与查询使用 Drizzle。System 拥有 `sys_*` 表，各模块拥有 `<id>_` 表，产品用户资料使用独立扩展表。发布的 SQL 和 journal 保留历史字节、时间和账本归属；迁移必须显式执行，应用启动不迁移也不 seed。

数据库连接、配置、权限目录、模块缓存和扩展监听属于应用实例。公开包的 import 不连接数据库、不启动服务。新增产品建立自己的 config/app/manifest 和独立数据库配置，通过公开 exports 组合 Core。

## 构建和发布

从根目录运行 pnpm build:api，按依赖顺序构建四个 Core 包和 Demo；pnpm dev:api 监听这些包的源码，成功构建后重启 Demo。

前端构建前先构建 yishan-tiptap。pnpm build 包含 API、编辑器、Admin 和文档站。生产 API 使用 scripts/package-api.mjs 收集完整运行依赖并验证独立启动；FC3 同站部署把 Admin dist 放入产物 public/admin，不使用运行时 Layer，也不自动应用迁移。
