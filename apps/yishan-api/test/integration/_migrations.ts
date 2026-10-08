/**
 * 集成测试的迁移历史解析与执行。
 *
 * 只按仓库记录的有效迁移历史建库，不执行目录下的全部 SQL：
 *   - 存在 meta/_journal.json → 只取 journal 登记的条目（tag 对应的 .sql 必须存在）。
 *   - 不存在 journal（main 的 Core：drizzle/meta 被 .gitignore 排除，CI 在运行时 generate）
 *     → 目录中必须恰好只有一个 .sql，即唯一的已提交迁移；否则视为历史不明确并报错。
 *
 * 执行使用 drizzle-orm 官方 migrator（与 `drizzle-kit migrate` 同一实现），因此会真实写入
 * `__drizzle_migrations`。无 journal 时只在系统临时目录合成一份 journal 副本，仓库文件不变。
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import type mysql from 'mysql2/promise'

export interface MigrationPlan {
  folder: string
  source: 'journal' | 'single-file-without-journal'
  tags: string[]
}

type Journal = { entries: { idx: number; when: number; tag: string; breakpoints: boolean; version: string }[] }

export function resolveMigrationPlan(folder: string): MigrationPlan {
  const journalPath = join(folder, 'meta', '_journal.json')
  if (existsSync(journalPath)) {
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal
    const tags = journal.entries.map((e) => e.tag)
    for (const tag of tags) {
      if (!existsSync(join(folder, `${tag}.sql`))) throw new Error(`journal entry ${tag} has no SQL file in ${folder}`)
    }
    return { folder, source: 'journal', tags }
  }
  const sqlFiles = readdirSync(folder).filter((f) => f.endsWith('.sql'))
  if (sqlFiles.length !== 1) {
    throw new Error(`${folder} has no meta/_journal.json and ${sqlFiles.length} SQL files; migration history is ambiguous`)
  }
  return { folder, source: 'single-file-without-journal', tags: [sqlFiles[0].replace(/\.sql$/, '')] }
}

/** 返回可直接交给 drizzle migrator 的目录；无 journal 时在临时目录合成。调用方负责 cleanup。 */
function materialize(plan: MigrationPlan): { folder: string; cleanup: () => void } {
  if (plan.source === 'journal') return { folder: plan.folder, cleanup: () => {} }
  const tmp = mkdtempSync(join(tmpdir(), 'yishan-migrations-'))
  const [tag] = plan.tags
  copyFileSync(join(plan.folder, `${tag}.sql`), join(tmp, `${tag}.sql`))
  // main 的 CI 在运行时 `drizzle-kit generate`，生成的 journal `when` 即当前时间；这里保持一致，
  // 以便模块迁移与 Core 共用历史表时的真实行为（R-01）能被测试观察到。
  const journal: Journal = { entries: [{ idx: 0, version: '5', when: Date.now(), tag, breakpoints: true }] }
  mkdirSync(join(tmp, 'meta'))
  writeFileSync(join(tmp, 'meta', '_journal.json'), JSON.stringify({ version: '7', dialect: 'mysql', entries: journal.entries }))
  return { folder: tmp, cleanup: () => rmSync(tmp, { recursive: true, force: true }) }
}

/** 以官方 migrator 执行一条迁移流；migrationsTable 缺省为 drizzle 默认的共享表。 */
export async function applyMigrations(pool: mysql.Pool, plan: MigrationPlan, migrationsTable?: string): Promise<void> {
  const { folder, cleanup } = materialize(plan)
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder, ...(migrationsTable ? { migrationsTable } : {}) })
  } finally {
    cleanup()
  }
}

export const CORE_MIGRATIONS = join(process.cwd(), 'drizzle')
export const moduleMigrations = (id: string) => join(process.cwd(), 'src', 'modules', id, 'drizzle')
