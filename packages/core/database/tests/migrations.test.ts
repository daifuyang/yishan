import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { Pool } from 'mysql2/promise'
import { inspectLegacyMigrationHistory, reconcileLegacyMigrationHistory, inspectMigrationHistory, migrateDatabase, readMigrationPlan } from '../src/index.js'

const folders: string[] = []
interface JournalEntry { idx: number; when: number; tag: string; breakpoints: boolean }
function folder(entries: JournalEntry[] = [{ idx: 0, when: 1000, tag: '0000_init', breakpoints: true }], contents?: string[]) {
  const path = mkdtempSync(join(tmpdir(), 'core-database-'))
  folders.push(path)
  mkdirSync(join(path, 'meta'))
  writeFileSync(join(path, 'meta', '_journal.json'), JSON.stringify({ version: '7', dialect: 'mysql', entries }))
  entries.forEach((entry, index) => writeFileSync(join(path, `${entry.tag}.sql`), contents?.[index] ?? `SELECT ${index + 1};`))
  return path
}

interface FakeHistory { id: number; hash: string; created_at: number | string }
function fakeDatabase(histories: Record<string, FakeHistory[]> = {}, tables: string[] = [], failSql?: string, failRelease = false) {
  const writes: string[] = []
  const queries: Array<{ sql: string; values: unknown[] }> = []
  const presentTables = new Set([...tables, ...Object.keys(histories)])
  const release = vi.fn()
  const destroy = vi.fn()
  const query = async (options: { sql: string }, values: unknown[] = []): Promise<[unknown, never[]]> => {
    const statement = options.sql
    queries.push({ sql: statement, values })
    if (/SELECT DATABASE\(\)/i.test(statement)) return [[{ databaseName: 'unit_test' }], []]
    if (/GET_LOCK/i.test(statement)) return [[{ acquired: 1 }], []]
    if (/RELEASE_LOCK/i.test(statement)) {
      if (failRelease) throw new Error('lock release failed')
      return [[{ released: 1 }], []]
    }
    if (/information_schema\.tables/i.test(statement)) return [presentTables.has(String(values.at(-1))) ? [{ tableName: values.at(-1) }] : [], []]
    const history = /FROM `(__drizzle_migrations[^`]*?)`/i.exec(statement)?.[1]
    if (history) {
      if (!(history in histories)) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' })
      return [histories[history], []]
    }
    writes.push(statement)
    if (statement.includes(failSql ?? '\0')) throw new Error('fixture migration failed')
    const historyTable = /CREATE TABLE IF NOT EXISTS `(__drizzle_migrations[^`]*?)`/i.exec(statement)?.[1]
    if (historyTable) { histories[historyTable] ??= []; presentTables.add(historyTable) }
    const insertTable = /INSERT INTO `(__drizzle_migrations[^`]*?)`/i.exec(statement)?.[1]
    if (insertTable) histories[insertTable].push({ id: histories[insertTable].length + 1, hash: String(values[0]), created_at: Number(values[1]) })
    return [[], []]
  }
  const pool = { query, getConnection: async () => ({ query, release, destroy }) } as unknown as Pool
  return { db: drizzle(pool, { schema: {}, mode: 'default' }), writes, histories, queries, release, destroy }
}

afterEach(() => { for (const path of folders.splice(0)) rmSync(path, { recursive: true, force: true }) })
const selectOneHash = '17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a'
const entries = [
  { idx: 0, when: 2000, tag: '0000_init', breakpoints: true },
  { idx: 2, when: 1000, tag: '0001_update', breakpoints: true },
]

function publishedFolder() {
  const content = 'SELECT 1;\n'
  const path = folder(undefined, [content])
  const hash = createHash('sha256').update(content).digest('hex')
  const windowsHash = createHash('sha256').update(content.replace(/\n/g, '\r\n')).digest('hex')
  const metadata = { version: 1, commit: 'a'.repeat(40), migrations: { '0000_init': { sha256: hash, windowsSha256: windowsHash } } }
  writeFileSync(join(path, 'meta', '_published-hashes.json'), JSON.stringify(metadata))
  return { path, hash, windowsHash, metadata }
}

describe('published migration byte identities', () => {
  it.each(['canonical', 'windows'] as const)('recognizes %s history without replaying or rewriting it', async (variant) => {
    const published = publishedFolder()
    const rows = [{ id: 1, hash: variant === 'windows' ? published.windowsHash : published.hash, created_at: 1000 }]
    const fixture = fakeDatabase({ __drizzle_migrations: [...rows] })
    await migrateDatabase(fixture.db, [{ id: 'core', folder: published.path, historyTable: '__drizzle_migrations' }])
    expect(fixture.histories.__drizzle_migrations).toEqual(rows)
    expect(fixture.writes).toEqual([])
  })
  it('does not infer Windows compatibility for migrations without published metadata', async () => {
    const published = publishedFolder()
    rmSync(join(published.path, 'meta', '_published-hashes.json'))
    const fixture = fakeDatabase({ __drizzle_migrations: [{ id: 1, hash: published.windowsHash, created_at: 1000 }] })
    await expect(migrateDatabase(fixture.db, [{ id: 'core', folder: published.path, historyTable: '__drizzle_migrations' }])).rejects.toThrow(/hash|ownership/i)
    expect(fixture.writes).toEqual([])
  })
  it('rejects an unknown third hash even with published Windows compatibility', async () => {
    const published = publishedFolder()
    const fixture = fakeDatabase({ __drizzle_migrations: [{ id: 1, hash: 'f'.repeat(64), created_at: 1000 }] })
    await expect(migrateDatabase(fixture.db, [{ id: 'core', folder: published.path, historyTable: '__drizzle_migrations' }])).rejects.toThrow(/hash|ownership/i)
    expect(fixture.writes).toEqual([])
  })
  it('recognizes only the explicitly audited mixed newline positions', async () => {
    const content = 'SELECT 1;\nSELECT 2;\n'
    const path = folder(undefined, [content])
    const canonical = createHash('sha256').update(content).digest('hex')
    const mixed = createHash('sha256').update('SELECT 1;\nSELECT 2;\r\n').digest('hex')
    const fullWindows = createHash('sha256').update(content.replace(/\n/g, '\r\n')).digest('hex')
    writeFileSync(join(path, 'meta', '_published-hashes.json'), JSON.stringify({ version: 1, commit: 'a'.repeat(40), migrations: {
      '0000_init': { sha256: canonical, windowsSha256: mixed, windowsCrLfLines: [2] },
    } }))
    const manifests = [{ id: 'core', folder: path, historyTable: '__drizzle_migrations' }]
    const fixture = fakeDatabase({ __drizzle_migrations: [{ id: 1, hash: mixed, created_at: 1000 }] })
    await migrateDatabase(fixture.db, manifests)
    await migrateDatabase(fixture.db, manifests)
    expect(fixture.writes).toEqual([])
    fixture.histories.__drizzle_migrations[0].hash = fullWindows
    await expect(migrateDatabase(fixture.db, manifests)).rejects.toThrow(/hash|ownership/i)
    expect(fixture.writes).toEqual([])
  })
  it('records the canonical published hash for newly executed SQL', async () => {
    const published = publishedFolder()
    const fixture = fakeDatabase()
    await migrateDatabase(fixture.db, [{ id: 'core', folder: published.path, historyTable: '__drizzle_migrations' }])
    await migrateDatabase(fixture.db, [{ id: 'core', folder: published.path, historyTable: '__drizzle_migrations' }])
    expect(fixture.histories.__drizzle_migrations).toEqual([{ id: 1, hash: published.hash, created_at: 1000 }])
    expect(fixture.writes.filter(statement => statement.startsWith('SELECT'))).toEqual(['SELECT 1'])
  })
  it.each(['sql', 'variant'] as const)('rejects changed published %s before writes', async (changed) => {
    const published = publishedFolder()
    if (changed === 'sql') writeFileSync(join(published.path, '0000_init.sql'), 'SELECT 2;\n')
    else {
      published.metadata.migrations['0000_init'].windowsSha256 = 'f'.repeat(64)
      writeFileSync(join(published.path, 'meta', '_published-hashes.json'), JSON.stringify(published.metadata))
    }
    const fixture = fakeDatabase()
    await expect(migrateDatabase(fixture.db, [{ id: 'core', folder: published.path, historyTable: '__drizzle_migrations' }])).rejects.toThrow(/published|hash/i)
    expect(fixture.writes).toEqual([])
  })
  it('copies the original Windows history hash during explicit reconciliation', async () => {
    const published = publishedFolder()
    const rows = [{ id: 1, hash: published.windowsHash, created_at: 1000 }]
    const fixture = fakeDatabase({ __drizzle_migrations: [...rows] })
    const manifests = [
      { id: 'core', folder: folder(undefined, ['SELECT 2;']), historyTable: '__drizzle_migrations' },
      { id: 'crm', folder: published.path, historyTable: '__drizzle_migrations_crm' },
    ]
    await reconcileLegacyMigrationHistory(fixture.db, manifests)
    expect(fixture.histories.__drizzle_migrations).toEqual(rows)
    expect(fixture.histories.__drizzle_migrations_crm).toEqual(rows)
    fixture.writes.splice(0)
    await migrateDatabase(fixture.db, manifests)
    expect(fixture.writes.filter(statement => statement.startsWith('SELECT'))).toEqual(['SELECT 2'])
    expect(fixture.histories.__drizzle_migrations_crm).toEqual(rows)
  })
})

describe('readMigrationPlan', () => {
  it('reads ordered SQL and independently identifiable hashes and timestamps', () => {
    const [plan] = readMigrationPlan([{ id: 'core', folder: folder(), historyTable: '__drizzle_migrations' }])
    expect(plan.migrations[0]).toMatchObject({ index: 0, tag: '0000_init', timestamp: 1000, hash: selectOneHash })
  })
  it('fails when journal or SQL is missing before any migration can run', () => {
    const path = folder()
    rmSync(join(path, '0000_init.sql'))
    expect(() => readMigrationPlan([{ id: 'core', folder: path, historyTable: '__drizzle_migrations' }])).toThrow(/SQL|file/i)
    rmSync(join(path, 'meta', '_journal.json'))
    expect(() => readMigrationPlan([{ id: 'core', folder: path, historyTable: '__drizzle_migrations' }])).toThrow(/journal/i)
  })
  it('keeps non-monotonic legacy timestamps unchanged and orders by journal index', () => {
    const [plan] = readMigrationPlan([{ id: 'crm', folder: folder(entries), historyTable: '__drizzle_migrations_crm' }])
    expect(plan.migrations.map(({ index, timestamp }) => [index, timestamp])).toEqual([[0, 2000], [2, 1000]])
  })
  it('rejects multiple manifests claiming the shared history', () => {
    expect(() => readMigrationPlan([
      { id: 'core', folder: folder(), historyTable: '__drizzle_migrations' },
      { id: 'crm', folder: folder(), historyTable: '__drizzle_migrations' },
    ])).toThrow(/history/i)
  })
  it('rejects invalid JSON and unsafe SQL tags', () => {
    const path = folder()
    writeFileSync(join(path, 'meta', '_journal.json'), '{')
    expect(() => readMigrationPlan([{ id: 'core', folder: path, historyTable: '__drizzle_migrations' }])).toThrow(/journal/i)
    writeFileSync(join(path, 'meta', '_journal.json'), JSON.stringify({ dialect: 'mysql', entries: [{ idx: 0, when: 1000, tag: '../outside', breakpoints: true }] }))
    expect(() => readMigrationPlan([{ id: 'core', folder: path, historyTable: '__drizzle_migrations' }])).toThrow(/tag/i)
  })
  it.each(['index', 'timestamp', 'tag', 'hash'] as const)('rejects duplicate migration %s identities', (duplicate) => {
    const path = folder([
      { idx: 0, when: 1000, tag: '0000_init', breakpoints: true },
      { idx: duplicate === 'index' ? 0 : 1, when: duplicate === 'timestamp' ? 1000 : 2000, tag: duplicate === 'tag' ? '0000_init' : '0001_update', breakpoints: true },
    ], duplicate === 'hash' ? ['SELECT 1;', 'SELECT 1;'] : undefined)
    expect(() => readMigrationPlan([{ id: 'crm', folder: path, historyTable: '__drizzle_migrations_crm' }])).toThrow(/index|timestamp|tag|hash/i)
  })
  it('splits SQL boundaries without splitting quoted strings or comment semicolons', () => {
    const [plan] = readMigrationPlan([{ id: 'crm', folder: folder(undefined, ["-- comment;\nSELECT 'literal;--> statement-breakpoint' AS value;--> statement-breakpoint\nSELECT 2; # ignored;\n"]), historyTable: '__drizzle_migrations_crm' }])
    expect(plan.migrations[0].statements).toHaveLength(2)
    expect(plan.migrations[0].statements[0]).toContain("'literal;--> statement-breakpoint'")
    expect(plan.migrations[0].statements[1]).toContain('SELECT 2')
  })
})

describe('inspectMigrationHistory', () => {
  it('reports a pending suffix with descending legacy times and never creates tables', async () => {
    const fixture = fakeDatabase({ __drizzle_migrations_crm: [{ id: 1, hash: selectOneHash, created_at: 2000 }] })
    const [inspection] = await inspectMigrationHistory(fixture.db, [{ id: 'crm', folder: folder(entries), historyTable: '__drizzle_migrations_crm' }])
    expect(inspection.pending.map(({ tag, timestamp }) => [tag, timestamp])).toEqual([['0001_update', 1000]])
    expect(fixture.writes).toEqual([])
    expect(fixture.queries.some(({ sql }) => /ORDER BY id/i.test(sql))).toBe(true)
    expect(fixture.queries.some(({ sql }) => /GET_LOCK/i.test(sql))).toBe(false)
  })
  it('fails closed if a pending CREATE TABLE target already exists, even with IF NOT EXISTS', async () => {
    const fixture = fakeDatabase({}, ['crm_customer'])
    await expect(inspectMigrationHistory(fixture.db, [{ id: 'crm', folder: folder(undefined, ['-- old baseline\nCREATE TABLE IF NOT EXISTS `crm_customer` (id int);']), historyTable: '__drizzle_migrations_crm' }])).rejects.toThrow(/history.*ambiguous|already exists/i)
    expect(fixture.writes).toEqual([])
  })
})

describe('migrateDatabase', () => {
  it('destroys a pooled session when its migration lock cannot be released', async () => {
    const fixture = fakeDatabase({}, [], undefined, true)
    await expect(migrateDatabase(fixture.db, [{ id: 'core', folder: folder(), historyTable: '__drizzle_migrations' }])).rejects.toThrow(/lock/i)
    expect(fixture.destroy).toHaveBeenCalledOnce()
    expect(fixture.release).not.toHaveBeenCalled()
  })
  it('checks later manifests before writing earlier valid manifests', async () => {
    const fixture = fakeDatabase({}, ['crm_customer'])
    await expect(migrateDatabase(fixture.db, [
      { id: 'core', folder: folder(), historyTable: '__drizzle_migrations' },
      { id: 'crm', folder: folder(undefined, ['CREATE TABLE crm_customer (id INT);']), historyTable: '__drizzle_migrations_crm' },
    ])).rejects.toThrow(/already exists/i)
    expect(fixture.writes).toEqual([])
  })
  it('applies validated manifests sequentially with isolated module history', async () => {
    const fixture = fakeDatabase()
    await migrateDatabase(fixture.db, [
      { id: 'core', folder: folder(), historyTable: '__drizzle_migrations' },
      { id: 'crm', folder: folder([{ idx: 0, when: 2000, tag: '0000_crm', breakpoints: true }], ['SELECT 2;']), historyTable: '__drizzle_migrations_crm' },
    ])
    expect(fixture.histories.__drizzle_migrations).toMatchObject([{ hash: selectOneHash, created_at: 1000 }])
    expect(fixture.histories.__drizzle_migrations_crm).toHaveLength(1)
    expect(fixture.writes.filter((statement) => statement.startsWith('SELECT'))).toEqual(['SELECT 1', 'SELECT 2'])
    expect(fixture.release).toHaveBeenCalledOnce()
    expect(fixture.queries.filter(({ sql }) => /GET_LOCK|RELEASE_LOCK/i.test(sql)).map(({ values }) => values[0])).toEqual(['yishan:migrations:unit_test', 'yishan:migrations:unit_test'])
  })
  it('fails closed on unknown shared legacy history before executing any manifest', async () => {
    const fixture = fakeDatabase({ __drizzle_migrations: [{ id: 1, hash: 'legacy-other-module', created_at: 500 }] })
    await expect(migrateDatabase(fixture.db, [
      { id: 'core', folder: folder(), historyTable: '__drizzle_migrations' },
      { id: 'crm', folder: folder(), historyTable: '__drizzle_migrations_crm' },
    ])).rejects.toThrow(/legacy|ownership/i)
    expect(fixture.writes).toEqual([])
    expect(fixture.release).toHaveBeenCalledOnce()
  })
  it('rejects edited SQL rather than silently treating its timestamp as applied', async () => {
    const fixture = fakeDatabase({ __drizzle_migrations_crm: [{ id: 1, hash: 'edited-hash', created_at: 1000 }] })
    await expect(migrateDatabase(fixture.db, [{ id: 'crm', folder: folder(), historyTable: '__drizzle_migrations_crm' }])).rejects.toThrow(/hash|history/i)
    expect(fixture.writes).toEqual([])
  })
  it('rejects gaps in applied history rather than losing a migration below the latest timestamp', async () => {
    const fixture = fakeDatabase({ __drizzle_migrations_crm: [{ id: 1, hash: selectOneHash, created_at: 1000 }] })
    await expect(migrateDatabase(fixture.db, [{ id: 'crm', folder: folder(entries), historyTable: '__drizzle_migrations_crm' }])).rejects.toThrow(/history|prefix/i)
    expect(fixture.writes).toEqual([])
  })
  it('accepts unchanged shared history when adding an isolated module without replaying it', async () => {
    const fixture = fakeDatabase({ __drizzle_migrations: [{ id: 1, hash: selectOneHash, created_at: '1000' }] })
    await migrateDatabase(fixture.db, [
      { id: 'foundation', folder: folder(), historyTable: '__drizzle_migrations' },
      { id: 'crm', folder: folder(undefined, ['SELECT 2;']), historyTable: '__drizzle_migrations_crm' },
    ])
    expect(fixture.histories.__drizzle_migrations).toHaveLength(1)
    expect(fixture.writes.filter((statement) => statement.startsWith('SELECT'))).toEqual(['SELECT 2'])
  })
  it('cannot migrate a module alone when shared history ownership needs checking', async () => {
    const fixture = fakeDatabase({ __drizzle_migrations: [{ id: 1, hash: selectOneHash, created_at: 1000 }] })
    await expect(migrateDatabase(fixture.db, [{ id: 'crm', folder: folder(), historyTable: '__drizzle_migrations_crm' }])).rejects.toThrow(/ownership/i)
    expect(fixture.writes).toEqual([])
  })
  it('propagates database permission errors instead of treating history as empty', async () => {
    const query = async () => { throw Object.assign(new Error('permission denied'), { code: 'ER_TABLEACCESS_DENIED_ERROR' }) }
    const db = drizzle({ query } as unknown as Pool, { schema: {}, mode: 'default' })
    await expect(inspectMigrationHistory(db, [{ id: 'crm', folder: folder(), historyTable: '__drizzle_migrations_crm' }])).rejects.toThrow()
  })
  it('applies and records non-monotonic migrations once and identifies them by insertion order', async () => {
    const fixture = fakeDatabase()
    const manifests = [{ id: 'crm', folder: folder(entries), historyTable: '__drizzle_migrations_crm' }]
    await migrateDatabase(fixture.db, manifests)
    await migrateDatabase(fixture.db, manifests)
    expect(fixture.histories.__drizzle_migrations_crm.map((row) => row.created_at)).toEqual([2000, 1000])
    expect(fixture.writes.filter((statement) => statement.startsWith('SELECT'))).toEqual(['SELECT 1', 'SELECT 2'])
  })
  it('does not record a failed migration and releases its lock and connection', async () => {
    const fixture = fakeDatabase({}, [], 'INVALID')
    await expect(migrateDatabase(fixture.db, [{ id: 'crm', folder: folder(undefined, ['SELECT 1;--> statement-breakpoint\nINVALID SQL;']), historyTable: '__drizzle_migrations_crm' }])).rejects.toThrow()
    expect(fixture.histories.__drizzle_migrations_crm).toEqual([])
    expect(fixture.release).toHaveBeenCalledOnce()
    expect(fixture.queries.some(({ sql }) => /RELEASE_LOCK/i.test(sql))).toBe(true)
  })
})

describe('legacy history reconciliation', () => {
  function declarations() {
    return [
      { id: 'foundation', folder: folder(), historyTable: '__drizzle_migrations' },
      { id: 'crm', folder: folder(entries, ['SELECT 10;', 'SELECT 20;']), historyTable: '__drizzle_migrations_crm' },
    ]
  }
  function legacyRows(manifests: ReturnType<typeof declarations>) {
    const plans = readMigrationPlan(manifests)
    return [plans[0].migrations[0], ...plans[1].migrations].map((migration, index) => ({ id: index + 1, hash: migration.hash, created_at: migration.timestamp }))
  }
  it('inspects uniquely owned rows without writes, then copies module rows while preserving the shared ledger', async () => {
    const manifests = declarations()
    const shared = legacyRows(manifests)
    const fixture = fakeDatabase({ __drizzle_migrations: [...shared] })
    const inspected = await inspectLegacyMigrationHistory(fixture.db, manifests)
    expect(inspected[1].migrations.map((migration) => migration.timestamp)).toEqual([2000, 1000])
    expect(fixture.writes).toEqual([])
    await expect(migrateDatabase(fixture.db, manifests)).rejects.toThrow(/reconcil/i)
    expect(fixture.writes).toEqual([])
    await reconcileLegacyMigrationHistory(fixture.db, manifests)
    expect(fixture.histories.__drizzle_migrations).toEqual(shared)
    expect(fixture.histories.__drizzle_migrations_crm.map((row) => row.created_at)).toEqual([2000, 1000])
    fixture.writes.splice(0)
    await reconcileLegacyMigrationHistory(fixture.db, manifests)
    await migrateDatabase(fixture.db, manifests)
    expect(fixture.writes).toEqual([])
  })
  it.each(['unknown', 'duplicate', 'gap', 'ambiguous'] as const)('rejects %s legacy ownership before any ledger writes', async (kind) => {
    const manifests = declarations()
    const shared = legacyRows(manifests)
    if (kind === 'unknown') shared[2].hash = 'f'.repeat(64)
    if (kind === 'duplicate') shared.push({ ...shared[1], id: 4 })
    if (kind === 'gap') shared.splice(1, 1)
    if (kind === 'ambiguous') manifests.push({ ...manifests[1], id: 'other', historyTable: '__drizzle_migrations_other' })
    const fixture = fakeDatabase({ __drizzle_migrations: shared })
    await expect(reconcileLegacyMigrationHistory(fixture.db, manifests)).rejects.toThrow(/ambiguous|prefix|hash|duplicate/i)
    expect(fixture.writes).toEqual([])
  })
})
