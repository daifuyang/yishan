---
title: 运行与调试
---

# 运行与调试

## 启动后端（API）

```bash
pnpm i
pnpm --filter yishan-api dev
```

- 默认端口：`3000`（可通过 `.env` 中 `PORT` 修改）
- Swagger 文档：`/api/docs`（JSON：`/api/docs/json`，供前端 OpenAPI 使用）

## 启动前端（Admin）

```bash
pnpm i
pnpm --filter yishan-admin dev
```

- 默认端口：`8000`
- 代理配置：`config/proxy.ts` 将 `/api/` 代理到 `http://localhost:3000`

## 启动文档站点（Docs）

```bash
pnpm i
pnpm --filter yishan-docs start -- --port 4000
```

- 推荐端口：`4000`（避免与后端默认 `3000` 冲突）
