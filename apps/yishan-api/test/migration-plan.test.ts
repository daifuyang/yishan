import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveMigrationPlan } from './integration/_migrations'
import { hasModule } from './_modules'

/**
 * 集成测试建库只按已记录的迁移历史执行（P0 R-05：旧装置执行目录下全部 SQL，
 * 未登记 journal 的重复 SQL 使所有集成测试无法运行）。
 */
describe('integration migration plan', () => {
  const dirs: string[] = []
  const folder = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'yishan-plan-'))
    dirs.push(dir)
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(dir, name, '..'), { recursive: true })
      writeFileSync(join(dir, name), content)
    }
    return dir
  }
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  const journal = (...tags: string[]) =>
    JSON.stringify({ version: '7', dialect: 'mysql', entries: tags.map((tag, idx) => ({ idx, version: '5', when: idx, tag, breakpoints: true })) })

  it('follows the journal and ignores SQL files it does not list', () => {
    const dir = folder({ '0000_init.sql': 'x', '0002_init.sql': 'y', '0010_unjournaled.sql': 'z', 'meta/_journal.json': journal('0000_init', '0002_init') })
    expect(resolveMigrationPlan(dir)).toMatchObject({ source: 'journal', tags: ['0000_init', '0002_init'] })
  })

  it('fails when a journal entry has no SQL file', () => {
    const dir = folder({ '0000_init.sql': 'x', 'meta/_journal.json': journal('0000_init', '0001_missing') })
    expect(() => resolveMigrationPlan(dir)).toThrow(/0001_missing/)
  })

  it('without a journal accepts exactly one committed SQL file', () => {
    expect(resolveMigrationPlan(folder({ '0000_init.sql': 'x' }))).toMatchObject({ source: 'single-file-without-journal', tags: ['0000_init'] })
  })

  it('without a journal refuses to guess an order for several SQL files', () => {
    expect(() => resolveMigrationPlan(folder({ '0000_init.sql': 'x', '0010_extra.sql': 'y' }))).toThrow(/ambiguous/)
  })

  it('the repository core history resolves from its committed journal', () => {
    expect(resolveMigrationPlan(join(process.cwd(), 'drizzle'))).toMatchObject({ source: 'journal', tags: ['0000_init'] })
  })

  it.runIf(hasModule('demo'))('the demo module history resolves', () => {
    expect(resolveMigrationPlan(join(process.cwd(), 'src', 'modules', 'demo', 'drizzle'))).toMatchObject({ source: 'journal', tags: ['0000_init'] })
  })
})
