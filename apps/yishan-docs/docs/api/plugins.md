---
title: 插件与中间件
---

# 插件与中间件

后端通过 Fastify 插件组织跨路由的能力，核心插件如下：

- Swagger 文档：`src/plugins/external/swagger.ts`，UI 前缀为 `/api/docs`，JSON 为 `/api/docs/json`（前端 OpenAPI 生成使用）
- TypeBox 类型提供：`src/plugins/external/typebox.ts`，提供运行时校验与 JSON Schema 生成
- 全局错误处理：`src/plugins/external/error-handler.ts`，统一映射业务码与响应结构
- JWT 鉴权：`src/plugins/external/jwt-auth.ts`，提供 `fastify.authenticate` 与令牌状态校验
- Redis：`src/plugins/external/redis.ts`，支持 `REDIS_URL` 与主机/端口参数，包含测试环境优化
- Sensible：`src/plugins/external/sensible.ts`，通用 HTTP 错误工具
- 密码策略：`src/plugins/app/password-manager.ts`，提供 `passwordManager.hash/compare` 基于 scrypt

结合这些插件，系统提供了统一的类型、鉴权、错误处理、缓存与文档能力。