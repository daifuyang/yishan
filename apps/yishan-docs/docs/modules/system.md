---
title: 系统管理
---

# 系统管理

通用的系统管理入口与配置项，包括：

- 系统配置项与字典
- 附件管理、本地存储与七牛云配置
- 登录日志
- 应用管理与插件管理
- 定时任务说明与令牌配置（`CRON_TOKEN`）

核心实现位于 `src/core/services/*` 与 `src/core/routes/api/v1/admin/*`。插件管理相关能力还依赖 `src/plugins-runtime` 与插件 manifest。
