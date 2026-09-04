/**
 * 单一来源：前端 dev 代理到后端 API 的 base URL。
 *
 * 默认 `http://localhost:3100`，与 `apps/yishan-api/.env` 的 `PORT` 对齐。
 * 改默认端口时同步更新两边；dev 期间需要换 host/port 也可设
 * `YISHAN_API_TARGET`（完整 URL，最高优先级）。
 *
 * 不变量：默认值与 `apps/yishan-api/.env` 中 `PORT` 字段保持一致，否则
 * 前端 dev 代理会 502。
 */

/** 与 `apps/yishan-api/.env` 中默认 `PORT` 保持一致。 */
const DEFAULT_API_TARGET = 'http://localhost:3100'

/**
 * 后端 API base URL。前端 dev 代理（admin / app）的 target 统一从这里读。
 */
export const API_TARGET: string = process.env.YISHAN_API_TARGET ?? DEFAULT_API_TARGET
