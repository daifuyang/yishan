/**
 * Admin 前端部署配置（结构化）
 *
 * 一次解析 ADMIN_BASE_PATH / ADMIN_MOUNT_MODE / ADMIN_REDIRECT_ROOT，
 * 输出一个模式判别明确的 `mount` 字段，避免调用方各自处理
 * "basePath 是 '/' 要不要重定向"、"默认开还是关"等模糊语义。
 *
 * 设计原则：模式（mode）在边界层确定，内部只判断 mode，不重复路径字符串拼接。
 */

import { join } from 'node:path'

export type AdminMount =
  /** 部署在根路径（与 API 同根）：所有非 /api 请求落到 admin SPA */
  | { mode: 'root' }
  /** 部署在子路径（如 /admin）：仅子路径前缀内的请求落到 admin SPA */
  | { mode: 'subpath'; path: string }

export interface AdminConfig {
  readonly mount: AdminMount
  /** 生产环境是否在根路径触发 301 重定向到 admin 入口；只在 subpath 模式下生效 */
  readonly redirectRoot: boolean
  /** Admin 编译产物的磁盘路径（cwd 相对路径） */
  readonly diskPath: string
}

const envBasePath = process.env.ADMIN_BASE_PATH || '/admin'
const envMode = process.env.ADMIN_MOUNT_MODE

function resolveMount(): AdminMount {
  if (envMode === 'root') return { mode: 'root' }
  const trimmed = envBasePath.trim().replace(/\/+$/g, '')
  if (trimmed === '' || trimmed === '/') return { mode: 'root' }
  return { mode: 'subpath', path: trimmed }
}

export const ADMIN: AdminConfig = {
  mount: resolveMount(),
  redirectRoot: (process.env.ADMIN_REDIRECT_ROOT ?? 'true').toLowerCase() !== 'false',
  diskPath: join(process.cwd(), 'public', 'admin'),
} as const
