import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConnection, type RowDataPacket } from 'mysql2/promise'
import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase, inspectLegacyMigrationHistory, reconcileLegacyMigrationHistory, readMigrationPlan, inspectMigrationHistory, migrateDatabase, type Database, type MigrationManifest } from '../src/index.js'

// Only the disposable database on the repository's local development MySQL is used.
const localConnection = { host: '127.0.0.1', port: 3306, user: 'root', password: process.env.YISHAN_TEST_MYSQL_PASSWORD ?? 'dev-root-only-do-not-use-in-prod' }
const folders: string[] = []
const createdDatabases: string[] = []
const droppedDatabases: string[] = []
function assertTestDatabase(name: string) {
  if (!/^yishan_v2_test_[a-f0-9]{20}$/.test(name)) throw new Error('Refusing to create or drop a non-test database')
}

async function isolatedDatabase(operation: (database: Database<Record<string, never>>, name: string) => Promise<void>) {
  const name = `yishan_v2_test_${randomBytes(10).toString('hex')}`
  assertTestDatabase(name)
  const admin = await createConnection(localConnection)
  let database: Database<Record<string, never>> | undefined
  try {
    await admin.query('CREATE DATABASE ??', [name])
    createdDatabases.push(name)
    database = createDatabase<Record<string, never>>({ connection: { ...localConnection, database: name, connectionLimit: 3 }, schema: {} })
    await operation(database, name)
  } finally {
    try { await database?.close() }
    finally {
      try {
        assertTestDatabase(name)
        await admin.query('DROP DATABASE IF EXISTS ??', [name])
        droppedDatabases.push(name)
      } finally { await admin.end() }
    }
  }
}

function manifest(sqlFiles: string[], timestamps = sqlFiles.map((_, index) => index + 1000)): MigrationManifest {
  const path = mkdtempSync(join(tmpdir(), 'core-database-mysql-'))
  folders.push(path)
  mkdirSync(join(path, 'meta'))
  const entries = sqlFiles.map((content, index) => {
    const tag = `000${index}_probe`
    writeFileSync(join(path, `${tag}.sql`), content)
    return { idx: index, when: timestamps[index], tag, breakpoints: true }
  })
  writeFileSync(join(path, 'meta', '_journal.json'), JSON.stringify({ version: '7', dialect: 'mysql', entries }))
  return { id: 'probe', folder: path, historyTable: '__drizzle_migrations_probe' }
}

interface HistoryRecord extends RowDataPacket { id: number; hash: string; created_at: number }
interface ProbeRecord extends RowDataPacket { id: number; value: string }
interface LockRecord extends RowDataPacket { free: number }

afterEach(() => {
  for (const path of folders.splice(0)) rmSync(path, { recursive: true, force: true })
  expect(droppedDatabases).toEqual(createdDatabases)
})

describe.skipIf(process.env.YISHAN_DATABASE_MYSQL_TEST !== '1')('isolated local MySQL migrations', () => {
  it.each(['canonical', 'windows', 'unknown'] as const)('preserves %s published history without replay or hash rewrites', async (variant) => {
    await isolatedDatabase(async (database) => {
      const content = "CREATE TABLE probe (id INT PRIMARY KEY, value VARCHAR(80));\nINSERT INTO probe VALUES (42, 'preserved');\n"
      const declaration = { ...manifest([content]), id: 'foundation', historyTable: '__drizzle_migrations' }
      const canonical = createHash('sha256').update(content).digest('hex')
      const windows = createHash('sha256').update(content.replace(/\n/g, '\r\n')).digest('hex')
      writeFileSync(join(declaration.folder, 'meta', '_published-hashes.json'), JSON.stringify({ version: 1, commit: 'a'.repeat(40), migrations: { '0000_probe': { sha256: canonical, windowsSha256: windows } } }))
      for (const statement of readMigrationPlan([declaration])[0].migrations[0].statements) await database.pool.query(statement)
      await database.pool.query('CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at BIGINT)')
      const recordedHash = variant === 'canonical' ? canonical : variant === 'windows' ? windows : 'f'.repeat(64)
      await database.pool.query('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)', [recordedHash, 1000])
      for (let run = 0; run < 2; run++) {
        if (variant === 'unknown') await expect(migrateDatabase(database.db, [declaration])).rejects.toThrow(/hash|ownership/i)
        else await migrateDatabase(database.db, [declaration])
      }
      const [history] = await database.pool.query<HistoryRecord[]>('SELECT * FROM __drizzle_migrations ORDER BY id')
      expect(history).toEqual([{ id: 1, hash: recordedHash, created_at: 1000 }])
      const [data] = await database.pool.query<ProbeRecord[]>('SELECT id, value FROM probe')
      expect(data).toEqual([{ id: 42, value: 'preserved' }])
    })
  })
  it('reconciles exact mixed legacy prefixes without modifying original records or business data', async () => {
    await isolatedDatabase(async (database) => {
      const foundation = { ...manifest(['CREATE TABLE foundation (id INT PRIMARY KEY);']), id: 'foundation', historyTable: '__drizzle_migrations' }
      const declarations = [foundation, manifest([
        "CREATE TABLE probe (id INT PRIMARY KEY, value VARCHAR(80));\nINSERT INTO probe VALUES (42, 'preserved');\n",
        'ALTER TABLE probe ADD note INT;\n',
      ], [2000, 1000])]
      const originalMigration = readMigrationPlan(declarations)[1].migrations[0]
      const windowsHash = createHash('sha256').update("CREATE TABLE probe (id INT PRIMARY KEY, value VARCHAR(80));\r\nINSERT INTO probe VALUES (42, 'preserved');\r\n").digest('hex')
      const secondMigration = readMigrationPlan(declarations)[1].migrations[1]
      writeFileSync(join(declarations[1].folder, 'meta', '_published-hashes.json'), JSON.stringify({ version: 1, commit: 'a'.repeat(40), migrations: {
        '0000_probe': { sha256: originalMigration.hash, windowsSha256: windowsHash },
        '0001_probe': { sha256: secondMigration.hash, windowsSha256: createHash('sha256').update('ALTER TABLE probe ADD note INT;\r\n').digest('hex') },
      } }))
      await database.pool.query('CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at BIGINT)')
      for (const plan of readMigrationPlan(declarations)) {
        for (const migration of plan.migrations) {
          for (const statement of migration.statements) await database.pool.query(statement)
          await database.pool.query('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)', [migration.windowsHash ?? migration.hash, migration.timestamp])
        }
      }
      const [original] = await database.pool.query<HistoryRecord[]>('SELECT * FROM __drizzle_migrations ORDER BY id')
      const [inspection] = (await inspectLegacyMigrationHistory(database.db, declarations)).filter(({ plan }) => plan.id === 'probe')
      expect(inspection.migrations).toHaveLength(2)
      const [tablesBefore] = await database.pool.query<RowDataPacket[]>('SHOW TABLES')
      expect(tablesBefore).toHaveLength(3)
      await expect(migrateDatabase(database.db, declarations)).rejects.toThrow(/reconcil/i)
      // An interrupted historical copy is already an exact prefix, so only its suffix is copied.
      await database.pool.query('CREATE TABLE __drizzle_migrations_probe (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at BIGINT)')
      await database.pool.query('INSERT INTO __drizzle_migrations_probe (hash, created_at) VALUES (?, ?)', [original[1].hash, original[1].created_at])
      expect((await inspectLegacyMigrationHistory(database.db, declarations))[1].migrations).toHaveLength(1)
      await reconcileLegacyMigrationHistory(database.db, declarations)
      await reconcileLegacyMigrationHistory(database.db, declarations)
      await migrateDatabase(database.db, declarations)
      const [shared] = await database.pool.query<HistoryRecord[]>('SELECT * FROM __drizzle_migrations ORDER BY id')
      expect(shared).toEqual(original)
      const [copied] = await database.pool.query<HistoryRecord[]>('SELECT * FROM __drizzle_migrations_probe ORDER BY id')
      expect(copied.map(({ hash, created_at }) => ({ hash, created_at }))).toEqual(original.slice(1).map(({ hash, created_at }) => ({ hash, created_at })))
      const [data] = await database.pool.query<ProbeRecord[]>('SELECT id, value FROM probe')
      expect(data[0]).toMatchObject({ id: 42, value: 'preserved' })
    })
  })

  it('reports the unchanged CRM baseline failure without claiming the failed migration completed', async () => {
    await isolatedDatabase(async (database) => {
      const declarations = [{ id: 'crm', folder: join(__dirname, '../../../../apps/demo/api/src/modules/crm/drizzle'), historyTable: '__drizzle_migrations_crm' }]
      let failure: unknown
      try { await migrateDatabase(database.db, declarations) } catch (error) { failure = error }
      expect(failure).toBeInstanceOf(Error)
      const message = failure instanceof Error ? failure.message : ''
      expect(message).toMatch(/Migration crm\/.+ failed at statement \d+/)
      let cause: unknown = failure
      while (cause instanceof Error && cause.cause) cause = cause.cause
      expect(String(cause)).toMatch(/already exists|duplicate column/i)
      const [history] = await database.pool.query<HistoryRecord[]>('SELECT * FROM __drizzle_migrations_crm ORDER BY id')
      const plan = readMigrationPlan(declarations)[0]
      expect(history.length).toBeGreaterThan(0)
      expect(history.length).toBeLessThan(plan.migrations.length)
      expect(message).toContain(plan.migrations[history.length].tag)
      await expect(migrateDatabase(database.db, declarations)).rejects.toThrow(/ambiguous/i)
      console.log(`Unchanged CRM baseline: ${message}; ${String(cause)}`)
    })
  })
  it('inspects an empty database without creating history or business tables', async () => {
    await isolatedDatabase(async (database) => {
      const declarations = [manifest(['CREATE TABLE probe (id INT PRIMARY KEY);'])]
      const [inspection] = await inspectMigrationHistory(database.db, declarations)
      expect(inspection.pending.map((migration) => migration.tag)).toEqual(['0000_probe'])
      const [tables] = await database.pool.query<RowDataPacket[]>('SHOW TABLES')
      expect(tables).toEqual([])
    })
  })

  it('serializes concurrent runners and records descending timestamps once in journal order', async () => {
    await isolatedDatabase(async (database) => {
      const declarations = [manifest([
        "CREATE TABLE probe (id INT PRIMARY KEY, value VARCHAR(80));--> statement-breakpoint\nINSERT INTO probe VALUES (1, 'first');",
        "ALTER TABLE probe ADD note INT;--> statement-breakpoint\nINSERT INTO probe (id, value) VALUES (2, 'second');",
        "UPDATE probe SET value = 'updated' WHERE id = 1;",
      ], [3000, 1000, 2000])]
      await Promise.all([migrateDatabase(database.db, declarations), migrateDatabase(database.db, declarations)])
      await migrateDatabase(database.db, declarations)
      const [history] = await database.pool.query<HistoryRecord[]>('SELECT id, hash, created_at FROM __drizzle_migrations_probe ORDER BY id')
      expect(history.map((row) => row.created_at)).toEqual([3000, 1000, 2000])
      const [rows] = await database.pool.query<ProbeRecord[]>('SELECT id, value FROM probe ORDER BY id')
      expect(rows.map(({ id, value }) => ({ id, value }))).toEqual([{ id: 1, value: 'updated' }, { id: 2, value: 'second' }])
      expect((await inspectMigrationHistory(database.db, declarations))[0].pending).toEqual([])
    })
  })

  it.each(['unquoted', 'qualified', 'if-not-exists'] as const)('rejects existing %s CREATE targets without creating a history table', async (style) => {
    await isolatedDatabase(async (database, name) => {
      await database.pool.query('CREATE TABLE probe (id INT PRIMARY KEY)')
      await database.pool.query('INSERT INTO probe VALUES (42)')
      const target = style === 'qualified' ? `\`${name}\`.\`probe\`` : 'probe'
      const statement = `/* legacy */ CREATE TABLE ${style === 'if-not-exists' ? 'IF NOT EXISTS ' : ''}${target} (id INT PRIMARY KEY);`
      const declarations = [manifest([statement])]
      await expect(migrateDatabase(database.db, declarations)).rejects.toThrow(/history is ambiguous/i)
      const [historyTables] = await database.pool.query<RowDataPacket[]>('SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [name, '__drizzle_migrations_probe'])
      expect(historyTables).toEqual([])
      const [rows] = await database.pool.query<Array<RowDataPacket & { id: number }>>('SELECT id FROM probe')
      expect(rows[0].id).toBe(42)
    })
  })

  it('retains partial DDL, leaves the failed migration unrecorded and refuses a blind retry', async () => {
    await isolatedDatabase(async (database, name) => {
      const declarations = [manifest(['CREATE TABLE probe (id INT PRIMARY KEY); INSERT INTO probe VALUES (1); INSERT INTO missing_table VALUES (1);'])]
      await expect(migrateDatabase(database.db, declarations)).rejects.toThrow(/failed at statement 3/i)
      const [history] = await database.pool.query<HistoryRecord[]>('SELECT id, hash, created_at FROM __drizzle_migrations_probe')
      expect(history).toEqual([])
      const [rows] = await database.pool.query<Array<RowDataPacket & { id: number }>>('SELECT id FROM probe')
      expect(rows[0].id).toBe(1)
      await expect(migrateDatabase(database.db, declarations)).rejects.toThrow(/history is ambiguous/i)
      const [locks] = await database.pool.query<LockRecord[]>('SELECT IS_FREE_LOCK(?) AS free', [`yishan:migrations:${name}`])
      expect(locks[0].free).toBe(1)
    })
  })

  it('uses one connection for session variables and preserves quoted breakpoint text', async () => {
    await isolatedDatabase(async (database) => {
      const declarations = [manifest([
        "SET @note = 'literal;--> statement-breakpoint';--> statement-breakpoint\nCREATE TABLE probe (id INT PRIMARY KEY, value VARCHAR(80));--> statement-breakpoint\nINSERT INTO probe VALUES (1, @note);",
      ])]
      await migrateDatabase(database.db, declarations)
      const [rows] = await database.pool.query<ProbeRecord[]>('SELECT id, value FROM probe')
      expect(rows[0].value).toBe('literal;--> statement-breakpoint')
    })
  })

  it('rejects unknown shared legacy rows before executing module DDL', async () => {
    await isolatedDatabase(async (database) => {
      await database.pool.query('CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at BIGINT)')
      await database.pool.query('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)', ['a'.repeat(64), 555])
      const declaration = { ...manifest(['CREATE TABLE probe (id INT PRIMARY KEY);']), id: 'foundation', historyTable: '__drizzle_migrations' }
      await expect(migrateDatabase(database.db, [declaration])).rejects.toThrow(/ownership is ambiguous/i)
      const [tables] = await database.pool.query<RowDataPacket[]>('SHOW TABLES')
      expect(tables).toHaveLength(1)
    })
  })
})
