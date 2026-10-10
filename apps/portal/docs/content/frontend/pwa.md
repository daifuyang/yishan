---
title: PWA 与 Service Worker
---

# PWA 与 Service Worker

项目内置 PWA 支持：

- `src/global.tsx` 监听 `sw.offline` 与 `sw.updated`，提供离线提示与更新刷新
- `src/service-worker.js` 使用 Workbox 的预缓存与运行时缓存策略，代理 `/api/` 请求为 `networkFirst`

默认 `pwa` 开关来自 `config/defaultSettings.ts`。生产环境建议开启 HTTPS 并根据业务调整缓存策略。