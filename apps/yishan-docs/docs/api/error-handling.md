---
title: 错误处理规范
---

# 错误处理规范

全局错误处理由 `src/plugins/external/error-handler.ts` 实现：

- 捕获所有异常并统一输出 `{ success, code, message, data, timestamp }`
- `BusinessError` 按业务码直接返回
- Fastify 内置错误按状态码映射到业务码（如 401→认证错误、404→资源未找到等）
- 数据库与网络错误分别映射到系统错误码

路由层无需重复 try/catch，只需在业务失败时抛出 `BusinessError`。