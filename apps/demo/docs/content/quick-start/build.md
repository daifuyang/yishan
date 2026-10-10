---
title: 构建与发布
---

# 构建与验证

使用 .tool-versions 固定的 Node22.22.1 与 pnpm8.15.9。

```bash
pnpm install --frozen-lockfile
pnpm build:api
pnpm typecheck:api
pnpm test:api
pnpm test:integration
pnpm check:boundaries
pnpm check:migrations
pnpm check:openapi
pnpm test:scripts
pnpm build
```

API 拓扑构建四个 Core 包与 Demo，输出 CommonJS 和类型声明，复制 JSON/SQL/journal。root build 保持共享编辑器、Admin、文档站构建，并包含 API。真实数据库测试只创建 loopback MySQL 随机临时 schema，连接失败直接失败。

独立生产包用 node scripts/package-api.mjs --output `<directory>`；验证所有运行依赖、exports、资源和外部目录启动。FC3 使用 dist/main.js，部署不自动迁移数据库。
