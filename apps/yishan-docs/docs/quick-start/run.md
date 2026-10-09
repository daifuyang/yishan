---
title: 运行与调试
---

# 启动项目

```bash
pnpm install --frozen-lockfile
pnpm build:api
# 在 apps/demo/api 配置 .env，并确认连接环境。
pnpm --filter @yishan/demo-api db:migrate --dry-run
pnpm --filter @yishan/demo-api db:migrate --apply
pnpm db:seed
pnpm dev:api
pnpm --filter yishan-tiptap build
pnpm dev:admin
pnpm dev:app
pnpm dev:docs
```

Demo 默认端口3100；Swagger /api/docs。dev:api 监听 Core 与 Demo 源码，串行构建后重启编译应用，构建失败不切换产物。环境由产品读取，Core import 不连接数据库。

应用启动不会迁移或 seed。旧历史有疑义时先使用 --reconcile-dry-run，只读检查可证实的账本归属，不能通过 reset 清空数据。
