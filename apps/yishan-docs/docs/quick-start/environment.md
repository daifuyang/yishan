---
title: 环境准备
---

# 环境准备

使用仓库 .tool-versions 固定的 Node 22.22.1 和 packageManager 固定的 pnpm 8.15.9。数据库使用 MySQL 8.x，缓存使用 Redis。

## 安装工作区依赖

~~~bash
corepack enable
corepack prepare pnpm@8.15.9 --activate
pnpm install --frozen-lockfile
~~~

## 本地数据库与缓存

仓库 infra/local-dev-stack.yml 提供共享的 mysql-local、redis-local、postgres-local 容器。产品用独立数据库、数据库账号和 Redis 命名空间隔离资源。

~~~bash
docker compose -f infra/local-dev-stack.yml up -d
docker compose -f infra/local-dev-stack.yml ps
~~~

| 容器 | 地址 | 默认本地凭据 |
|---|---|---|
| mysql-local | 127.0.0.1:3306 | root / dev-root-only-do-not-use-in-prod |
| redis-local | 127.0.0.1:6379 | 无密码 |
| postgres-local | 127.0.0.1:5432 | postgres / dev-postgres-only；API 当前不使用 |

开发环境可以先创建 Demo 数据库：

~~~bash
docker exec mysql-local mysql -uroot -pdev-root-only-do-not-use-in-prod \
  -e "CREATE DATABASE IF NOT EXISTS yishan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
~~~

## Demo API 配置与初始化

复制 apps/demo/api/.env.example 为同目录 .env，然后修改连接参数：

~~~dotenv
NODE_ENV=development
PORT=3100
DATABASE_URL=mysql://root:dev-root-only-do-not-use-in-prod@127.0.0.1:3306/yishan
REDIS_URL=redis://127.0.0.1:6379/0
CACHE_NAMESPACE=yishan:demo
JWT_SECRET=replace-with-a-long-random-secret
~~~

DATABASE_URL 优先于 DATABASE_HOST 等分项参数。REDIS_URL 优先于 Redis 分项参数；示例配置含占位密码，连接无密码本地 Redis 时应替换为上面的 URL。使用 127.0.0.1 可避免 localhost 解析到 IPv6 时的端口转发差异。

从仓库根目录构建并执行安装清单的迁移与 seed：

~~~bash
pnpm build:api
pnpm check:migrations
pnpm db:migrate --dry-run
pnpm db:migrate --apply
pnpm db:seed
pnpm dev:api
~~~

迁移按已发布 SQL/journal 执行，启动不会自动迁移或 seed。不要使用手工灌入 SQL、跳过迁移开关或 reset 来替代迁移账本。旧共享历史应先运行 pnpm db:migrate --reconcile-dry-run 审查，再决定是否显式迁移历史记录。

开发环境管理员默认 admin / admin123；生产 seed 必须显式配置 ALLOW_PRODUCTION_SEED=true 和 SEED_ADMIN_PASSWORD。每个产品应使用独立数据库账号及强随机 JWT 密钥。

## Admin 与文档站

Admin 默认端口8000，`config/proxy.ts` 把 API 代理到 `http://localhost:3100`。从根目录执行 `pnpm dev:admin`；需要自定义端口时在环境中设置 `PORT` 后运行 `pnpm --filter yishan-admin start:dev`。

文档站默认端口4000，执行 `pnpm dev:docs`。API 启动后的 Swagger 位于 `http://127.0.0.1:3100/api/docs`。
