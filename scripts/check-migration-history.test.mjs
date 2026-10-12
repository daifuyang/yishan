import { checkMigrationHistory } from './check-migration-history.mjs'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import test from 'node:test'

test('migration history refuses rewritten and missing published SQL', () => {
  const root = mkdtempSync(join(tmpdir(), 'yishan-sql-hash-'))
  try {
    const directory = join(root, 'packages/core/system-api/drizzle')
    mkdirSync(directory, { recursive: true })
    const path = join(directory, '0000_init.sql')
    const sql = 'CREATE TABLE sys_example (id int);\n'
    const baseline = { migrations: [{
      path: 'apps/yishan-api/drizzle/0000_init.sql',
      sha256: createHash('sha256').update(sql.replace(/\n/g, '\r\n')).digest('hex'),
      publishedSha256: createHash('sha256').update(sql).digest('hex'),
    }] }
    writeFileSync(path, sql)
    assert.deepEqual(checkMigrationHistory(root, baseline), [])
    writeFileSync(path, sql.replace(/\n/g, '\r\n'))
    assert.match(checkMigrationHistory(root, baseline)[0], /changed/)
    writeFileSync(path, sql + 'DROP TABLE sys_example;\n')
    assert.match(checkMigrationHistory(root, baseline)[0], /changed/)
    rmSync(path)
    assert.match(checkMigrationHistory(root, baseline)[0], /missing/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('migration history skips unpublished CRM SQL and journals', () => {
  const root = mkdtempSync(join(tmpdir(), 'yishan-sql-hash-'))
  try {
    const directory = join(root, 'packages/core/system-api/drizzle')
    mkdirSync(directory, { recursive: true })
    const sql = 'CREATE TABLE sys_example (id int);\n'
    writeFileSync(join(directory, '0000_init.sql'), sql)
    const baseline = {
      migrations: [
        {
          path: 'apps/yishan-api/drizzle/0000_init.sql',
          publishedSha256: createHash('sha256').update(sql).digest('hex'),
        },
        {
          path: 'apps/yishan-api/src/modules/crm/drizzle/0000_init.sql',
          publishedSha256: 'unused',
        },
      ],
      journals: [{
        path: 'apps/yishan-api/src/modules/crm/drizzle/meta/_journal.json',
        journal: { version: '7', dialect: 'mysql', entries: [] },
      }],
    }
    assert.deepEqual(checkMigrationHistory(root, baseline), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})
