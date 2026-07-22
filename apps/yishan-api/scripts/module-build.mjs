#!/usr/bin/env node
/**
 * module-build.mjs — 开发态切换某模块的「构建期打包」开关。
 *
 * 用法：node scripts/module-build.mjs <id> <on|off>
 *   on  → module.json.build = true  （参与打包，编译进 dist）
 *   off → module.json.build = false （构建期排除，不进 dist、不参与打包）
 *
 * 这是「把启停状态同步到本地 meta 文件」的显式入口：写的是 git 跟踪的
 * src/modules/<id>/module.json，改完需要重新 build 才生效。
 * 与运行时启停（sys_module.enabled，即时生效）是两个不同维度的开关。
 */
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , id, state] = process.argv
if (!id || (state !== 'on' && state !== 'off')) {
  console.error('用法: node scripts/module-build.mjs <id> <on|off>')
  process.exit(1)
}

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const moduleDir = join(apiRoot, 'src', 'modules', id)
if (!existsSync(moduleDir) || !statSync(moduleDir).isDirectory()) {
  console.error(`[module-build] 模块不存在: src/modules/${id}`)
  process.exit(1)
}

const metaPath = join(moduleDir, 'module.json')
let meta = { id }
if (existsSync(metaPath)) {
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch (err) {
    console.error(`[module-build] 无法解析现有 module.json: ${err.message}`)
    process.exit(1)
  }
}
meta.id = meta.id ?? id
meta.build = state === 'on'
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
console.log(`[module-build] ${id}.build = ${meta.build}（改动 module.json，需重新 build 生效）`)
