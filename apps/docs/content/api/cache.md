---
title: 缓存规范
---

# 缓存规范

System 在 packages/core/system-api/src/setup.ts 注册 @fastify/redis，配置来自 createSystemConfig 返回的 REDIS_CONFIG，支持 REDIS_URL 或 REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB。嵌入或测试场景可显式使用 redis: false。

缓存 TTL 由 `CACHE_CONFIG.defaultTTLSeconds` 控制，对应 `CACHE_TTL_DEFAULT`。Redis 键使用实例的 `CACHE_NAMESPACE` 前缀，例如用户详情键为 `<namespace>:user:detail:<id>`。Demo 默认命名空间为 `yishan:demo`；不同产品应使用不同的命名空间。

用户详情读取时先查询缓存，未命中再访问仓储并写入缓存；修改或删除后更新或清理对应键。进程内权限和模块状态缓存同样属于实例，不能让一个应用的权限或启停状态影响另一应用。
