---
title: 本地开发
---

# 本地开发

## 一次性启动步骤

1. 启动后端：`pnpm --filter yishan-api dev`
2. 启动前端：`pnpm --filter yishan-admin dev`
3. 启动文档：`pnpm --filter yishan-docs start -- --port 4000`

## 联调说明

- 前端通过 `config/proxy.ts` 将 `/api/` 代理到 `http://localhost:3000`
- 后端开放 Swagger 便于联调与查看 schema
