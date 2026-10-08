/**
 * R-01（P0 risks.md）：Core 与模块共用 `__drizzle_migrations`，drizzle migrator 只执行晚于
 * 历史表最大 created_at 的迁移；Core 先迁移时模块的 `0000_init` 被静默跳过且不报错。
 *
 * 修复（Source-First Goal D）：每个模块使用独立历史表 `<id>_drizzle_migrations`，
 * 迁移经 scripts/lib/migration-streams.ts 执行并核对历史与表结构。
 *
 * 本文件保留两部分：
 *   1. 修复后的生产路径：Core 先迁移（CI 与 db:seed 的顺序）后 demo 表存在
 *      ——此前以 `it.fails('BLOCKED BY R-01: demo_todos exists')` 跟踪，修复后去掉标记；
 *   2. 根因复现：若仍把两条流写进同一张历史表，drizzle 的行为不变，demo 依然被跳过。
 *      这说明修复依赖“历史表分离”，任何人把模块配置改回共享表都会让第 1 部分失败。
 *
 * 只使用 _setup.ts 新建的临时库；不修改任何迁移 SQL 或 journal。
 */
import { afterEach, describe, expect, it } from 'vitest'
import * as coreTables from '../../src/db/schema/tables'
import { CORE_MIGRATIONS_TABLE, moduleMigrationsTable } from '../../src/db/migrations-table'
import { runMigrationStream, tablesFromSchema } from '../../src/scripts/lib/migration-streams'
import { applyMigrations, CORE_MIGRATIONS, moduleMigrations, resolveMigrationPlan } from './_migrations'
import { createTempDatabase, type TempDatabase } from './_setup'
import { hasModule } from '../_modules'

// 依赖 demo 模块的迁移；下游删除 demo 后整组跳过。
const enabled = process.env.YISHAN_RUN_INTEGRATION === '1' && hasModule('demo')

async function tableExists(db: TempDatabase, table: string): Promise<boolean> {
  const [rows] = await db.pool.query('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table])
  return (rows as unknown[]).length > 0
}

describe.runIf(enabled)('integration: module migrations vs core history (R-01)', () => {
  let db: TempDatabase | undefined
  afterEach(async () => {
    await db?.drop()
    db = undefined
  })

  it('FIXED R-01: core first, then demo, through the production migration streams → demo_todos exists', async () => {
    db = await createTempDatabase()
    await runMigrationStream(db.pool, {
      label: 'core',
      folder: CORE_MIGRATIONS,
      table: CORE_MIGRATIONS_TABLE,
      expectedTables: tablesFromSchema(coreTables),
    })
    await runMigrationStream(db.pool, {
      label: 'module demo',
      folder: moduleMigrations('demo'),
      table: moduleMigrationsTable('demo'),
      expectedTables: tablesFromSchema(await import('../../src/modules/demo/db/schema')),
    })
    expect(await tableExists(db, 'sys_user')).toBe(true)
    expect(await tableExists(db, 'demo_todos')).toBe(true)
  })

  it('root cause still reproduces if both streams share one history table (why the tables must stay separate)', async () => {
    db = await createTempDatabase()
    await applyMigrations(db.pool, resolveMigrationPlan(CORE_MIGRATIONS))
    await applyMigrations(db.pool, resolveMigrationPlan(moduleMigrations('demo')))
    expect(await tableExists(db, 'sys_user')).toBe(true)
    expect(await tableExists(db, 'demo_todos')).toBe(false)
  })

  it('control: module-then-core order on the shared table creates both core and demo tables', async () => {
    db = await createTempDatabase()
    await applyMigrations(db.pool, resolveMigrationPlan(moduleMigrations('demo')))
    await applyMigrations(db.pool, resolveMigrationPlan(CORE_MIGRATIONS))
    expect(await tableExists(db, 'sys_user')).toBe(true)
    expect(await tableExists(db, 'demo_todos')).toBe(true)
  })
})
