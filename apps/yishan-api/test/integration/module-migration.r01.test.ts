/**
 * R-01（P0 risks.md）：Core 与模块共用 `__drizzle_migrations`，drizzle migrator 只执行晚于
 * 历史表最大 created_at 的迁移；Core 先迁移时模块的 `0000_init` 被静默跳过且不报错。
 *
 * 断言写的是**正确行为**（模块表应当存在）。在 P4 修复迁移机制之前它必然失败，因此标记为
 * `it.fails`——当前失败即通过；一旦修复，`it.fails` 会转为失败，提醒同时删除这个标记。
 * 对照组证明失败只与执行顺序有关，而不是 SQL 本身不可执行。
 *
 * 只使用 _setup.ts 新建的临时库；不修改任何迁移 SQL 或 journal。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { applyMigrations, CORE_MIGRATIONS, moduleMigrations, resolveMigrationPlan } from './_migrations'
import { createTempDatabase, type TempDatabase } from './_setup'

const enabled = process.env.YISHAN_RUN_INTEGRATION === '1'

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

  describe('core first, then demo (the order CI and db:seed use)', () => {
    let coreFirst: TempDatabase
    beforeAll(async () => {
      coreFirst = await createTempDatabase()
    })
    afterAll(async () => {
      await coreFirst.drop()
    })

    it('both migrator runs complete without error and core tables exist', async () => {
      await applyMigrations(coreFirst.pool, resolveMigrationPlan(CORE_MIGRATIONS))
      await applyMigrations(coreFirst.pool, resolveMigrationPlan(moduleMigrations('demo')))
      expect(await tableExists(coreFirst, 'sys_user')).toBe(true)
    })

    // 只包含这一条断言，确保 it.fails 记录的是 R-01 本身，而不是其他异常。
    it.fails('BLOCKED BY R-01: demo_todos exists', async () => {
      expect(await tableExists(coreFirst, 'demo_todos')).toBe(true)
    })
  })

  it('control: module-then-core order creates both core and demo tables', async () => {
    db = await createTempDatabase()
    await applyMigrations(db.pool, resolveMigrationPlan(moduleMigrations('demo')))
    await applyMigrations(db.pool, resolveMigrationPlan(CORE_MIGRATIONS))
    expect(await tableExists(db, 'sys_user')).toBe(true)
    expect(await tableExists(db, 'demo_todos')).toBe(true)
  })
})
