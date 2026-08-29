/**
 * 存储配置（结构化）
 *
 * 把 UPLOAD_DIR 环境变量一次性解析成"调用方直接可用的字段"，
 * 避免业务代码各自重做字符串规整、slash 处理、public/ 前缀剥离等推断。
 *
 * 设计原则：字符串配置 → 在边界层转化为结构化对象 → 内部调用方只读字段。
 */

import { join } from 'node:path'

export interface StorageConfig {
  /** 用户传入的原始字符串（已统一用正斜杠、去首斜杠） */
  readonly raw: string
  /** 是否以 `public/` 开头 —— 是则公开 serve，否则视为私有目录 */
  readonly isPublic: boolean
  /** 磁盘绝对路径（join(cwd, normalized)） */
  readonly diskRoot: string
  /** HTTP URL 前缀（带前导 `/` 与尾随 `/`） */
  readonly urlPrefix: string
}

function normalize(raw: string): { normalized: string; isPublic: boolean } {
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '')
  const isPublic = normalized.startsWith('public/') || normalized === 'public'
  return { normalized, isPublic }
}

const envValue = process.env.UPLOAD_DIR || 'public/uploads'
const { normalized, isPublic } = normalize(envValue)

/**
 * 规整后的 disk root：
 * - 若原始已经是 `public/uploads` 或 `uploads`，等价表达都映射到 `cwd/public/uploads`
 * - 业务侧写文件时直接 `STORAGE.diskRoot`，无需再 join
 */
const diskRootRelative = normalized === 'public' ? 'public' : (isPublic ? normalized : `public/${normalized}`)

/**
 * URL 前缀：
 * - 公开目录 (`public/...`) → 去掉 `public/` 这一段，剩下的就是 URL prefix
 *   例：`public/uploads` → `/uploads/`、`public/static/img` → `/static/img/`
 * - 非公开目录（如业务想放私有 uploads）→ 走业务自己提供的 URL 反代，本框架不挂
 *   例：UPLOAD_DIR=`private/uploads` → isPublic=false，urlPrefix 为空，业务自己处理
 */
function buildUrlPrefix(normalized: string, isPublic: boolean): string {
  if (!isPublic) return ''
  const tail = normalized === 'public' ? '' : normalized.slice('public/'.length)
  const trimmed = tail.replace(/\/+$/, '')
  return trimmed === '' ? '/' : `/${trimmed}/`
}

export const STORAGE: StorageConfig = {
  raw: normalized,
  isPublic,
  diskRoot: join(process.cwd(), diskRootRelative),
  urlPrefix: buildUrlPrefix(normalized, isPublic),
} as const
