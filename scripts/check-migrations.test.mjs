import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { collectProblems } from './check-migrations.mjs'

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'yishan-migrations-'))
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), content)
  }
  return root
}
const journal = (entries) => JSON.stringify({ entries: entries.map(([tag, when], idx) => ({ idx, when, tag })) })
const sha = (s) => createHash('sha256').update(s).digest('hex')
const API = 'apps/yishan-api'

test('a consistent layout passes, CRLF working copies hash like LF', () => {
  const root = fixture({
    [`${API}/drizzle.config.ts`]: 'migrations: { table: CORE_MIGRATIONS_TABLE },',
    [`${API}/drizzle/0000_init.sql`]: 'CREATE TABLE a;\r\n',
    [`${API}/drizzle/meta/_journal.json`]: journal([['0000_init', 1]]),
    [`${API}/src/modules/demo/drizzle.config.ts`]: "migrations: { table: moduleMigrationsTable('demo') },",
    [`${API}/src/modules/demo/drizzle/0000_init.sql`]: 'CREATE TABLE demo_a;\n',
    [`${API}/src/modules/demo/drizzle/meta/_journal.json`]: journal([['0000_init', 1]]),
  })
  try {
    const baseline = { files: { [`${API}/drizzle/0000_init.sql`]: sha('CREATE TABLE a;\n'), [`${API}/src/modules/demo/drizzle/0000_init.sql`]: sha('CREATE TABLE demo_a;\n') } }
    assert.deepEqual(collectProblems(root, baseline).problems, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('reports every rule', () => {
  const root = fixture({
    [`${API}/drizzle.config.ts`]: 'export default {}',
    [`${API}/drizzle/0000_init.sql`]: 'CREATE TABLE a; -- edited',
    [`${API}/drizzle/0010_orphan.sql`]: 'CREATE TABLE b;',
    [`${API}/drizzle/meta/_journal.json`]: journal([['0000_init', 5], ['0001_late', 4]]),
    [`${API}/src/modules/demo/drizzle.config.ts`]: "migrations: { table: moduleMigrationsTable('other') },",
    [`${API}/src/modules/demo/drizzle/0000_init.sql`]: 'CREATE TABLE demo_a;',
  })
  try {
    const baseline = { files: { [`${API}/drizzle/0000_init.sql`]: sha('CREATE TABLE a;'), [`${API}/drizzle/0002_gone.sql`]: sha('x') } }
    assert.deepEqual(collectProblems(root, baseline).problems, [
      `history-table|${API}/drizzle.config.ts`,
      `history-table|${API}/src/modules/demo/drizzle.config.ts`,
      `journal-missing|${API}/src/modules/demo/drizzle`,
      `journal-order|${API}/drizzle|0000_init -> 0001_late`,
      `journal-without-sql|${API}/drizzle|0001_late`,
      `published-sql-changed|${API}/drizzle/0000_init.sql`,
      `published-sql-removed|${API}/drizzle/0002_gone.sql`,
      `sql-not-in-journal|${API}/drizzle/0010_orphan.sql`,
      `unrecorded-sql|${API}/drizzle/0010_orphan.sql`,
      `unrecorded-sql|${API}/src/modules/demo/drizzle/0000_init.sql`,
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
