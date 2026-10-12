---
title: 系统管理
---

# 系统管理

通用的系统管理入口与配置项，包括：

- 系统配置项与字典
- 附件管理、本地存储与七牛云配置
- 登录日志
- 已安装业务模块的启停管理（开发环境）
- 定时任务说明与令牌配置（`CRON_TOKEN`）

系统服务与路由位于 `packages/core/system-api/src/core/services/*` 和 `packages/core/system-api/src/core/routes/api/v1/admin/*`。Demo 在 `apps/demo/api/src/dev/module-administration.ts` 显式注册开发模块管理路由，通过 System 公开管理接口操作安装状态；列表来自 `src/manifest.ts`，不扫描磁盘发现模块。
