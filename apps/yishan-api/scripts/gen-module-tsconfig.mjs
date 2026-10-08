#!/usr/bin/env node
/**
 * gen-module-tsconfig.mjs — 构建期产出 tsconfig.build.json。
 *
 * `meta.enabled === false` 的模块写入 exclude，不编进 dist。
 * 流量开关仍是数据库 `sys_module.enabled`，与本脚本无关。
 *
 * 产物：apps/yishan-api/tsconfig.build.json（gitignore）。
 * 必须在 tsc 之前运行。
 */
import { readdirSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPackedModuleDir } from './module-pack.mjs'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const modulesDir = join(apiRoot, 'src', 'modules')
const outPath = join(apiRoot, 'tsconfig.build.json')

const packedIds = []
const skippedIds = []
if (existsSync(modulesDir)) {
  for (const id of readdirSync(modulesDir)) {
    const dir = join(modulesDir, id)
    if (!statSync(dir).isDirectory()) continue
    const hasModuleEntry =
      existsSync(join(dir, 'module.ts')) || existsSync(join(dir, 'module.js'))
    if (!hasModuleEntry) {
      console.warn(
        `[gen-module-tsconfig] 跳过 src/modules/${id}：缺少 module.{ts,js}`,
      )
      continue
    }
    if (!isPackedModuleDir(dir)) {
      skippedIds.push(id)
      continue
    }
    packedIds.push(id)
  }
}

packedIds.sort()
skippedIds.sort()

const exclude = ['node_modules', 'dist', ...skippedIds.map((id) => `src/modules/${id}/**`)]
const config = { extends: './tsconfig.json', exclude }
writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`)

if (packedIds.length === 0 && skippedIds.length === 0) {
  console.log('[gen-module-tsconfig] 无模块')
} else {
  console.log(
    `[gen-module-tsconfig] 编译: ${packedIds.join(', ') || '(无)'}` +
      (skippedIds.length ? `；跳过 meta.enabled=false: ${skippedIds.join(', ')}` : ''),
  )
}