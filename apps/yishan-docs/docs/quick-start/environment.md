---
title: 环境准备
---

# 环境准备

为保证前后端顺利运行，请准备以下环境：

- Node.js ≥ 20（推荐 22，前端 `yishan-admin` 要求）
- 包管理器：`pnpm`（≥ 8）
- MySQL 8.x（用于后端数据库）
- Redis（可选，用于缓存与限流）

## 安装依赖（工作空间）

在项目根执行一次依赖安装：

```bash
pnpm install    # 或 pnpm i
```

如需仅安装某个子项目依赖：

```bash
pnpm --filter yishan-api i
pnpm --filter yishan-admin i
pnpm --filter yishan-docs i
```

## 数据库 / 缓存

仓库自带 `infra/local-dev-stack.yml`（机器级通用基础设施），统一管理本机的 `mysql-local` / `redis-local` / `postgres-local` 三个容器名。**任何项目都可复用同一个基础设施容器，靠独立的 database / user / redis db 编号做隔离**。

### 推荐：使用通用 `*-local` 容器

```bash
docker compose -f infra/local-dev-stack.yml up -d
docker compose -f infra/local-dev-stack.yml ps      # 查看状态
```

启动后会在本机监听：

| 容器 | 端口 | 用途 | 默认账号 |
|---|---|---|---|
| `mysql-local` | 127.0.0.1:3306 | MySQL 8.4 | `root` / `dev-root-only-do-not-use-in-prod` |
| `redis-local` | 127.0.0.1:6379 | Redis 7.4（无密码） | — |
| `postgres-local` | 127.0.0.1:5432 | PostgreSQL 17（备用） | `postgres` / `dev-postgres-only` |

数据落在 docker named volume：`mysql-local-data` / `redis-local-data` / `postgres-local-data`。

### yishan 项目的库 / 表准备

```bash
# 1. 建库
docker exec mysql-local mysql -uroot -pdev-root-only-do-not-use-in-prod \
  -e "CREATE DATABASE IF NOT EXISTS yishan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. 灌入 schema（30+ 张表、220+ 索引）
node scripts/apply-drizzle-sql.mjs apps/yishan-api/drizzle/0000_init.sql

# 3. 灌种子数据（admin 用户、省市区 3429 条、demo 模块）
cd apps/yishan-api
pnpm build:ts                                          # 编译 dist/
SKIP_DRIZZLE_MIGRATE=1 node dist/scripts/seed/index.js # 跳过 drizzle-kit migrate（详见下方）
```

> **为什么用 `SKIP_DRIZZLE_MIGRATE=1`？** 因为 `drizzle-kit migrate` 在 Windows + 部分 Linux 环境下存在 [已知 bug：meta 缺失时静默 exit 1](https://github.com/drizzle-team/drizzle-orm/issues/5816)。我们已经把 schema 通过 `scripts/apply-drizzle-sql.mjs` 直接灌入 DB，不需要 drizzle-kit 再做一次。生产环境部署脚本会走完整 drizzle-kit 流程，不受此开关影响。

完成后默认管理员账号：`admin` / `admin123`（dev 环境默认值，生产环境必须通过 `SEED_ADMIN_PASSWORD` 设置）。

### 替代方案：自带 MySQL / Redis

如果不希望复用通用容器，你也可以自己装 MySQL 8 和 Redis，仅需满足：

- MySQL 可用，并创建库 `yishan`（字符集 `utf8mb4` / 排序规则 `utf8mb4_unicode_ci`）
- 修改 `apps/yishan-api/.env` 中的 `DATABASE_URL` / `REDIS_URL` / `REDIS_HOST` 等字段

## 后端（yishan-api）环境

1. 初始化环境配置：

   ```bash
   cd apps/yishan-api
   cp .env.example .env
   ```

   关键字段：

   - `PORT=3100`（建议，避免与默认 `3000` 冲突）
   - `DATABASE_HOST=127.0.0.1`
   - `DATABASE_URL=mysql://root:dev-root-only-do-not-use-in-prod@127.0.0.1:3306/yishan`
   - `REDIS_HOST=127.0.0.1`、`REDIS_PORT=6379`

   :::tip 为什么用 `127.0.0.1` 而不是 `localhost`？
   Windows 下 `localhost` 默认走 IPv6（`::1`），可能与 docker port forwarding 在某些边界场景下产生兼容问题（表现为 mysql2 客户端 `Connection lost`）。统一写 `127.0.0.1` 更稳。
   :::

2. 不要在 `infra/local-dev-stack.yml` 里给 MySQL 加 `--bind-address=127.0.0.1`。Docker port forwarding + mysql 仅 loopback 监听 + mysql2 客户端组合下，会出现 `PROTOCOL_CONNECTION_LOST`，但 `docker exec mysql ...` 命令行却能连通的诡异问题**。让 mysqld 默认绑 IPv6（`::`，自动双栈接收 IPv4）即可。

## 前端（yishan-admin）环境

1. 默认代理指向 `http://localhost:3100`，配置位于 `config/proxy.ts`。
2. 默认端口 `8000`，可通过环境变量 `PORT=8100 npm run start:dev` 修改。

## 文档站点（yishan-docs）环境

```bash
pnpm --filter yishan-docs start -- --port 4000
```