---
id: faq
title: 常见问题
---

# 常见问题

- 登录失败？检查后端 `.env` 的 `JWT_SECRET`、数据库连接与用户初始化
- 刷新令牌失败？确认刷新令牌未过期且前端未拦截 `/auth/refresh`
- 前端接口 404？检查 `config/proxy.ts` 代理与后端 `PORT`
- Redis 报错？测试环境允许延迟连接，可暂时禁用或正确设置 `REDIS_URL`