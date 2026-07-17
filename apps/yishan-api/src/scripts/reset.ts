import 'dotenv/config'
import { createHash } from 'node:crypto'
import { createPool } from 'mysql2/promise'
import { pool as drizzlePool } from '@/db'
import { collectMigrationPlan } from './migration-plan.js'
import { runSeed } from './seed/index.js'

/**
 * db:reset — 仅供开发环境使用。
 *
 * 流程：
 *   1) 校验 NODE_ENV（production 直接拒绝）
 *   2) DROP DATABASE → CREATE DATABASE
 *   3) 执行 Core + 插件的全量迁移计划
 *   4) 跑种子数据 runSeed
 *
 * 与 db:migrate / db:seed 的差异：先 DROP 整库重建，所有手工数据都会被清空。
 *
 * 默认不延迟。需要阻断式确认时设 RESET_CONFIRM_DELAY_MS=<ms>。
 */

function serverConfig() {
  return {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: decodeURIComponent(process.env.DATABASE_USER ?? 'root'),
    password: decodeURIComponent(process.env.DATABASE_PASSWORD ?? ''),
    multipleStatements: true,
  } as const
}

function dbName() {
  return process.env.DATABASE_NAME ?? 'yishan'
}

function guardDevEnv(): void {
  if (process.env.NODE_ENV === 'production') {
    console.error('')
    console.error('  ✖ db:reset 拒绝执行：NODE_ENV=production')
    console.error('    此脚本会 DROP 整个数据库，仅用于开发环境。')
    console.error('    如需在线上重建库，请走受控的迁移流程，不要用本脚本。')
    console.error('')
    process.exit(1)
  }
}

async function dropAndRecreate(): Promise<void> {
  const name = dbName()
  const charset = process.env.DATABASE_CHARSET ?? 'utf8mb4'
  const collation = process.env.DATABASE_COLLATION ?? 'utf8mb4_unicode_ci'

  // 不带 database 的连接，用于 server-level DDL
  const pool = createPool(serverConfig())
  try {
    console.log(`[reset] DROP DATABASE IF EXISTS \`${name}\``)
    await pool.query(`DROP DATABASE IF EXISTS \`${name}\``)
    console.log(
      `[reset] CREATE DATABASE \`${name}\` CHARACTER SET ${charset} COLLATE ${collation}`,
    )
    await pool.query(
      `CREATE DATABASE \`${name}\` CHARACTER SET ${charset} COLLATE ${collation}`,
    )
  } finally {
    await pool.end()
  }
}

async function runMigrations(): Promise<void> {
  const pool = createPool({ ...serverConfig(), database: dbName() })
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        hash VARCHAR(64) NOT NULL,
        applied_at DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
        PRIMARY KEY (id),
        UNIQUE KEY uniq_drizzle_migration_name (name)
      )
    `)

    const [appliedRows] = await pool.query(
      'SELECT name, hash FROM __drizzle_migrations',
    )
    const applied = new Map(
      (appliedRows as Array<{ name: string; hash: string }>).map((row) => [
        row.name,
        row.hash,
      ]),
    )
    const plan = collectMigrationPlan()

    for (const migration of plan) {
      const { id, sql } = migration
      const hash = createHash('sha256').update(sql).digest('hex')
      const previous = applied.get(id)

      if (previous) {
        if (previous !== hash) {
          throw new Error(`Migration ${id} was modified after being applied`)
        }
        continue
      }

      console.log(`[reset] Applying migration ${id}`)
      await pool.query(sql)
      await pool.query(
        'INSERT INTO __drizzle_migrations (name, hash) VALUES (?, ?)',
        [id, hash],
      )
    }
  } finally {
    await pool.end()
  }
}

async function confirmBeforeDrop(): Promise<void> {
  const env = process.env.NODE_ENV ?? '(未设置)'
  const delayMs = Number(process.env.RESET_CONFIRM_DELAY_MS ?? '0')

  console.warn('')
  console.warn('  ⚠️  db:reset 即将 DROP 整个数据库并重建')
  console.warn(`      目标库 : ${dbName()}`)
  console.warn(`      NODE_ENV: ${env}`)
  console.warn(`      所有数据（用户/菜单/订单/插件状态…）将被清空`)
  if (delayMs > 0) {
    console.warn(`      RESET_CONFIRM_DELAY_MS=${delayMs}，等待 ${delayMs}ms 后执行`)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  console.warn('')
}

/**
 * Rebuild the configured database from the checked-in migration plan and seed
 * it. The caller is responsible for an explicit production confirmation.
 */
export async function resetDatabaseAndSeed(): Promise<void> {
  await dropAndRecreate()
  console.log('[reset] database recreated')

  await runMigrations()
  console.log('[reset] migrations applied')

  await runSeed()
  console.log('[reset] seed completed')

  // runSeed 走的是 @/db 的全局 drizzlePool，必须显式 end，否则 Node 不会退出
  await drizzlePool.end()
  console.log('[reset] drizzle pool closed')

  console.log('')
  console.log(`  ✅ 数据库 ${dbName()} 已重置`)
  console.log('')
}

async function main(): Promise<void> {
  guardDevEnv()
  await confirmBeforeDrop()
  await resetDatabaseAndSeed()
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[reset] failed:', error)
    process.exit(1)
  })
}
