---
title: 构建与发布
---

# 构建与发布

## 构建前端（Admin）

```bash
pnpm --filter yishan-admin build
```

- 构建产物输出到 `dist/`
- 本地预览：
  ```bash
  pnpm --filter yishan-admin preview # 默认端口 8000
  ```

### 同步接口定义（可选）

构建前建议同步最新接口定义以保证类型一致：

```bash
pnpm --filter yishan-admin openapi # 从 /api/docs/json 生成服务定义
```

## 构建并启动后端（API）

```bash
pnpm --filter yishan-api start # 自动构建 TypeScript 并启动 Fastify
```

- 亦可单独构建：`pnpm --filter yishan-api build:ts`，然后使用 `fastify start` 启动 `dist/app.js`

## 注意事项

- 生产环境请设置安全的 `JWT_SECRET`，并将数据库、Redis 等连接指向生产实例
- 前端部署时请将 `/api/` 代理指向生产 API 地址，或在 API 层启用 CORS