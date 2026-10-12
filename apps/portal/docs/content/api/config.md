---
title: 配置说明
---

# 配置说明

产品入口 `apps/demo/api/src/config/index.ts` 读取环境，建立数据库连接参数并调用 `createSystemConfig`。System 的配置工厂位于 `packages/core/system-api/src/config/create.ts`，每次调用产生独立配置快照：

- `JWT_CONFIG`：密钥、访问令牌/刷新令牌过期与记住我参数
- `DATABASE_CONFIG`：System 配置中的数据库参数；实际连接由产品的 `createDatabase` 创建
- `REDIS_CONFIG`：Redis 主机、端口、密码、DB
- `APP_CONFIG`：`NODE_ENV`、`LOG_LEVEL` 等；Demo 监听端口由产品配置读取，默认 3100
- `SECURITY_CONFIG`：密码加密参数、登录失败次数与锁定时间
- `CACHE_CONFIG`：全局缓存 TTL；`CACHE_NAMESPACE` 用于隔离应用的 Redis 键

环境变量样例见 `apps/demo/api/.env.example`。配置 `DATABASE_URL` 或完整的 `DATABASE_HOST` / `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME`，并为各产品设置独立数据库、账号、缓存命名空间与 JWT 密钥。Demo 的 `main.ts` 和数据库 CLI 读取 `.env`；共享包不会自行读取部署环境或建立连接。
