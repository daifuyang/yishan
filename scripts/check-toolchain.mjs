#!/usr/bin/env node
/**
 * check-toolchain.mjs — 确认当前 Node / pnpm 与 .tool-versions、package.json#packageManager 一致。
 *
 * 用法：node scripts/check-toolchain.mjs
 *   版本不一致 → 退出码 1。验证结果只在锁定的工具链下可比（P0 发现本机默认 Node 24）。
 *   切换方式：asdf / mise / fnm 读取 .tool-versions，例如 `fnm use 22.22.1`。
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function parseToolVersions(text) {
  return Object.fromEntries(
    text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/)),
  )
}

function main() {
  const tools = parseToolVersions(readFileSync(join(ROOT, '.tool-versions'), 'utf8'))
  const packageManager = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).packageManager ?? ''
  const node = process.version.replace(/^v/, '')
  let pnpm = 'unavailable'
  try {
    pnpm = execSync('pnpm --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {}
  const problems = []
  if (tools.nodejs ?? tools.node) {
    const want = tools.nodejs ?? tools.node
    if (node !== want) problems.push(`node ${node} != .tool-versions ${want}`)
  }
  if (tools.pnpm && pnpm !== tools.pnpm) problems.push(`pnpm ${pnpm} != .tool-versions ${tools.pnpm}`)
  if (tools.pnpm && packageManager && packageManager !== `pnpm@${tools.pnpm}`) problems.push(`package.json packageManager ${packageManager} != pnpm@${tools.pnpm}`)
  if (problems.length) {
    for (const p of problems) console.error(`[toolchain] ${p}`)
    console.error('[toolchain] switch with asdf/mise/fnm (reads .tool-versions) before running checks')
    process.exit(1)
  }
  console.log(`[toolchain] ok (node ${node}, pnpm ${pnpm})`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
