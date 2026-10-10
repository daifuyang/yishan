---
title: 工作空间与脚本
---

# Workspace

pnpm workspace 包含 Demo 产品的 `apps/demo/{api,admin,config}`、配套 App、文档站、共享编辑器与 `packages/core/{api,system-api,database,contracts,admin,system-admin}`。Demo 配置由 `@yishan/demo-config` 提供，其他产品独立拥有自己的配置。

公开包名为 @yishan/demo-api、@yishan/core-api、@yishan/core-system-api、@yishan/core-database、@yishan/core-contracts。包内相对导入，跨包通过 exports 与 workspace:* 依赖。

新产品可以建立 apps/crm/api 或 apps/axis/api，提供独立环境、数据库/JWT/Redis namespace 和 manifest，以公开工厂组合同一 Core，不复制框架代码。不要提前创建空应用，不将业务 UI 或模块提升成通用包。
