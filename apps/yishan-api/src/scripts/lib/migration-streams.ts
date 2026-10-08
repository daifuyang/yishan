/**
 * migration-streams.ts — 迁移流执行与校验（Core 一条流，每个模块一条流）。
 *
 * 只使用 Drizzle 官方 migrator（drizzle-orm/mysql2/migrator，与 `drizzle-kit migrate` 同一实现），
 * 在其前后补上 P0 证明缺失的三道检查，让“迁移被跳过却报告成功”不再可能：
 *
 *   1. 前置守卫：历史表为空、但该流声明的表已存在 → 拒绝执行（已部署库需先运行
 *      `db:migrations:bridge` 衔接历史，否则会重复建表或掩盖不一致）。
 *   2. 历史核对：执行后 journal 中每个条目的 hash 都必须出现在该流的历史表里
 *      （捕获 journal 时间戳不单调等导致的静默跳过）。
 *   3. 结构核对：schema 声明的每张表、每一列都必须真实存在于 information_schema。
 *
 * 任一检查失败都抛错；调用方（CLI / onboard）据此返回非零退出码。
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { is } from 'drizzle-orm'
import { MySqlTable, getTableConfig } from 'drizzle-orm/mysql-core'
import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import type { Pool, RowDataPacket } from 'mysql2/promise'

export interface JournalEntry {
  idx: number
  when: number
  tag: string
}

export interface MigrationStream {
  /** 日志与错误信息中的名字，如 `core`、`module demo`。 */
  label: string
  /** drizzle 输出目录（含 meta/_journal.json 与 <tag>.sql）。 */
  folder: string
  /** 该流的历史表。 */
  table: string
  /** 该流负责的表 → 列名（用于前置守卫与结构核对）。 */
  expectedTables: Map<string, string[]>
}

export interface StreamResult {
  label: string
  table: string
  /** 本次新执行的 tag。 */
  applied: string[]
  /** journal 中全部 tag（执行后均已核对存在于历史表）。 */
  recorded: string[]
  verifiedTables: string[]
}

export function readJournal(folder: string): JournalEntry[] {
  const journalPath = join(folder, 'meta', '_journal.json')
  if (!existsSync(journalPath)) return []
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries?: JournalEntry[] }
  return journal.entries ?? []
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** 与 drizzle readMigrationFiles 相同的 hash：sha256(SQL 文件全文)。 */
export function migrationHash(folder: string, tag: string): string {
  return sha256(readFileSync(join(folder, `${tag}.sql`)).toString())
}

/**
 * 同一迁移在 LF / CRLF 检出下的两个 hash。仓库用 .gitattributes 强制 SQL 以 LF 检出，
 * 但此前在 Windows（autocrlf）上执行过的库记录的是 CRLF 版本的 hash；核对时两者都认。
 */
export function migrationHashVariants(folder: string, tag: string): string[] {
  const lf = readFileSync(join(folder, `${tag}.sql`)).toString().replace(/\r\n/g, '\n')
  return [...new Set([sha256(lf), sha256(lf.replace(/\n/g, '\r\n'))])]
}

/** 历史表中记录该迁移所用的 hash（任一换行变体）；未记录返回 undefined。 */
export function recordedHash(history: Map<string, number>, folder: string, tag: string): string | undefined {
  return migrationHashVariants(folder, tag).find((h) => history.has(h))
}

/** 从一个 schema 模块（db/schema.ts 的导出）收集表名与列名。 */
export function tablesFromSchema(schemaModule: Record<string, unknown>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const value of Object.values(schemaModule)) {
    if (!is(value, MySqlTable)) continue
    const cfg = getTableConfig(value)
    out.set(cfg.name, cfg.columns.map((c) => c.name))
  }
  return out
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [table],
  )
  return rows.length > 0
}

export async function readHistoryHashes(pool: Pool, table: string): Promise<Map<string, number>> {
  if (!(await tableExists(pool, table))) return new Map()
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT hash, created_at FROM \`${table}\``)
  return new Map(rows.map((r) => [String(r.hash), Number(r.created_at)]))
}

/** 返回 schema 声明但数据库中缺失的表 / 列，形如 `t` 或 `t.col`。 */
export async function findMissingSchemaObjects(pool: Pool, expected: Map<string, string[]>): Promise<string[]> {
  if (expected.size === 0) return []
  const names = [...expected.keys()]
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name AS t, column_name AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name IN (${names.map(() => '?').join(',')})`,
    names,
  )
  const present = new Map<string, Set<string>>()
  for (const r of rows) {
    const t = String(r.t)
    if (!present.has(t)) present.set(t, new Set())
    present.get(t)!.add(String(r.c))
  }
  const missing: string[] = []
  for (const [table, columns] of expected) {
    const cols = present.get(table)
    if (!cols) {
      missing.push(table)
      continue
    }
    for (const c of columns) if (!cols.has(c)) missing.push(`${table}.${c}`)
  }
  return missing
}

export async function runMigrationStream(pool: Pool, stream: MigrationStream): Promise<StreamResult> {
  const entries = readJournal(stream.folder)
  const tags = entries.map((e) => e.tag)
  const result: StreamResult = { label: stream.label, table: stream.table, applied: [], recorded: tags, verifiedTables: [] }
  if (entries.length === 0) return result

  const before = await readHistoryHashes(pool, stream.table)

  // 1. 前置守卫：历史为空却已有本流的表 → 未衔接的已部署库，或经其他途径建表。
  if (before.size === 0) {
    const present: string[] = []
    for (const t of stream.expectedTables.keys()) if (await tableExists(pool, t)) present.push(t)
    if (present.length > 0) {
      throw new Error(
        `${stream.label}: history table \`${stream.table}\` is empty but its tables already exist (${present.join(', ')}). ` +
          'This database predates per-module migration history; run `pnpm --filter yishan-api db:migrations:bridge` ' +
          '(dry-run) and follow its report before migrating.',
      )
    }
  }

  await migrate(drizzle(pool), { migrationsFolder: stream.folder, migrationsTable: stream.table })

  // 2. 历史核对：每个 journal 条目都必须已记录在本流的历史表中。
  const after = await readHistoryHashes(pool, stream.table)
  const notRecorded = tags.filter((tag) => !recordedHash(after, stream.folder, tag))
  if (notRecorded.length > 0) {
    throw new Error(
      `${stream.label}: migrator finished but ${notRecorded.join(', ')} is not recorded in \`${stream.table}\` ` +
        '(skipped migration; check that journal `when` values increase monotonically).',
    )
  }
  result.applied = tags.filter((tag) => !recordedHash(before, stream.folder, tag))

  // 3. 结构核对：schema 中的表与列必须真实存在。
  const missing = await findMissingSchemaObjects(pool, stream.expectedTables)
  if (missing.length > 0) {
    throw new Error(`${stream.label}: migrations recorded but schema objects are missing: ${missing.join(', ')}`)
  }
  result.verifiedTables = [...stream.expectedTables.keys()].sort()
  return result
}

/**
 * 把模块已记录在其历史表中的迁移同步进 sys_module_migration（管理界面的展示层）。
 * 按 (module_id, tag) 去重——此前按 tag 跨模块去重，第二个起的模块永远不被记录（P0 M4）。
 * 只登记已在历史表中核对过的 tag。返回新增条数。
 */
export async function recordModuleMigrations(pool: Pool, moduleId: string, tags: string[]): Promise<number> {
  if (tags.length === 0) return 0
  if (!(await tableExists(pool, 'sys_module_migration'))) {
    throw new Error('sys_module_migration does not exist; run the Core migration first (pnpm --filter yishan-api db:migrate)')
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT hash FROM sys_module_migration WHERE module_id = ?',
    [moduleId],
  )
  const known = new Set(rows.map((r) => String(r.hash)))
  const fresh = tags.filter((t) => !known.has(t))
  for (const tag of fresh) {
    await pool.query('INSERT INTO sys_module_migration (module_id, hash) VALUES (?, ?)', [moduleId, tag])
  }
  return fresh.length
}
