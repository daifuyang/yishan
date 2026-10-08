#!/usr/bin/env node
/**
 * check-migrations.mjs — 迁移目录的静态守卫（不连接数据库）。
 *
 * 对 Core（apps/yishan-api/drizzle）与每个模块（apps/yishan-api/src/modules/<id>/drizzle）：
 *   journal-missing        目录有 SQL 却没有 meta/_journal.json
 *   sql-not-in-journal     SQL 文件未登记在 journal（drizzle 永远不会执行它）
 *   journal-without-sql    journal 条目没有对应 SQL
 *   journal-order          idx 不递增，或 `when` 不严格递增（migrator 会静默跳过较早的条目）
 *   published-sql-changed  已发布 SQL 的内容与基线不同（已执行过的库不会重放，修改等于制造分叉）
 *   published-sql-removed  基线中的 SQL 被删除
 *   unrecorded-sql         新 SQL 尚未登记进基线（评审后用 --update 记录）
 *   history-table          模块 drizzle.config.ts 未使用 moduleMigrationsTable('<id>')
 *                          或 Core 配置未使用 CORE_MIGRATIONS_TABLE（P0 R-01）
 *
 * 基线：scripts/baselines/migrations.json，记录每个已发布 SQL 的 sha256（按 LF 归一化）。
 * 用法：node scripts/check-migrations.mjs [--update]
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(ROOT, 'scripts', 'baselines', 'migrations.json')
const posix = (p) => p.split(sep).join('/')
const sha = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')

/** @returns {{ id: string, dir: string, config: string, core: boolean }[]} */
export function listStreams(root = ROOT) {
  const api = join(root, 'apps', 'yishan-api')
  const streams = [{ id: 'core', dir: join(api, 'drizzle'), config: join(api, 'drizzle.config.ts'), core: true }]
  const modules = join(api, 'src', 'modules')
  if (existsSync(modules)) {
    for (const id of readdirSync(modules).sort()) {
      const dir = join(modules, id, 'drizzle')
      if (statSync(join(modules, id)).isDirectory() && existsSync(dir)) {
        streams.push({ id, dir, config: join(modules, id, 'drizzle.config.ts'), core: false })
      }
    }
  }
  return streams
}

export function collectProblems(root = ROOT, baseline = { files: {} }) {
  const problems = []
  const seen = {}
  for (const s of listStreams(root)) {
    const rel = posix(relative(root, s.dir))
    const sqlFiles = readdirSync(s.dir).filter((f) => f.endsWith('.sql')).sort()
    const journalPath = join(s.dir, 'meta', '_journal.json')
    if (!existsSync(journalPath)) {
      if (sqlFiles.length > 0) problems.push(`journal-missing|${rel}`)
    } else {
      const entries = JSON.parse(readFileSync(journalPath, 'utf8')).entries ?? []
      const tags = new Set(entries.map((e) => e.tag))
      for (const f of sqlFiles) if (!tags.has(f.replace(/\.sql$/, ''))) problems.push(`sql-not-in-journal|${rel}/${f}`)
      for (const e of entries) if (!sqlFiles.includes(`${e.tag}.sql`)) problems.push(`journal-without-sql|${rel}|${e.tag}`)
      for (let i = 1; i < entries.length; i++) {
        if (!(entries[i].idx > entries[i - 1].idx) || !(entries[i].when > entries[i - 1].when)) {
          problems.push(`journal-order|${rel}|${entries[i - 1].tag} -> ${entries[i].tag}`)
        }
      }
    }
    for (const f of sqlFiles) {
      const key = `${rel}/${f}`
      seen[key] = sha(readFileSync(join(s.dir, f), 'utf8'))
      const known = baseline.files[key]
      if (known === undefined) problems.push(`unrecorded-sql|${key}`)
      else if (known !== seen[key]) problems.push(`published-sql-changed|${key}`)
    }
    const config = existsSync(s.config) ? readFileSync(s.config, 'utf8') : ''
    const expected = s.core ? /table:\s*CORE_MIGRATIONS_TABLE\b/ : new RegExp(`table:\\s*moduleMigrationsTable\\(\\s*['"]${s.id}['"]\\s*\\)`)
    if (!expected.test(config)) problems.push(`history-table|${posix(relative(root, s.config))}`)
  }
  for (const key of Object.keys(baseline.files)) if (!(key in seen)) problems.push(`published-sql-removed|${key}`)
  return { problems: problems.sort(), seen }
}

function main() {
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { files: {} }
  const { problems, seen } = collectProblems(ROOT, baseline)
  if (process.argv.includes('--update')) {
    const blocking = problems.filter((p) => !p.startsWith('unrecorded-sql|'))
    if (blocking.length > 0) {
      for (const p of blocking) console.error(`[migrations] ${p}`)
      console.error('[migrations] refusing to update the baseline while other problems exist')
      process.exit(1)
    }
    const files = { ...baseline.files }
    for (const p of problems) {
      const key = p.slice('unrecorded-sql|'.length)
      files[key] = seen[key]
    }
    const description = baseline.description ?? 'sha256 (LF-normalised) of every published migration SQL. Published SQL must never change; add new files with --update after review.'
    writeFileSync(BASELINE, `${JSON.stringify({ description, files: Object.fromEntries(Object.entries(files).sort()) }, null, 2)}\n`)
    console.log(`[migrations] baseline written: ${Object.keys(files).length} file(s)`)
    return
  }
  if (problems.length === 0) {
    console.log(`[migrations] ok (${Object.keys(seen).length} SQL file(s) in ${listStreams().length} stream(s))`)
    return
  }
  for (const p of problems) console.error(`[migrations] ${p}`)
  process.exit(1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
