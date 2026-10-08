#!/usr/bin/env node
/**
 * dump-openapi-from-build.mjs — 启动构建产物 dist/app.js（与 CI 相同的 `fastify start`），
 * 导出运行时 OpenAPI 后关闭服务。不写仓库文件，除非输出路径指向仓库。
 *
 * 用法：DATABASE_URL=... REDIS_URL=... node scripts/dump-openapi-from-build.mjs <out.json> [port]
 * 前置：`pnpm build:ts`；数据库至少已有 Core 表（启动时会同步 sys_module）。
 * 不设置 NODE_ENV，与 CI 一致（因此包含 _dev 路由）。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const [out, port = '3197'] = process.argv.slice(2)
if (!out) {
  console.error('usage: dump-openapi-from-build.mjs <out.json> [port]')
  process.exit(2)
}
if (!existsSync(join(API_ROOT, 'dist', 'app.js'))) {
  console.error('[dump-openapi-from-build] dist/app.js missing; run pnpm build:ts')
  process.exit(2)
}

const cli = join(API_ROOT, 'node_modules', 'fastify-cli', 'cli.js')
const server = spawn(process.execPath, [cli, 'start', '-l', 'error', '-a', '127.0.0.1', '-p', port, 'dist/app.js'], {
  cwd: API_ROOT,
  env: { ...process.env, PORT: port },
  stdio: ['ignore', 'inherit', 'inherit'],
})
let exited = false
server.on('exit', (code) => {
  exited = true
  if (code) console.error(`[dump-openapi-from-build] server exited with ${code}`)
})

let status = 1
try {
  for (let i = 0; i < 60 && !exited; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/docs/json`)).ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  const dump = spawn(process.execPath, [join(API_ROOT, 'scripts', 'dump-openapi.mjs'), `http://127.0.0.1:${port}`, resolve(out)], { stdio: 'inherit' })
  status = await new Promise((r) => dump.on('exit', r))
} finally {
  server.kill()
}
process.exit(status)
