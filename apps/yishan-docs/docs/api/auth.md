---
title: 认证与授权
---

# 认证与授权

后端使用 JWT 进行认证，并在数据库中维护令牌状态以支持注销与失效控制。

## JWT 插件

`src/plugins/external/jwt-auth.ts` 注册 JWT，并提供 `fastify.authenticate` 作为路由前置校验：

- 校验 `Authorization: Bearer <token>` 头格式与签名
- 仅允许 `access_token` 类型访问接口
- 校验令牌是否在数据库中有效
- 将当前用户挂载到 `request.currentUser`

## 认证接口

- `POST /api/v1/auth/login` 登录，返回访问令牌与刷新令牌
- `POST /api/v1/auth/logout` 登出，撤销令牌
- `GET /api/v1/auth/me` 获取当前用户信息与 `accessPath`
- `POST /api/v1/auth/refresh` 使用刷新令牌换取新的访问令牌

前端在 401 时自动刷新令牌，失败则注销，详见“前端 · 认证与安全”。