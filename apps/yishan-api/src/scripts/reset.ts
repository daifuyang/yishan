import 'dotenv/config'
import { execSync } from 'node:child_process'
import { createPool } from 'mysql2/promise'
import { pool as drizzlePool } from '@/db'
import { runSeed } from './seed/index.js'

/**
 * db:reset — 仅供开发环境使用。
 *
 * 流程：
 *   1) 校验 NODE_ENV（production 直接拒绝）
 *   2) DROP DATABASE → CREATE DATABASE
 *   3) 调 `drizzle-kit migrate` 应用全量迁移（标准 drizzle-kit journal）
 *   4) 跑种子数据 runSeed
 *
 * 与 db:migrate / db:seed 的差异：先 DROP 整库重建，所有手工数据都会被清空。
 *
 * 默认不延迟。需要阻断式确认时设 RESET_CONFIRM_DELAY_MS=<ms>。
 * 需要在 CI 自动跳过交互时设 RESET_CONFIRM_NONINTERACTIVE=1。
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

function runMigrations(): void {
  console.log('[reset] drizzle-kit migrate')
  execSync('npx drizzle-kit migrate', { stdio: 'inherit' })
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
 * Rebuild the configured database from the checked-in drizzle migrations and
 * seed it. The caller is responsible for an explicit production confirmation.
 */
export async function resetDatabaseAndSeed(): Promise<void> {
  await dropAndRecreate()
  console.log('[reset] database recreated')

  runMigrations()
  console.log('[reset] migrations applied')

  await runSeed()
  console.log('[reset] seed completed')

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