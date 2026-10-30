import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from './runtime-fixture'

const drizzleDir = join(__dirname, '..', 'drizzle')

describe('System migration baseline', () => {
  it('includes the user workbench tables and their uniqueness constraint', () => {
    const journal = JSON.parse(readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf8'))
    const tags = journal.entries.map((e: { tag: string }) => e.tag)
    // 只要求 init 在首位；后续允许存量表的结构增量（见 migration-baseline.test.ts 的说明）。
    expect(tags[0]).toBe('0000_init')
    const sql = readFileSync(join(drizzleDir, '0000_init.sql'), 'utf8')
    expect(sql).toMatch(/CREATE TABLE `sys_user_workbench_pin`/)
    expect(sql).toMatch(/CREATE TABLE `sys_user_workbench_usage`/)
    expect(sql).toMatch(/UNIQUE\(`user_id`,`workbench_menu_id`\)/)
  })
})
