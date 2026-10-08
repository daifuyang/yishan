#!/usr/bin/env node
/**
 * check-tsc-baseline.mjs — 对存在既有类型错误的项目做“只减不增”的 tsc 门禁。
 *
 * 用法：
 *   node scripts/check-tsc-baseline.mjs <project>            # 校验
 *   node scripts/check-tsc-baseline.mjs <project> --update   # 有意更新基线（需在 PR 中说明）
 *
 * 行为：
 *   - 在项目目录执行 `tsc --noEmit -p tsconfig.json`，把每条错误归一为
 *     `<相对文件>|<TS 码>|<首行消息>`（不含行列号，避免无关改动导致漂移）。
 *   - 与 scripts/baselines/tsc/<project>.json 比较：
 *       新增错误 → 失败；基线中已不存在的错误 → 失败（要求同步删除，防止问题悄悄回归）。
 *   - tsc 异常退出但未解析出任何错误（配置错误、崩溃）→ 失败。
 *   - 基线为空的项目等价于普通 `tsc --noEmit`。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const PROJECTS = {
  app: 'apps/yishan-app',
  tiptap: 'apps/yishan-components/yishan-tiptap',
}

/** 把 tsc 输出解析为错误 key 列表（保留重复，按多重集合比较）。 */
export function parseTscOutput(text) {
  const keys = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/.exec(line.trim())
    if (m) {
      keys.push(`${m[1].replace(/\\/g, '/')}|${m[2]}|${m[3]}`)
      continue
    }
    // 无文件位置的诊断（例如 tsconfig 配置错误 `error TS5023: ...`）同样计入，不能被已有基线掩盖
    const g = /^error (TS\d+): (.*)$/.exec(line.trim())
    if (g) keys.push(`<global>|${g[1]}|${g[2]}`)
  }
  return keys.sort()
}

/** 多重集合差：返回 a 中比 b 多出的元素。 */
export function multisetMinus(a, b) {
  const counts = new Map()
  for (const k of b) counts.set(k, (counts.get(k) ?? 0) + 1)
  const out = []
  for (const k of a) {
    const n = counts.get(k) ?? 0
    if (n > 0) counts.set(k, n - 1)
    else out.push(k)
  }
  return out
}

function main() {
  const [name, flag] = process.argv.slice(2)
  const rel = PROJECTS[name]
  if (!rel) {
    console.error(`[tsc-baseline] unknown project "${name}"; expected one of: ${Object.keys(PROJECTS).join(', ')}`)
    process.exit(2)
  }
  const cwd = join(ROOT, rel)
  let tscJs
  try {
    tscJs = createRequire(join(cwd, 'package.json')).resolve('typescript/bin/tsc')
  } catch {
    console.error(`[tsc-baseline] typescript is not installed for ${rel}; run pnpm install`)
    process.exit(2)
  }
  const res = spawnSync(process.execPath, [tscJs, '--noEmit', '-p', 'tsconfig.json'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`
  const actual = parseTscOutput(output)
  if (res.status !== 0 && actual.length === 0) {
    console.error(`[tsc-baseline] ${name}: tsc exited ${res.status} without parseable diagnostics:\n${output}`)
    process.exit(1)
  }

  const baselinePath = join(ROOT, 'scripts', 'baselines', 'tsc', `${name}.json`)
  if (flag === '--update') {
    mkdirSync(dirname(baselinePath), { recursive: true })
    writeFileSync(baselinePath, `${JSON.stringify({ project: rel, errors: actual }, null, 2)}\n`)
    console.log(`[tsc-baseline] ${name}: baseline written with ${actual.length} errors`)
    return
  }
  const expected = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')).errors : []
  const added = multisetMinus(actual, expected)
  const fixed = multisetMinus(expected, actual)
  if (added.length === 0 && fixed.length === 0) {
    const note = expected.length ? ` (KNOWN BASELINE FAILURE: ${expected.length} recorded errors, see scripts/baselines/tsc/${name}.json)` : ''
    console.log(`[tsc-baseline] ${name}: ok${note}`)
    return
  }
  if (added.length) {
    console.error(`[tsc-baseline] ${name}: ${added.length} NEW type error(s):`)
    for (const k of added) console.error(`  + ${k}`)
  }
  if (fixed.length) {
    console.error(`[tsc-baseline] ${name}: ${fixed.length} recorded error(s) no longer occur; remove them from the baseline:`)
    for (const k of fixed) console.error(`  - ${k}`)
  }
  process.exit(1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
