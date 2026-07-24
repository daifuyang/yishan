#!/usr/bin/env node
/**
 * main 基线守卫：确保 main 分支上只有 core + demo 模块。
 *
 * 规则：
 *   在 main 分支（或 PR 目标为 main）上，`apps/yishan-api/src/modules/` 下
 *   只允许白名单中的模块（当前：`demo`）。任何额外模块（portal / shop 等）
 *   会被视为违规。非 main 目标时自动跳过。
 *
 * 检测逻辑(优先级)：
 *   1. CI: GITHUB_BASE_REF（PR 目标分支）
 *   2. CI: GITHUB_REF_NAME（push 到的分支）
 *   3. 本地: git rev-parse --abbrev-ref HEAD
 *
 * 用法：
 *   node scripts/check-main-baseline.mjs
 */

import { readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const MODULES_ROOT = 'apps/yishan-api/src/modules'
const ALLOWED = new Set(['demo'])

function currentBranch() {
  // CI: PR 的目标分支
  if (process.env.GITHUB_BASE_REF) return process.env.GITHUB_BASE_REF
  // CI: push 到的分支 (GITHUB_REF 是 refs/heads/<name>)
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME
  // 本地开发
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

const branch = currentBranch()
if (branch !== 'main') {
  console.log(`[check-main-baseline] branch="${branch}", 跳过（非 main 目标）`)
  process.exit(0)
}

const modulesDir = join(process.cwd(), MODULES_ROOT)
let entries
try {
  entries = readdirSync(modulesDir, { withFileTypes: true })
} catch (err) {
  console.error(`[check-main-baseline] 无法读取 ${modulesDir}: ${err.message}`)
  process.exit(1)
}

const violations = []
for (const entry of entries) {
  if (!entry.isDirectory()) continue
  if (entry.name.startsWith('.')) continue
  if (entry.name === '__pycache__') continue
  if (!ALLOWED.has(entry.name)) {
    violations.push(entry.name)
  }
}

if (violations.length > 0) {
  console.error(`[check-main-baseline] 错误: main 分支只允许模块: ${[...ALLOWED].join(', ')}`)
  console.error(`[check-main-baseline] 发现非法模块目录: ${violations.join(', ')}`)
  console.error(`[check-main-baseline] 请将这些模块移到 all 分支,不要在 main 上提交`)
  process.exit(1)
}

console.log(`[check-main-baseline] ok (main baseline: ${[...ALLOWED].join(', ')})`)
