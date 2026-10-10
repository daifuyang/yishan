---
title: 目录结构
---

# 目录结构

API 使用 Product-First Monorepo。产品与共享框架真实分离：

```text
apps/demo/api/src/
  main.ts       环境、启动、退出
  app.ts        资源创建与公开 Package API 组合
  manifest.ts   显式安装清单
  config/       实例配置
  modules/      demo / portal / shop / crm
  extensions/   产品用户资料独立表与生命周期监听
packages/core/
  contracts/    纯公共类型
  database/     连接工厂与迁移执行
  api/          Fastify、模块生命周期和公共插件
  system-api/   系统身份、RBAC、sys_* 表及系统路由
```

Module routes → services → repositories → db/schema。模块只查询自己的表；通过公开用户目录取得系统身份。跨包仅使用正式 exports。没有自动应用目录扫描或旧兼容入口。详细规范在仓库 `docs/architecture/`。
