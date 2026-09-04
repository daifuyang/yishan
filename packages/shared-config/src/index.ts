/**
 * 单一来源：前端 dev 代理到后端 API 的 base URL。
 *
 * 解析顺序（高 → 低优先级）：
 *   1. `YISHAN_API_TARGET` 直接给出完整 URL（跨域/容器/外网/反向代理场景）
 *   2. `YISHAN_API_PORT` 覆盖默认端口（仅改端口时用）
 *   3. 默认 `http://localhost:3100`，与 `apps/yishan-api/.env` 的 `PORT` 对齐
 *
 * 不变量：与 `apps/yishan-api/.env` 中 `PORT` 字段保持一致，否则前端
 * dev 代理会 502。改 API 端口时只需更新 `apps/yishan-api/.env` 和本文件
 * 默认值（或显式设 `YISHAN_API_PORT`）。
 */

/** 与 `apps/yishan-api/.env` 中默认 `PORT` 保持一致。 */
const DEFAULT_API_PORT = 3100

/**
 * 后端 API base URL。前端 dev 代理（admin / app）的 target 统一从这里读。
 */
export const API_TARGET: string =
  process.env.YISHAN_API_TARGET
  ?? `http://localhost:${process.env.YISHAN_API_PORT ?? String(DEFAULT_API_PORT)}`
