#!/usr/bin/env node
/**
 * check-architecture-boundaries.mjs — 公共代码与业务模块之间的最小边界守卫。
 *
 * 规则（violation key = `<rule>|<file>|<detail>`，不含行号）：
 *   core-imports-module    API/Admin 中 src/modules/ 之外的源码 import 了 src/modules/** 内的文件
 *   cross-module-import    src/modules/<a> import 了 src/modules/<b>（a ≠ b）
 *   package-imports-app    packages/** 或 apps/yishan-components/** import 了 apps/<app>/ 内的源码
 *   business-literal       公共代码（API src/modules 之外、Admin src/modules 之外）出现业务模块 id
 *                          作为字符串字面量（含权限码前缀、URL、Swagger tag、i18n key、import 路径）
 *
 * 已知违规记录在 scripts/baselines/architecture-boundaries.json（每项带 reason）。
 *   新违规 → 失败；基线中已消失的违规 → 失败（要求同步删除，防止悄悄回归）。
 * 用法：node scripts/check-architecture-boundaries.mjs [--update] [--json]
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(ROOT, 'scripts', 'baselines', 'architecture-boundaries.json')
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.umi', '.umi-production', '.umi-test', '.docusaurus', 'coverage', 'generated', 'test', 'tests', '__tests__', 'mocks'])

/** 可选业务模块 id：磁盘上的模块目录 + 已知的业务模块（main 上已移除，但不得回流到公共代码）。 */
export const KNOWN_BUSINESS_IDS = ['crm', 'portal', 'shop']

const APPS = {
  api: { root: 'apps/yishan-api', src: 'apps/yishan-api/src', aliases: { '@/': 'apps/yishan-api/src/' } },
  admin: { root: 'apps/yishan-admin', src: 'apps/yishan-admin/src', aliases: { '@/': 'apps/yishan-admin/src/', '@modules/': 'apps/yishan-admin/src/modules/' } },
}
const SHARED_ROOTS = ['packages', 'apps/yishan-components']
const APP_DIRS = ['apps/yishan-api', 'apps/yishan-admin', 'apps/yishan-app', 'apps/yishan-docs']

const posix = (p) => p.split(sep).join('/')

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (CODE_EXT.test(name) && !/\.(test|spec)\.[a-z]+$/.test(name) && !name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

/** 去掉注释，保留字符串（足够应付本仓库的代码风格；不追求完整的词法分析）。 */
export function stripComments(src) {
  let out = ''
  let i = 0
  let quote = null
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') { out += n ?? ''; i += 2; continue }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue }
    out += c
    i++
  }
  return out
}

export function importSpecifiers(code) {
  const specs = []
  const re = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(code))) specs.push(m[1] ?? m[2] ?? m[3] ?? m[4])
  return specs
}

function resolveSpec(root, fileRel, spec, aliases = {}) {
  if (spec.startsWith('.')) return posix(relative(root, resolve(root, dirname(fileRel), spec)))
  for (const [prefix, target] of Object.entries(aliases)) if (spec.startsWith(prefix)) return target + spec.slice(prefix.length)
  return null
}

/** 字符串字面量中以独立 token 出现的业务 id。 */
export function businessLiterals(code, ids) {
  const hits = new Set()
  const strRe = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g
  let m
  while ((m = strRe.exec(code))) {
    const s = m[2]
    for (const id of ids) {
      if (new RegExp(`(^|[^A-Za-z0-9_])${id}([^A-Za-z0-9_]|$)`).test(s)) hits.add(`${id}:${s.length > 80 ? `${s.slice(0, 77)}...` : s}`)
    }
  }
  return [...hits]
}

const moduleOf = (rel, appSrc) => {
  const prefix = `${appSrc}/modules/`
  return rel.startsWith(prefix) ? rel.slice(prefix.length).split('/')[0] : null
}

export function collectViolations(root = ROOT) {
  const violations = []
  const moduleIds = new Set(KNOWN_BUSINESS_IDS)
  for (const app of Object.values(APPS)) {
    const dir = join(root, app.src, 'modules')
    if (existsSync(dir)) for (const d of readdirSync(dir)) if (statSync(join(dir, d)).isDirectory()) moduleIds.add(d)
  }
  const ids = [...moduleIds].sort()

  for (const app of Object.values(APPS)) {
    for (const abs of walk(join(root, app.src))) {
      const rel = posix(relative(root, abs))
      const code = stripComments(readFileSync(abs, 'utf8'))
      const owner = moduleOf(rel, app.src)
      for (const spec of importSpecifiers(code)) {
        const target = resolveSpec(root, rel, spec, app.aliases)
        if (!target) continue
        const targetModule = moduleOf(target, app.src)
        if (!targetModule) continue
        if (!owner) violations.push(`core-imports-module|${rel}|${spec}`)
        else if (owner !== targetModule) violations.push(`cross-module-import|${rel}|${spec}`)
      }
      if (!owner) for (const hit of businessLiterals(code, ids)) violations.push(`business-literal|${rel}|${hit}`)
    }
  }

  for (const shared of SHARED_ROOTS) {
    for (const abs of walk(join(root, shared))) {
      const rel = posix(relative(root, abs))
      const code = stripComments(readFileSync(abs, 'utf8'))
      for (const spec of importSpecifiers(code)) {
        const target = resolveSpec(root, rel, spec)
        const reachesApp = target && APP_DIRS.some((a) => target === a || target.startsWith(`${a}/`))
        const namesApp = /^(yishan-api|yishan-admin|yishan-app|yishan-docs)(\/|$)/.test(spec)
        if (reachesApp || namesApp) violations.push(`package-imports-app|${rel}|${spec}`)
      }
    }
  }
  return [...new Set(violations)].sort()
}

function main() {
  const args = process.argv.slice(2)
  const actual = collectViolations()
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { violations: [] }
  const known = new Map(baseline.violations.map((v) => [v.key, v]))

  if (args.includes('--update')) {
    const next = actual.map((key) => known.get(key) ?? { key, reason: 'TODO: explain why this is tolerated and which phase removes it' })
    writeFileSync(BASELINE, `${JSON.stringify({ description: baseline.description ?? 'Known boundary violations. New entries need review; remove entries when fixed.', violations: next }, null, 2)}\n`)
    console.log(`[boundaries] baseline written: ${next.length} entries`)
    return
  }
  if (args.includes('--json')) { console.log(JSON.stringify(actual, null, 2)); return }

  const added = actual.filter((k) => !known.has(k))
  const fixed = [...known.keys()].filter((k) => !actual.includes(k))
  const missingReason = baseline.violations.filter((v) => !v.reason || v.reason.startsWith('TODO'))
  if (!added.length && !fixed.length && !missingReason.length) {
    console.log(`[boundaries] ok (${actual.length} known violation(s) tracked in scripts/baselines/architecture-boundaries.json)`)
    return
  }
  for (const k of added) console.error(`[boundaries] NEW violation: ${k}`)
  for (const k of fixed) console.error(`[boundaries] violation no longer present, remove from baseline: ${k}`)
  for (const v of missingReason) console.error(`[boundaries] baseline entry needs a reason: ${v.key}`)
  process.exit(1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
