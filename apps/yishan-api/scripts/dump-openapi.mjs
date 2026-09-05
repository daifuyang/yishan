#!/usr/bin/env node
/**
 * dump-openapi.mjs — 把运行中的 yishan-api 的 OpenAPI spec 写到仓库里。
 *
 * 用法：
 *   pnpm --filter yishan-api openapi:dump
 *   node scripts/dump-openapi.mjs                         # 默认 base + 默认输出
 *   node scripts/dump-openapi.mjs http://localhost:3200
 *   node scripts/dump-openapi.mjs http://x:3100 ./openapi.json
 *
 * 默认输出：apps/yishan-api/openapi.json（相对仓库根目录）
 *
 * 服务起来后跑一次（dev / CI / 本地任一种启动方式都行），生成的 spec
 * 跟运行时 /api/docs/json 一一对应，供：
 *   - 仓库内的 openapi.json 同步（避免 spec 漂移 —— 2026-09-05 发现 committed
 *     文件落后 live 49 paths，全是 CRM/demo/shop/portal 等模块端点）
 *   - restish 等 OpenAPI-aware 客户端的离线 --spec 源
 *   - 前端 `pnpm --filter yishan-admin openapi` 从这里再生成 TS 客户端
 *
 * 服务没起来时给清晰报错信息；写文件之前先验证 spec 形状，避免把 HTML 错误页写到 spec 里。
 */

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// apps/yishan-api/scripts/dump-openapi.mjs → 仓库根 = 上三级（scripts → yishan-api → apps → repo root）
const REPO_ROOT = resolve(__dirname, '../../..')

const argv = process.argv.slice(2)
const baseUrl = (argv[0] ?? 'http://127.0.0.1:3100').replace(/\/+$/, '')
const outPath = resolve(REPO_ROOT, argv[1] ?? 'apps/yishan-api/openapi.json')

function die(msg, code = 1) {
  console.error(`[dump-openapi] ${msg}`)
  process.exit(code)
}

console.log(`[dump-openapi] GET ${baseUrl}/api/docs/json → ${outPath}`)

let res
try {
  res = await fetch(`${baseUrl}/api/docs/json`, {
    signal: AbortSignal.timeout(10_000),
  })
} catch (err) {
  die(
    `无法访问 ${baseUrl}/api/docs/json —— yishan-api 是否在跑？\n` +
      `  错误: ${err instanceof Error ? err.message : String(err)}`,
  )
}

if (!res.ok) {
  die(`GET /api/docs/json 返回 ${res.status} ${res.statusText}`)
}

const raw = await res.text()

let spec
try {
  spec = JSON.parse(raw)
} catch {
  die(
    `响应不是合法 JSON —— 也许 API 还没完全启动？\n` +
      `  前 200 字符: ${raw.slice(0, 200)}`,
  )
}

// 基本形状校验，避免把 HTML 错误页 / 半成品响应写进 openapi.json
if (!spec.openapi || !spec.paths || typeof spec.paths !== 'object') {
  die(`响应缺少 openapi / paths 字段 —— 不是 OpenAPI 3 文档？`)
}

// 按 tag 统计 path 数（用于打印 summary）
const tags = new Map()
for (const path of Object.keys(spec.paths)) {
  for (const method of Object.keys(spec.paths[path])) {
    const op = spec.paths[path][method]
    if (!op || typeof op !== 'object') continue
    const tag = Array.isArray(op.tags) && op.tags[0] ? op.tags[0] : '(untagged)'
    tags.set(tag, (tags.get(tag) ?? 0) + 1)
  }
}

// 不格式化：committed openapi.json 历史上是单行紧凑格式，保持一致以减小 diff
writeFileSync(outPath, JSON.stringify(spec), 'utf8')

const totalPaths = Object.keys(spec.paths).length
console.log(`[dump-openapi] OK — ${totalPaths} paths, ${(raw.length / 1024).toFixed(1)} KiB`)
const sortedTags = [...tags.entries()].sort((a, b) => b[1] - a[1])
for (const [tag, count] of sortedTags) {
  console.log(`  · ${tag}: ${count}`)
}
