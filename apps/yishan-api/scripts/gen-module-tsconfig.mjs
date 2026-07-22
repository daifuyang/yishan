#!/usr/bin/env node
/**
 * gen-module-tsconfig.mjs — 构建期打包 include 的落地。
 *
 * 事实源：每模块 src/modules/<id>/module.json 的 `build` 字段。
 *   - build === false → 该模块加入 tsconfig 的 exclude，不编译进 dist、不参与打包。
 *   - 缺文件 / 缺字段 / 解析失败 → 一律按 build:true 处理（向后兼容 = 全打包）。
 *
 * 产物：apps/yishan-api/tsconfig.build.json（extends 基础 tsconfig，仅追加 exclude）。
 * 该文件由构建流程生成，已在 .gitignore 忽略；tsc / tsc-alias 用 `-p tsconfig.build.json`。
 *
 * 纯 JS、无依赖，必须在 tsc 之前运行（此时还没有 dist）。
 */
import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const modulesDir = join(apiRoot, 'src', 'modules')
const outPath = join(apiRoot, 'tsconfig.build.json')

const excluded = []
if (existsSync(modulesDir)) {
  for (const id of readdirSync(modulesDir)) {
    const dir = join(modulesDir, id)
    if (!statSync(dir).isDirectory()) continue
    const metaPath = join(dir, 'module.json')
    let build = true
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        if (meta && meta.build === false) build = false
      } catch (err) {
        console.warn(`[gen-module-tsconfig] 无法解析 ${metaPath}: ${err.message}，按 build:true 处理`)
      }
    }
    if (!build) excluded.push(`src/modules/${id}/**`)
  }
}

const config = {
  extends: './tsconfig.json',
  exclude: excluded,
}
writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`)
console.log(
  excluded.length
    ? `[gen-module-tsconfig] 已排除模块（不打包）: ${excluded.join(', ')}`
    : '[gen-module-tsconfig] 无模块被排除，全部打包',
)
