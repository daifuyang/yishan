---
title: OpenAPI 接口生成
---

# OpenAPI 接口生成

前端使用 Umi 的 OpenAPI 插件从后端 Swagger JSON 生成 `src/services/yishan-admin/*`：

- 配置位置：`config/config.ts` 的 `openAPI`，`schemaPath` 指向后端 `http://localhost:3000/api/docs/json`
- 生成命令：`pnpm --filter yishan-admin openapi`
- 请求库：`import { request } from '@umijs/max'`

这样可以保持服务类型与接口定义同步，减少样板代码。
