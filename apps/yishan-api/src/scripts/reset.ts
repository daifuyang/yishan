import 'dotenv/config'
import { execSync, spawnSync } from 'node:child_process'
import { createPool } from 'mysql2/promise'
import { pool as drizzlePool } from '@/db'

/**
 * db:reset — 仅供开发环境使用。
 *
 * 流程：
 *   1) 校验 NODE_ENV（production 直接拒绝）
 *   2) DROP DATABASE → CREATE DATABASE
 *   3) 调 `drizzle-kit migrate` 应用全量迁移（标准 drizzle-kit journal）
 *   4) spawn 子进程跑 `node dist/scripts/seed/index.js` —— 必须独立进程,
 *      否则 @/db 的 singleton pool 在 DROP 后持有的旧连接会被复用,
 *      导致 seed 阶段 "Unknown database" 报错。
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

  // 必须分两个 pool：DROP 完一个 pool 立即 end，库里残留的连接仍然
  // 引用被删的库；CREATE 必须用一个全新的 pool 才能拿到干净的连接。
  console.log(`[reset] DROP DATABASE IF EXISTS \`${name}\``)
  const dropPool = createPool(serverConfig())
  try {
    await dropPool.query(`DROP DATABASE IF EXISTS \`${name}\``)
  } finally {
    await dropPool.end().catch(() => {})
  }

  console.log(
    `[reset] CREATE DATABASE \`${name}\` CHARACTER SET ${charset} COLLATE ${collation}`,
  )
  const createPool_ = createPool(serverConfig())
  try {
    await createPool_.query(
      `CREATE DATABASE \`${name}\` CHARACTER SET ${charset} COLLATE ${collation}`,
    )
  } finally {
    await createPool_.end().catch(() => {})
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

  // Drizzle 顶层 pool 里残留的旧连接已经指向被删的库。
  // mysql2 pool 在第一次失败时自动重连；不需要手动 end。
  runMigrations()
  console.log('[reset] migrations applied')

  // 必须在独立进程里跑 seed：当前进程 import 的 @/db pool 是 DROP 之前创建的
  // singleton,缓存的连接指向已删除的库;即使 CREATE 了同名库,那些连接也不会
  // 重新做 USE 语句,会继续指向不存在的库,导致 "Unknown database" 报错。
  console.log('[reset] spawn seed 子进程...')
  const result = spawnSync(process.execPath, ['dist/scripts/seed/index.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'development' },
  })
  if (result.status !== 0) {
    throw new Error(`seed 子进程退出码 ${result.status}`)
  }
  console.log('[seed] seed completed')

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