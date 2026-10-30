import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationDirectory = join(__dirname, '../drizzle')

/**
 * System 的迁移基线。
 *
 * 原断言是「journal 里只允许 0000_init 一条」。本 fork 新增了
 * `0001_legacy_password`（给 sys_user 补历史密码格式两列 + 放开 phone 可空），
 * 属于**存量表的结构增量**，不能回填进 init —— 已上线的库不会重跑 init。
 *
 * 所以把守卫换成更精确的规则，而不是简单删掉：
 *   - 0000_init 必须是第一条，且包含全部 32 张表；
 *   - 0000_init 之后的迁移只允许 ALTER / DROP / CREATE INDEX 类增量，
 *     **不允许再 CREATE TABLE** —— 新表必须回填进 init，避免 schema 碎片化。
 */
describe('System migration baseline', () => {
  it('keeps the complete System schema in one initial migration', () => {
    const journal = JSON.parse(readFileSync(join(migrationDirectory, 'meta/_journal.json'), 'utf8'))
    expect(journal.entries[0].tag).toBe('0000_init')

    const sql = readFileSync(join(migrationDirectory, '0000_init.sql'), 'utf8')
    expect(sql.match(/CREATE TABLE `/g)).toHaveLength(32)
    for (const table of [
      'sys_user',
      'sys_enum',
      'sys_workbench_menu',
      'sys_role_workbench_menu',
      'sys_user_workbench_pin',
      'sys_user_workbench_usage',
      'sys_role_dept',
    ]) {
      expect(sql).toContain(`CREATE TABLE \`${table}\``)
    }
    expect(sql.match(/CREATE TABLE `sys_enum`/g)).toHaveLength(1)

    for (const entry of journal.entries.slice(1) as Array<{ tag: string }>) {
      const incremental = readFileSync(join(migrationDirectory, `${entry.tag}.sql`), 'utf8')
      expect(incremental, `${entry.tag} 不应创建新表：新表请回填进 0000_init`).not.toMatch(/CREATE TABLE/i)
    }

    expect(existsSync(join(migrationDirectory, '0002_init.sql'))).toBe(false)
    expect(existsSync(join(migrationDirectory, '0003_workbench-menu.sql'))).toBe(false)
    expect(existsSync(join(migrationDirectory, '0004_user-workbench-preference.sql'))).toBe(false)
    expect(existsSync(join(migrationDirectory, '0005_role-dept.sql'))).toBe(false)
    expect(existsSync(join(migrationDirectory, '0010_create-sys-enum.sql'))).toBe(false)
  })
})
