import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationDirectory = join(__dirname, '../drizzle')

describe('System migration baseline', () => {
  it('keeps the complete System schema in one initial migration', () => {
    const journal = JSON.parse(readFileSync(join(migrationDirectory, 'meta/_journal.json'), 'utf8'))
    expect(journal.entries).toHaveLength(1)
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
    expect(existsSync(join(migrationDirectory, '0002_init.sql'))).toBe(false)
    expect(existsSync(join(migrationDirectory, '0003_workbench-menu.sql'))).toBe(false)
    expect(existsSync(join(migrationDirectory, '0004_user-workbench-preference.sql'))).toBe(false)
    expect(existsSync(join(migrationDirectory, '0005_role-dept.sql'))).toBe(false)
    expect(existsSync(join(migrationDirectory, '0010_create-sys-enum.sql'))).toBe(false)
  })
})
