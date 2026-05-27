---
title: 生产部署
---

# 生产部署

## 当前生产模式

当前生产部署以 FC3 为主：先构建 `yishan-tiptap`，再构建 `yishan-admin`，将 admin 的 `dist/` 同步到 `apps/yishan-api/public/admin/`，最后构建并部署 `yishan-api`。

## 后端（API）

- 设置安全的环境变量：`JWT_SECRET`、数据库/Redis 连接、`PORT`
- FC3 入口位于 `apps/yishan-api/deploy/fc3`，运行时通过 `node ./server.js` 启动编译后的服务
- 开启必要的日志与监控

## 前端（Admin）

- 构建产物 `dist/` 会同步到 `apps/yishan-api/public/admin/`
- API 通过静态资源插件统一承载 `/admin/` 下的后台页面

## 安全建议

- 强制 HTTPS
- 限制管理接口的来源与速率
