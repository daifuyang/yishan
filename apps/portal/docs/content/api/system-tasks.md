---
title: 定时任务接口
---

# 定时任务接口

系统管理路由提供运维接口：`/api/v1/system/*`。

## 清理过期令牌

- `POST /api/v1/system/cleanup-tokens`
- Body：`{ cron_token: string, days_to_keep?: number }`
- 鉴权：对比环境变量 `CRON_TOKEN`
- 说明：清理超过 `days_to_keep` 天的过期/撤销令牌，保障安全与性能

## 令牌统计信息

- `GET /api/v1/system/token-stats`
- 返回：令牌总数、活跃数、过期数等统计

请在生产环境设置安全的 `CRON_TOKEN`，并将任务接入你的定时平台。