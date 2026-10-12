import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from './runtime-fixture'

const drizzleDir = join(__dirname, '..', 'drizzle')

describe('0004_user-workbench-preference migration', () => {
  it('is registered after 0003 in the journal and creates both tables', () => {
    const journal = JSON.parse(readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf8'))
    const tags = journal.entries.map((e: { tag: string }) => e.tag)
    expect(tags).toContain('0004_user-workbench-preference')
    const entries = journal.entries as Array<{ idx: number; when: number; tag: string }>
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].idx).toBeGreaterThan(entries[i - 1].idx)
      expect(entries[i].when).toBeGreaterThan(entries[i - 1].when)
    }
    const sql = readFileSync(join(drizzleDir, '0004_user-workbench-preference.sql'), 'utf8')
    expect(sql).toMatch(/CREATE TABLE `sys_user_workbench_pin`/)
    expect(sql).toMatch(/CREATE TABLE `sys_user_workbench_usage`/)
    expect(sql).toMatch(/UNIQUE\(`user_id`,`workbench_menu_id`\)/)
  })
})
