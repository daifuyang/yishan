/**
 * migrate.ts — 执行 Core 与模块迁移（每条流独立历史表，执行后核对历史与表结构）。
 *
 *   pnpm --filter yishan-api db:migrate:all              # Core + 全部已打包模块
 *   pnpm --filter yishan-api db:migrate:modules [id...]  # 只迁移模块（全部或指定）
 *
 * 任一流失败 → 退出码 1（其余流仍会尝试，便于一次看到全部问题）。
 * 不会被应用启动自动调用；生产库只能由运维显式执行。
 */
import 'dotenv/config'
import { join } from 'node:path'
import { pool } from '../db/client.js'
import { recordModuleMigrations, runMigrationStream, type StreamResult } from './lib/migration-streams.js'
import { coreStream, moduleStream, packedModules, rootsFromDist } from './lib/streams.js'

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const modulesOnly = args.includes('--modules-only')
  const ids = args.filter((a) => !a.startsWith('--'))
  const roots = rootsFromDist(join(__dirname, '..'))
  let failures = 0

  const report = (r: StreamResult) =>
    console.log(
      `[migrate] ${r.label}: ${r.applied.length > 0 ? `applied ${r.applied.join(', ')}` : 'up to date'}` +
        ` (history \`${r.table}\`, ${r.recorded.length} recorded, ${r.verifiedTables.length} table(s) verified)`,
    )

  if (!modulesOnly) {
    try {
      report(await runMigrationStream(pool, coreStream(roots)))
    } catch (err) {
      failures++
      console.error(`[migrate] core FAILED: ${(err as Error).message}`)
    }
  }

  for (const meta of await packedModules(roots, ids)) {
    try {
      const stream = moduleStream(roots, meta)
      if (!stream) {
        console.log(`[migrate] module ${meta.id}: no drizzle/ folder, skipped`)
        continue
      }
      const result = await runMigrationStream(pool, stream)
      report(result)
      const recorded = await recordModuleMigrations(pool, meta.id, result.recorded)
      if (recorded > 0) console.log(`[migrate] module ${meta.id}: sys_module_migration +${recorded}`)
    } catch (err) {
      failures++
      console.error(`[migrate] module ${meta.id} FAILED: ${(err as Error).message}`)
    }
  }
  return failures
}

main()
  .then((failures) => {
    if (failures > 0) {
      console.error(`[migrate] ${failures} stream(s) failed`)
      process.exitCode = 1
    }
  })
  .catch((err) => {
    console.error('[migrate] aborted:', err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
