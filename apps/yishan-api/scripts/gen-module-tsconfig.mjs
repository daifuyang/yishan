#!/usr/bin/env node
/**
 * gen-module-tsconfig.mjs — 构建期产出 tsconfig.build.json 的脚本。
 *
 * 历史上这里根据 src/modules/<id>/module.json 的 `build` 字段往 tsconfig 追加 exclude，
 * 用来"构建期排除某模块"。该机制已删除——所有模块一律进 dist，由运行时
 * sys_module.enabled 决定是否挂载（见 src/core/module-loader/module-loader.ts）。
 *
 * 现在这个脚本仍然存在并被 `build:ts` 调用，但只做一件事：把 src/modules/ 下所有
 * 子目录名打印出来，提示"我发现了哪些模块"。tsconfig.build.json 仅继承基础
 * tsconfig.json 的 include，自然覆盖 src/modules/<id>/。
 *
 * 模块发现规则：src/modules/ 下任意子目录若存在 module.ts 或 module.js，即视为一个模块。
 *
 * 产物：apps/yishan-api/tsconfig.build.json（extends 基础 tsconfig）。
 * 该文件由构建流程生成，已在 .gitignore 忽略；tsc / tsc-alias 用 `-p tsconfig.build.json`。
 *
 * 纯 JS、无依赖，必须在 tsc 之前运行（此时还没有 dist）。
 */
import { readdirSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const modulesDir = join(apiRoot, 'src', 'modules')
const outPath = join(apiRoot, 'tsconfig.build.json')

const moduleIds = []
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
    moduleIds.push(id)
  }
}

const config = { extends: './tsconfig.json' }
writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`)
console.log(
  moduleIds.length
    ? `[gen-module-tsconfig] 发现模块: ${moduleIds.sort().join(', ')}（全部纳入编译）`
    : '[gen-module-tsconfig] 无模块',
)