---
title: 缓存规范
---

# 缓存规范

系统可选接入 Redis 作为缓存层：

- 插件：`src/plugins/external/redis.ts`，支持 `REDIS_URL` 或主机/端口配置
- TTL：在 `src/config/index.ts` 的 `CACHE_CONFIG` 中集中控制（如用户详情）
- 缓存键约定：统一字符串前缀，如 `user:detail:${id}`

用户详情示例：

- 读取缓存命中直接返回
- 缓存未命中查询数据库并写入缓存（`setex` 带 TTL）
- 更新/删除后刷新或清理对应缓存键

测试环境对 Redis 有更宽松的连接策略，避免影响测试执行。