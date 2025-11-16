---
title: 配置说明
---

# 配置说明

集中配置位于 `src/config/index.ts`：

- `JWT_CONFIG`：密钥、访问令牌/刷新令牌过期与记住我参数
- `DATABASE_CONFIG`：数据库连接字符串
- `REDIS_CONFIG`：Redis 主机、端口、密码、DB
- `APP_CONFIG`：`NODE_ENV`、`PORT`、`LOG_LEVEL`
- `SECURITY_CONFIG`：密码加密参数、登录失败次数与锁定时间
- `CACHE_CONFIG`：全局 TTL 与用户详情缓存 TTL（兼容旧环境变量）

环境变量样例见 `.env.example`，生产环境务必使用强随机的 `JWT_SECRET` 与安全的数据库/Redis 连接。