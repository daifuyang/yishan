/**
 * migrations-bridge.ts — 已部署数据库的迁移历史衔接（P0 R-01 / M4 的存量修复）。
 *
 * 背景：旧版本中 Core 与所有模块共用 `__drizzle_migrations`；现在每个模块使用独立历史表
 * `<id>_drizzle_migrations`。已部署库升级前必须先把模块已执行的历史“登记”到新表，
 * 否则新表为空，迁移脚本会拒绝执行（前置守卫）。
 *
 *   pnpm --filter yishan-api db:migrations:bridge                 # dry-run（默认）：只读诊断 + 计划
 *   pnpm --filter yishan-api db:migrations:bridge -- --apply      # 执行计划中的“只插入”操作
 *   ... -- --apply --adopt=demo                                    # 额外登记“表已存在但无任何历史”的模块
 *
 * 原则：只读诊断先行；只 INSERT / CREATE 新历史表，绝不删除或修改旧历史行与业务表；
 * 需要人工判断的状态（结构不完整、历史只覆盖部分迁移）只报告，不自动处理。
 * 回滚：DROP 本脚本创建的 `<id>_drizzle_migrations`、删除本脚本写入的 sys_module_migration 行
 * （脚本会打印对应 SQL）；旧 `__drizzle_migrations` 从未被改动。
 *
 * 退出码：0 = 无需人工处理；3 = 存在 needs-review 项；1 = 执行出错。
 */
import 'dotenv/config'
import { join } from 'node:path'
import type { Pool, RowDataPacket } from 'mysql2/promise'
import { pool } from '../db/client.js'
import { CORE_MIGRATIONS_TABLE } from '../db/migrations-table.js'
import {
  findMissingSchemaObjects,
  migrationHash,
  readHistoryHashes,
  readJournal,
  recordedHash,
  recordModuleMigrations,
  type MigrationStream,
} from './lib/migration-streams.js'
import { coreStream, moduleStream, packedModules, rootsFromDist } from './lib/streams.js'

export type BridgeStatus =
  | 'up-to-date' // 模块历史表已包含全部 journal 条目
  | 'fresh' // 无历史、无表：正常迁移即可
  | 'copy-from-shared' // 共享历史中有全部条目且结构完整：复制到模块历史表
  | 'repair-by-migrate' // 共享历史中有记录但表全部缺失（P0 M5）：不复制，正常迁移会建表
  | 'adopt-candidate' // 表与列齐全但没有任何历史（如经 apply-drizzle-sql 建表）：需 --adopt
  | 'needs-review' // 其余不一致状态：人工处理

export interface BridgePlan {
  id: string
  table: string
  status: BridgeStatus
  detail: string
  /** apply 时写入模块历史表的行。 */
  rows: { tag: string; hash: string; createdAt: number }[]
}

async function existingTables(pool: Pool, names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (${names.map(() => '?').join(',')})`,
    names,
  )
  return rows.map((r) => String(r.t))
}

export async function planModule(pool: Pool, id: string, stream: MigrationStream): Promise<BridgePlan> {
  const entries = readJournal(stream.folder)
  const base = { id, table: stream.table, rows: [] as BridgePlan['rows'] }
  if (entries.length === 0) return { ...base, status: 'up-to-date', detail: 'journal 为空' }
  const hashes = entries.map((e) => ({ tag: e.tag, when: e.when, hash: migrationHash(stream.folder, e.tag) }))

  const own = await readHistoryHashes(pool, stream.table)
  if (hashes.every((h) => recordedHash(own, stream.folder, h.tag))) {
    return { ...base, status: 'up-to-date', detail: `${stream.table} 已包含全部 ${hashes.length} 条` }
  }
  if (own.size > 0) {
    return { ...base, status: 'needs-review', detail: `${stream.table} 只包含部分条目（${own.size}/${hashes.length}）；请正常执行迁移并核对结果` }
  }

  const shared = await readHistoryHashes(pool, CORE_MIGRATIONS_TABLE)
  // 共享历史中实际记录的 hash（可能是 CRLF 检出时的变体），复制时原样沿用。
  const inShared = hashes
    .map((h) => ({ ...h, sharedHash: recordedHash(shared, stream.folder, h.tag) }))
    .filter((h): h is typeof h & { sharedHash: string } => h.sharedHash !== undefined)
  const tableNames = [...stream.expectedTables.keys()]
  const present = await existingTables(pool, tableNames)
  const missing = await findMissingSchemaObjects(pool, stream.expectedTables)

  if (present.length === 0) {
    return inShared.length > 0
      ? { ...base, status: 'repair-by-migrate', detail: `${CORE_MIGRATIONS_TABLE} 记录了 ${inShared.map((h) => h.tag).join(', ')}，但表全部缺失（P0 M5）；不复制历史，直接执行迁移即可建表` }
      : { ...base, status: 'fresh', detail: '无历史、无表；直接执行迁移' }
  }
  if (inShared.length === hashes.length && missing.length === 0) {
    return {
      ...base,
      status: 'copy-from-shared',
      detail: `${CORE_MIGRATIONS_TABLE} 中有全部 ${hashes.length} 条且表结构完整；复制到 ${stream.table}（created_at 沿用原值）`,
      rows: inShared.map((h) => ({ tag: h.tag, hash: h.sharedHash, createdAt: shared.get(h.sharedHash)! })),
    }
  }
  if (inShared.length === 0 && missing.length === 0) {
    return {
      ...base,
      status: 'adopt-candidate',
      detail: `表与列齐全（${present.join(', ')}）但没有任何迁移历史；核对表结构后用 --adopt=${id} 登记全部 ${hashes.length} 条`,
      rows: hashes.map((h) => ({ tag: h.tag, hash: h.hash, createdAt: h.when })),
    }
  }
  return {
    ...base,
    status: 'needs-review',
    detail: `共享历史 ${inShared.length}/${hashes.length} 条；已存在表 ${present.join(', ')}；缺失 ${missing.join(', ') || '无'}`,
  }
}

/** drizzle migrator 自建历史表的同一定义。 */
const createHistorySql = (table: string) =>
  `CREATE TABLE IF NOT EXISTS \`${table}\` (id serial primary key, hash text not null, created_at bigint)`

export async function applyPlan(pool: Pool, plan: BridgePlan): Promise<number> {
  await pool.query(createHistorySql(plan.table))
  const own = await readHistoryHashes(pool, plan.table)
  let inserted = 0
  for (const row of plan.rows) {
    if (own.has(row.hash)) continue
    await pool.query(`INSERT INTO \`${plan.table}\` (hash, created_at) VALUES (?, ?)`, [row.hash, row.createdAt])
    inserted++
  }
  await recordModuleMigrations(pool, plan.id, plan.rows.map((r) => r.tag))
  return inserted
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const adopt = new Set(
    args.filter((a) => a.startsWith('--adopt=')).flatMap((a) => a.slice('--adopt='.length).split(',')).filter(Boolean),
  )
  const ids = args.filter((a) => !a.startsWith('--'))
  const roots = rootsFromDist(join(__dirname, '..'))

  console.log(`[bridge] mode: ${apply ? 'APPLY' : 'dry-run (no writes)'}`)
  const core = coreStream(roots)
  const coreHistory = await readHistoryHashes(pool, core.table)
  const coreEntries = readJournal(core.folder)
  const coreMissing = coreEntries.filter((e) => !recordedHash(coreHistory, core.folder, e.tag)).map((e) => e.tag)
  console.log(
    `[bridge] core: ${coreHistory.size} row(s) in ${core.table}; journal ${coreEntries.length}; ` +
      (coreMissing.length === 0 ? 'all recorded' : `not recorded: ${coreMissing.join(', ')} (run db:migrate after review)`),
  )

  const plans: BridgePlan[] = []
  for (const meta of await packedModules(roots, ids)) {
    const stream = moduleStream(roots, meta)
    if (!stream) continue
    plans.push(await planModule(pool, meta.id, stream))
  }

  let review = 0
  for (const p of plans) {
    const actionable = p.status === 'copy-from-shared' || (p.status === 'adopt-candidate' && adopt.has(p.id))
    console.log(`[bridge] ${p.id}: ${p.status} — ${p.detail}`)
    if (p.status === 'needs-review' || (p.status === 'adopt-candidate' && !adopt.has(p.id))) review++
    if (!actionable) continue
    console.log(`  plan: ${createHistorySql(p.table)}`)
    for (const r of p.rows) console.log(`  plan: INSERT INTO \`${p.table}\` (hash, created_at) VALUES ('${r.hash}', ${r.createdAt}) -- ${r.tag}`)
    console.log(`  plan: INSERT INTO sys_module_migration (module_id, hash) for ${p.rows.map((r) => r.tag).join(', ')} (missing only)`)
    console.log(`  rollback: DROP TABLE \`${p.table}\`; DELETE FROM sys_module_migration WHERE module_id = '${p.id}' AND hash IN (${p.rows.map((r) => `'${r.tag}'`).join(', ')});`)
    if (apply) {
      const n = await applyPlan(pool, p)
      console.log(`  applied: ${n} history row(s) inserted into ${p.table}`)
    }
  }
  if (!apply && plans.some((p) => p.status === 'copy-from-shared')) {
    console.log('[bridge] 备份要求：执行 --apply 前请备份 __drizzle_migrations、sys_module_migration 并记录 information_schema.tables 快照。')
  }
  return review > 0 ? 3 : 0
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((err) => {
      console.error('[bridge] failed:', err)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
