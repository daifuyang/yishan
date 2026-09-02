---
title: 运行与调试
---

# 运行与调试

## 启动后端（API）

```bash
# 1. 确保通用基础设施已起
docker compose -f infra/local-dev-stack.yml up -d

# 2. 启动 API（默认 3000，可通过 .env 的 PORT=3100 调整）
pnpm --filter yishan-api dev
```

- 默认端口：`3000`（可在 `apps/yishan-api/.env` 中通过 `PORT` 调整）
- Swagger 文档：`/api/docs`（JSON：`/api/docs/json`，供前端 `pnpm openapi` 生成客户端使用）
- 健康检查：`/api/health`

### Windows 提示

`pnpm dev` 会先跑 `npm run build:ts`，里面的 `rm -rf dist` 在 Windows PowerShell 下不存在。两种解决方式：

1. **推荐**：使用 Git Bash / WSL 运行 `pnpm dev`。
2. **PowerShell 用户**：手动跑构建步骤

   ```powershell
   # 等价于 pnpm dev 里的预处理
   node -e "fs.rmSync('apps/yishan-api/dist',{recursive:true,force:true})"
   cd apps/yishan-api; node scripts/gen-module-tsconfig.mjs
   npx tsc -p tsconfig.build.json
   npx tsc-alias -p tsconfig.build.json
   # 然后跑 fastify：
   $env:NODE_ENV='development'
   npx fastify start --ignore-watch='public/**' --ignore-watch=.ts$ -w -l info -P dist/app.js
   ```

## 启动前端（Admin）

```bash
pnpm --filter yishan-admin dev
```

- 默认端口：`8000`，可用 `PORT=8100 pnpm --filter yishan-admin dev` 改到 8100
- 代理配置：`config/proxy.ts` 将 `/api/` 代理到 `http://localhost:3100`（如果你后端改了端口，这里也要同步）

### Windows 提示

Umi Max / Mako 在 Windows 下需要 Node ≥ 20，推荐 Node 22 LTS。如果遇到 `gyp ERR! find Python` 之类的依赖编译错，先确认 Node 版本。

## 启动文档站点（Docs）

```bash
pnpm --filter yishan-docs start -- --port 4000
```

- 推荐端口：`4000`（避免与后端 `3000` / `3100` 冲突）

## 一键启动脚本

可以把以下片段保存为 `scripts/dev-up.sh`（macOS / Linux）或 `scripts/dev-up.ps1`（Windows）：

```bash
#!/usr/bin/env bash
# scripts/dev-up.sh
set -e
cd "$(dirname "$0")/.."

docker compose -f infra/local-dev-stack.yml up -d

# yishan 数据库首次
docker exec mysql-local mysql -uroot -pdev-root-only-do-not-use-in-prod \
  -e "CREATE DATABASE IF NOT EXISTS yishan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
node scripts/apply-drizzle-sql.mjs apps/yishan-api/drizzle/0000_init.sql
cd apps/yishan-api && pnpm build:ts && SKIP_DRIZZLE_MIGRATE=1 node dist/scripts/seed/index.js
cd ../..

pnpm --filter yishan-tiptap build

(cd apps/yishan-api && npx fastify start -w -l info -P dist/app.js) &
(cd apps/yishan-admin && PORT=8100 npm run start:dev) &
wait
```

## Windows 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| `rm is not recognized` | `npm run build:ts` 用 `rm -rf dist` | 用 Git Bash 跑；或手动 `node -e "fs.rmSync('dist',{recursive:true,force:true})"` |
| `drizzle-kit migrate` 静默 exit 1 | meta 缺失 + 已知 bug | 用 `SKIP_DRIZZLE_MIGRATE=1` 跳过 |
| `spawn ENOENT` `node_modules/.bin/drizzle-kit` | Windows 下 `.bin/` 是 shell wrapper | win32 已自动用 `.CMD` + `shell:true`；源码已修 |
| `PROTOCOL_CONNECTION_LOST`（mysql2） | docker port forward + mysql `--bind-address=127.0.0.1` + mysql2 边界 bug | **不要给 mysql 加 `--bind-address`**，用 `infra/local-dev-stack.yml` 默认配置即可 |
| `ECONNREFUSED 127.0.0.1:6380`（Redis） | 端口写错，yishan 默认接 6379 | 检查 `.env` 中 `REDIS_PORT=6379` |
| `EADDRINUSE :::3100` | 上次进程残留 | `Get-NetTCPConnection -LocalPort 3100` 找 PID → `Stop-Process -Id <pid>` |
| `localhost` 解析到 IPv6 `::1` 失败 | Windows 默认行为 | `.env` 与 `proxy.ts` 统一用 `127.0.0.1` |