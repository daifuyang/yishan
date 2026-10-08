/**
 * Source-First Goal D：迁移流（Core 一条、每个模块一条独立历史表）的真实数据库验证。
 *
 * 覆盖：空库完整初始化（Core 先于模块，即 R-01 的触发顺序）、重复执行幂等、多模块任意顺序互不干扰、
 * 迁移失败报错且不污染其他流、静默跳过被检测、结构核对、已部署库前置守卫、
 * sys_module_migration 按模块记账（M4）、已部署库衔接（copy / repair / adopt / review）、CLI 退出码。
 *
 * 只使用 _setup.ts 新建的临时库；夹具迁移写在系统临时目录，不修改仓库中的任何 SQL / journal。
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Pool } from 'mysql2/promise'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import * as coreTables from '../../src/db/schema/tables'
import { CORE_MIGRATIONS_TABLE, moduleMigrationsTable } from '../../src/db/migrations-table'
import {
  readHistoryHashes,
  recordModuleMigrations,
  runMigrationStream,
  tablesFromSchema,
  type MigrationStream,
} from '../../src/scripts/lib/migration-streams'
import { applyPlan, planModule } from '../../src/scripts/migrations-bridge'
import { applyMigrations, CORE_MIGRATIONS, moduleMigrations, resolveMigrationPlan } from './_migrations'
import { createTempDatabase, type TempDatabase } from './_setup'
import { hasModule } from '../_modules'

const enabled = process.env.YISHAN_RUN_INTEGRATION === '1'
// 用到仓库自带 demo 模块的用例；下游删除 demo 后只跳过这些，夹具用例照常运行。
const withDemo = hasModule('demo')
const itDemo = it.runIf(withDemo)
let demoSchema: Record<string, unknown> = {}

const coreStream = (): MigrationStream => ({
  label: 'core',
  folder: CORE_MIGRATIONS,
  table: CORE_MIGRATIONS_TABLE,
  expectedTables: tablesFromSchema(coreTables),
})
const demoStream = (): MigrationStream => ({
  label: 'module demo',
  folder: moduleMigrations('demo'),
  table: moduleMigrationsTable('demo'),
  expectedTables: tablesFromSchema(demoSchema),
})

const fixtureDirs: string[] = []
/** 在临时目录写一条迁移流：entries 依次为 [tag, when, sql]。 */
function fixtureStream(
  id: string,
  entries: [tag: string, when: number, sql: string][],
  expected: Record<string, string[]>,
): MigrationStream {
  const folder = mkdtempSync(join(tmpdir(), `yishan-fixture-${id}-`))
  fixtureDirs.push(folder)
  mkdirSync(join(folder, 'meta'))
  for (const [tag, , sql] of entries) writeFileSync(join(folder, `${tag}.sql`), sql)
  writeFileSync(
    join(folder, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'mysql',
      entries: entries.map(([tag, when], idx) => ({ idx, version: '5', when, tag, breakpoints: true })),
    }),
  )
  return { label: `module ${id}`, folder, table: moduleMigrationsTable(id), expectedTables: new Map(Object.entries(expected)) }
}

const createTable = (name: string, extra = '') =>
  `CREATE TABLE \`${name}\` (\`id\` int AUTO_INCREMENT NOT NULL, \`title\` varchar(64) NOT NULL${extra}, CONSTRAINT \`${name}_id\` PRIMARY KEY(\`id\`));`

async function tables(pool: Pool, like: string): Promise<string[]> {
  const [rows] = await pool.query(
    'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE ? ORDER BY 1',
    [like],
  )
  return (rows as { t: string }[]).map((r) => r.t)
}

async function count(pool: Pool, table: string): Promise<number> {
  const [rows] = await pool.query(`SELECT COUNT(*) AS n FROM \`${table}\``)
  return Number((rows as { n: number }[])[0].n)
}

describe.runIf(enabled)('integration: per-stream migration history (Goal D)', () => {
  let db: TempDatabase | undefined
  afterEach(async () => {
    await db?.drop()
    db = undefined
  })
  beforeAll(async () => {
    if (withDemo) demoSchema = await import('../../src/modules/demo/db/schema')
  })
  afterAll(() => {
    for (const dir of fixtureDirs) rmSync(dir, { recursive: true, force: true })
  })

  itDemo('empty database: core then demo (the R-01 order) creates every table; re-running is a no-op', async () => {
    db = await createTempDatabase()
    const core = await runMigrationStream(db.pool, coreStream())
    const demo = await runMigrationStream(db.pool, demoStream())
    expect(core.applied).toEqual(['0000_init'])
    expect(demo.applied).toEqual(['0000_init'])
    expect(demo.verifiedTables).toEqual(['demo_todos'])
    expect(await tables(db.pool, 'demo%')).toEqual(['demo_drizzle_migrations', 'demo_todos'])
    // 历史分离：Core 历史表只含 Core 的条目，模块的在自己的表里。
    expect(await count(db.pool, CORE_MIGRATIONS_TABLE)).toBe(1)
    expect(await count(db.pool, 'demo_drizzle_migrations')).toBe(1)

    const again = [await runMigrationStream(db.pool, coreStream()), await runMigrationStream(db.pool, demoStream())]
    expect(again.map((r) => r.applied)).toEqual([[], []])
    expect(await count(db.pool, CORE_MIGRATIONS_TABLE)).toBe(1)
    expect(await count(db.pool, 'demo_drizzle_migrations')).toBe(1)
  })

  it.each([
    ['core, alpha (newer), beta (older)', ['core', 'alpha', 'beta']],
    ['beta (older), alpha (newer), core', ['beta', 'alpha', 'core']],
  ])('modules do not skip each other regardless of order: %s', async (_name, order) => {
    db = await createTempDatabase()
    const streams: Record<string, MigrationStream> = {
      core: coreStream(),
      // alpha 的时间戳晚于 Core 与 beta；共享历史时 beta 会被跳过（P0 M3′）。
      alpha: fixtureStream('alpha', [['0000_init', 4_000_000_000_000, createTable('alpha_items')]], { alpha_items: ['id', 'title'] }),
      beta: fixtureStream('beta', [['0000_init', 1_000, createTable('beta_items')]], { beta_items: ['id', 'title'] }),
    }
    for (const key of order) await runMigrationStream(db.pool, streams[key])
    expect(await tables(db.pool, 'alpha_items')).toEqual(['alpha_items'])
    expect(await tables(db.pool, 'beta_items')).toEqual(['beta_items'])
    expect(await tables(db.pool, 'sys_user')).toEqual(['sys_user'])
  })

  itDemo('a failing migration throws, is not recorded, and does not disturb other streams', async () => {
    db = await createTempDatabase()
    const bad = fixtureStream('broken', [['0000_init', 2_000, 'CREATE TABLE `broken_items` (`id` int NOT NULL, BOGUS);']], { broken_items: ['id'] })
    await expect(runMigrationStream(db.pool, bad)).rejects.toThrow()
    expect((await readHistoryHashes(db.pool, bad.table)).size).toBe(0)
    const good = await runMigrationStream(db.pool, demoStream())
    expect(good.applied).toEqual(['0000_init'])
  })

  it('detects a migration the migrator silently skipped (non-monotonic journal)', async () => {
    db = await createTempDatabase()
    const v1 = fixtureStream('gamma', [['0000_init', 5_000, createTable('gamma_items')]], { gamma_items: ['id', 'title'] })
    await runMigrationStream(db.pool, v1)
    // 后加的迁移时间戳早于已执行的 0000 → drizzle 不执行它；必须报错而不是“成功”。
    const v2 = fixtureStream(
      'gamma',
      [
        ['0000_init', 5_000, createTable('gamma_items')],
        ['0001_more', 4_000, 'ALTER TABLE `gamma_items` ADD `note` varchar(32);'],
      ],
      { gamma_items: ['id', 'title', 'note'] },
    )
    await expect(runMigrationStream(db.pool, v2)).rejects.toThrow(/0001_more is not recorded/)
  })

  it('verifies the real table structure after migrating', async () => {
    db = await createTempDatabase()
    const drift = fixtureStream('delta', [['0000_init', 2_000, createTable('delta_items')]], {
      delta_items: ['id', 'title', 'missing_col'],
    })
    await expect(runMigrationStream(db.pool, drift)).rejects.toThrow(/delta_items\.missing_col/)
  })

  itDemo('refuses to migrate a database whose tables predate the per-module history (needs bridge)', async () => {
    db = await createTempDatabase()
    await db.pool.query(createTable('demo_todos'))
    await expect(runMigrationStream(db.pool, demoStream())).rejects.toThrow(/db:migrations:bridge/)
  })

  it('sys_module_migration is recorded per module even when tags collide (M4)', async () => {
    db = await createTempDatabase()
    await runMigrationStream(db.pool, coreStream())
    expect(await recordModuleMigrations(db.pool, 'demo', ['0000_init'])).toBe(1)
    expect(await recordModuleMigrations(db.pool, 'other', ['0000_init'])).toBe(1)
    expect(await recordModuleMigrations(db.pool, 'demo', ['0000_init'])).toBe(0)
    const [rows] = await db.pool.query('SELECT module_id, hash FROM sys_module_migration ORDER BY module_id')
    expect(rows).toEqual([
      { module_id: 'demo', hash: '0000_init' },
      { module_id: 'other', hash: '0000_init' },
    ])
  })

  describe.runIf(withDemo)('bridging databases created with the shared history (deployed-database rehearsal)', () => {
    it('copy-from-shared: legacy module-first database is bridged without touching old rows', async () => {
      db = await createTempDatabase()
      // 旧机制：demo 与 Core 共用 __drizzle_migrations（模块先于 Core，表都存在）。
      await applyMigrations(db.pool, resolveMigrationPlan(moduleMigrations('demo')))
      await applyMigrations(db.pool, resolveMigrationPlan(CORE_MIGRATIONS))
      const sharedBefore = await readHistoryHashes(db.pool, CORE_MIGRATIONS_TABLE)

      await expect(runMigrationStream(db.pool, demoStream())).rejects.toThrow(/bridge/)
      const plan = await planModule(db.pool, 'demo', demoStream())
      expect(plan.status).toBe('copy-from-shared')
      expect(await applyPlan(db.pool, plan)).toBe(1)
      expect(await applyPlan(db.pool, await planModule(db.pool, 'demo', demoStream()))).toBe(0)

      const after = await runMigrationStream(db.pool, demoStream())
      expect(after.applied).toEqual([])
      expect(await readHistoryHashes(db.pool, CORE_MIGRATIONS_TABLE)).toEqual(sharedBefore)
      const own = await readHistoryHashes(db.pool, 'demo_drizzle_migrations')
      for (const [hash, createdAt] of own) expect(sharedBefore.get(hash)).toBe(createdAt)
      expect((await planModule(db.pool, 'demo', demoStream())).status).toBe('up-to-date')
    })

    it('fresh: legacy core-first database (demo silently skipped, R-01) is repaired by a normal migrate', async () => {
      db = await createTempDatabase()
      await applyMigrations(db.pool, resolveMigrationPlan(CORE_MIGRATIONS))
      await applyMigrations(db.pool, resolveMigrationPlan(moduleMigrations('demo')))
      expect(await tables(db.pool, 'demo_todos')).toEqual([])
      expect((await planModule(db.pool, 'demo', demoStream())).status).toBe('fresh')
      expect((await runMigrationStream(db.pool, demoStream())).applied).toEqual(['0000_init'])
    })

    it('repair-by-migrate: hash recorded in the shared table but tables missing (M5)', async () => {
      db = await createTempDatabase()
      await applyMigrations(db.pool, resolveMigrationPlan(moduleMigrations('demo')))
      await db.pool.query('DROP TABLE demo_todos')
      expect((await planModule(db.pool, 'demo', demoStream())).status).toBe('repair-by-migrate')
      expect((await runMigrationStream(db.pool, demoStream())).applied).toEqual(['0000_init'])
    })

    it('adopt-candidate: tables created outside drizzle (apply-drizzle-sql) are only adopted on request', async () => {
      db = await createTempDatabase()
      await applyMigrations(db.pool, resolveMigrationPlan(CORE_MIGRATIONS))
      const sql = (await import('node:fs')).readFileSync(join(moduleMigrations('demo'), '0000_init.sql'), 'utf8')
      for (const stmt of sql.split('--> statement-breakpoint')) if (stmt.trim()) await db.pool.query(stmt)
      const plan = await planModule(db.pool, 'demo', demoStream())
      expect(plan.status).toBe('adopt-candidate')
      await applyPlan(db.pool, plan)
      expect((await runMigrationStream(db.pool, demoStream())).applied).toEqual([])
    })

    it('accepts the CRLF hash variant recorded by databases migrated from Windows checkouts', async () => {
      db = await createTempDatabase()
      await runMigrationStream(db.pool, coreStream())
      const sql = (await import('node:fs')).readFileSync(join(moduleMigrations('demo'), '0000_init.sql'), 'utf8').replace(/\r\n/g, '\n')
      for (const stmt of sql.split('--> statement-breakpoint')) if (stmt.trim()) await db.pool.query(stmt)
      const crlfHash = createHash('sha256').update(sql.replace(/\n/g, '\r\n')).digest('hex')
      await db.pool.query('INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)', [crlfHash, 1784622315878])
      const plan = await planModule(db.pool, 'demo', demoStream())
      expect(plan.status).toBe('copy-from-shared')
      expect(plan.rows.map((r) => r.hash)).toEqual([crlfHash])
      await applyPlan(db.pool, plan)
      expect((await runMigrationStream(db.pool, demoStream())).applied).toEqual([])
    })

    it('needs-review: partially present structure is reported, never auto-registered', async () => {
      db = await createTempDatabase()
      await db.pool.query(createTable('demo_todos'))
      expect((await planModule(db.pool, 'demo', demoStream())).status).toBe('needs-review')
    })
  })

  describe.runIf(withDemo && existsSync(join(process.cwd(), 'dist', 'scripts', 'migrate.js')))('CLI exit codes (dist build)', () => {
    const run = (script: string, url: string, args: string[] = []) =>
      spawnSync(process.execPath, [join('dist', 'scripts', script), ...args], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: url },
        encoding: 'utf8',
      })

    it('migrate.js exits 0 on success and 1 when a stream fails; bridge exits 3 when review is needed', async () => {
      db = await createTempDatabase()
      const ok = run('migrate.js', db.url)
      expect(ok.status, ok.stderr).toBe(0)
      expect(await tables(db.pool, 'demo_todos')).toEqual(['demo_todos'])
      expect(run('migrate.js', db.url).status).toBe(0)

      await db.recreate()
      await db.pool.query(createTable('demo_todos'))
      const guarded = run('migrate.js', db.url, ['--modules-only'])
      expect(guarded.status).toBe(1)
      expect(guarded.stderr).toMatch(/bridge/)
      const review = run('migrations-bridge.js', db.url)
      expect(review.status).toBe(3)
      expect(review.stdout).toMatch(/demo: needs-review/)
    })
  })
})
