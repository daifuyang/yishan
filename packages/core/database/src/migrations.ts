import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import type { Connection, Pool } from 'mysql2/promise'
import { createdTable, splitMigrationStatements } from './sql-statements.js'

export interface MigrationManifest {
  id: string
  folder: string
  historyTable: string
}

export interface PlannedMigration {
  index: number
  tag: string
  timestamp: number
  hash: string
  windowsHash?: string
  statements: string[]
}

export interface MigrationPlan extends MigrationManifest {
  migrations: PlannedMigration[]
}

export interface MigrationInspection {
  plan: MigrationPlan
  pending: PlannedMigration[]
}

export interface LegacyMigrationInspection {
  plan: MigrationPlan
  migrations: PlannedMigration[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPublishedHashes(folder: string): Record<string, unknown> {
  let metadata: unknown
  try {
    metadata = JSON.parse(readFileSync(join(folder, 'meta', '_published-hashes.json'), 'utf8'))
  } catch (cause) {
    if (isRecord(cause) && cause.code === 'ENOENT') return {}
    throw new Error('Cannot read published migration hashes', { cause })
  }
  if (!isRecord(metadata) || metadata.version !== 1 || typeof metadata.commit !== 'string'
    || !/^[a-f0-9]{40}$/.test(metadata.commit) || !isRecord(metadata.migrations)) {
    throw new Error('Invalid published migration hash metadata')
  }
  return metadata.migrations
}

export function readMigrationPlan(manifests: readonly MigrationManifest[]): MigrationPlan[] {
  const ids = new Set<string>()
  const historyTables = new Set<string>()
  return manifests.map((manifest) => {
    if (!/^[a-z][a-z0-9_-]*$/.test(manifest.id) || ids.has(manifest.id)) {
      throw new Error(`Invalid or duplicate migration id: ${manifest.id}`)
    }
    ids.add(manifest.id)
    if ((manifest.historyTable !== '__drizzle_migrations' && manifest.historyTable !== `__drizzle_migrations_${manifest.id}`)
      || manifest.historyTable.length > 64 || historyTables.has(manifest.historyTable)) {
      throw new Error(`Invalid or duplicate migration history table for ${manifest.id}`)
    }
    historyTables.add(manifest.historyTable)
    let journal: unknown
    try {
      journal = JSON.parse(readFileSync(join(manifest.folder, 'meta', '_journal.json'), 'utf8'))
    } catch (cause) {
      throw new Error(`Cannot read migration journal for ${manifest.id}`, { cause })
    }
    if (!isRecord(journal) || journal.dialect !== 'mysql' || !Array.isArray(journal.entries)) {
      throw new Error(`Invalid mysql migration journal for ${manifest.id}`)
    }
    const tags = new Set<string>()
    const timestamps = new Set<number>()
    const hashes = new Set<string>()
    const publishedHashes = readPublishedHashes(manifest.folder)
    let previousIndex = -1
    const migrations = journal.entries.map((entry: unknown): PlannedMigration => {
      if (!isRecord(entry) || typeof entry.tag !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(entry.tag) || tags.has(entry.tag)) {
        throw new Error(`Invalid or duplicate migration tag for ${manifest.id}`)
      }
      if (typeof entry.idx !== 'number' || !Number.isSafeInteger(entry.idx) || entry.idx <= previousIndex) {
        throw new Error(`Invalid migration journal index for ${manifest.id}`)
      }
      if (typeof entry.when !== 'number' || !Number.isSafeInteger(entry.when) || entry.when < 0 || timestamps.has(entry.when)) {
        throw new Error(`Invalid or duplicate migration timestamp for ${manifest.id}`)
      }
      if (typeof entry.breakpoints !== 'boolean') {
        throw new Error(`Invalid migration breakpoints for ${manifest.id}/${entry.tag}`)
      }
      tags.add(entry.tag)
      timestamps.add(entry.when)
      previousIndex = entry.idx
      let content: string
      try {
        content = readFileSync(join(manifest.folder, `${entry.tag}.sql`), 'utf8')
      } catch (cause) {
        throw new Error(`Cannot read migration SQL file for ${manifest.id}/${entry.tag}`, { cause })
      }
      if (!content.trim()) throw new Error(`Empty migration SQL for ${manifest.id}/${entry.tag}`)
      const hash = createHash('sha256').update(content).digest('hex')
      const published = publishedHashes[entry.tag]
      let windowsHash: string | undefined
      if (published !== undefined) {
        if (!isRecord(published) || published.sha256 !== hash) {
          throw new Error(`Published migration SQL hash changed for ${manifest.id}/${entry.tag}`)
        }
        if (published.windowsSha256 !== undefined) {
          const crlfLines: unknown = published.windowsCrLfLines
          const lineCount = content.split('\n').length - 1
          if (crlfLines !== undefined && (!Array.isArray(crlfLines) || crlfLines.length === 0
            || crlfLines.some((line: unknown, index: number) => typeof line !== 'number' || !Number.isSafeInteger(line)
              || line < 1 || line > lineCount || (index > 0 && line <= Number(crlfLines[index - 1]))))) {
            throw new Error(`Invalid published Windows newline positions for ${manifest.id}/${entry.tag}`)
          }
          let line = 0
          const windowsContent = content.replace(/\r\n/g, '\n').replace(/\n/g, () => {
            line++
            return crlfLines === undefined || (Array.isArray(crlfLines) && crlfLines.includes(line)) ? '\r\n' : '\n'
          })
          const expectedWindowsHash = createHash('sha256').update(windowsContent).digest('hex')
          if (published.windowsSha256 !== expectedWindowsHash || expectedWindowsHash === hash) {
            throw new Error(`Invalid published Windows migration hash for ${manifest.id}/${entry.tag}`)
          }
          windowsHash = expectedWindowsHash
        }
      }
      if (hashes.has(hash)) throw new Error(`Duplicate migration SQL hash for ${manifest.id}/${entry.tag}`)
      hashes.add(hash)
      const statements = splitMigrationStatements(content)
      if (statements.length === 0) throw new Error(`Empty migration SQL for ${manifest.id}/${entry.tag}`)
      return { index: entry.idx, tag: entry.tag, timestamp: entry.when, hash, windowsHash, statements }
    })
    return { ...manifest, migrations }
  })
}

interface HistoryRow {
  id: number
  hash: string
  timestamp: number
}

function matchesHistory(migration: PlannedMigration, recorded: HistoryRow): boolean {
  return migration.timestamp === recorded.timestamp
    && (migration.hash === recorded.hash || migration.windowsHash === recorded.hash)
}

async function readHistory<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema>, table: string,
): Promise<HistoryRow[]> {
  let rows: unknown
  try {
    const result = await db.execute(sql`SELECT id, hash, created_at FROM ${sql.identifier(table)} ORDER BY id`)
    rows = result[0]
  } catch (error) {
    const cause: unknown = isRecord(error) ? error.cause : undefined
    if ((isRecord(error) && error.code === 'ER_NO_SUCH_TABLE') || (isRecord(cause) && cause.code === 'ER_NO_SUCH_TABLE')) return []
    throw error
  }
  if (!Array.isArray(rows)) throw new Error(`Invalid migration history in ${table}`)
  return rows.map((row: unknown) => {
    if (!isRecord(row) || typeof row.hash !== 'string' || !/^[a-f0-9]{64}$/.test(row.hash)) {
      throw new Error(`Invalid hash in migration history ${table}; legacy ownership must be resolved explicitly`)
    }
    if (typeof row.created_at !== 'number' && typeof row.created_at !== 'string') {
      throw new Error(`Invalid timestamp in migration history ${table}`)
    }
    const timestamp = Number(row.created_at)
    if (!Number.isSafeInteger(timestamp) || timestamp < 0 || (typeof row.created_at === 'string' && !/^\d+$/.test(row.created_at))) {
      throw new Error(`Invalid timestamp in migration history ${table}`)
    }
    const id = Number(row.id)
    if (!Number.isSafeInteger(id) || id < 1) throw new Error(`Invalid id in migration history ${table}`)
    return { id, hash: row.hash, timestamp }
  })
}

function validateHistory(plan: MigrationPlan, history: readonly HistoryRow[]): void {
  for (let index = 0; index < history.length; index++) {
    const recorded = history[index]
    const expected = plan.migrations[index]
    if (!expected || !matchesHistory(expected, recorded)
      || (index > 0 && recorded.id <= history[index - 1].id)) {
      const reason = plan.historyTable === '__drizzle_migrations' ? 'legacy ownership is ambiguous' : 'history is not an unchanged journal prefix'
      throw new Error(`Migration history for ${plan.id} does not match SQL hash/timestamp: ${reason}; resolve explicitly before migrating`)
    }
  }
}

async function inspectLedgers<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema>, plans: MigrationPlan[], allowReconciliation: boolean,
): Promise<{ inspections: MigrationInspection[]; legacy: LegacyMigrationInspection[] }> {
  if (plans.length === 0) return { inspections: [], legacy: [] }
  const sharedHistory = await readHistory(db, '__drizzle_migrations')
  const sharedPlan = plans.find((plan) => plan.historyTable === '__drizzle_migrations')
  if (sharedHistory.length > 0 && !sharedPlan) {
    throw new Error('Shared legacy migration history ownership cannot be checked without its manifest')
  }
  const ownership = new Map(plans.map((plan) => [plan.id, [] as HistoryRow[]]))
  for (const row of sharedHistory) {
    const owners = plans.filter((plan) => plan.migrations.some((migration) => matchesHistory(migration, row)))
    if (owners.length !== 1) throw new Error('Shared legacy migration history ownership is ambiguous: every hash/timestamp must match exactly one installed manifest')
    ownership.get(owners[0].id)?.push(row)
  }
  const inspections: MigrationInspection[] = []
  const legacy: LegacyMigrationInspection[] = []
  for (const plan of plans) {
    const sharedRows = ownership.get(plan.id) ?? []
    validateHistory(plan, sharedRows)
    const history = plan.historyTable === '__drizzle_migrations' ? sharedRows : await readHistory(db, plan.historyTable)
    validateHistory(plan, history)
    const missing = plan.historyTable === '__drizzle_migrations' ? [] : plan.migrations.slice(history.length, sharedRows.length)
      .map((migration, index) => ({ ...migration, hash: sharedRows[history.length + index].hash }))
    if (!allowReconciliation && missing.length > 0) {
      throw new Error(`Shared legacy history for ${plan.id} requires explicit reconciliation before migrating`)
    }
    legacy.push({ plan, migrations: missing })
    inspections.push({ plan, pending: plan.migrations.slice(Math.max(history.length, sharedRows.length)) })
  }
  return { inspections, legacy }
}

async function inspectTargets<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema>, inspections: MigrationInspection[],
): Promise<void> {
  for (const { plan, pending } of inspections) {
    for (const migration of pending) {
      for (const statement of migration.statements) {
        const table = createdTable(statement)
        if (!table) continue
        const rows = await db.execute(sql`SELECT TABLE_NAME AS tableName FROM information_schema.tables WHERE TABLE_SCHEMA = ${table.schema ? sql`${table.schema}` : sql`DATABASE()`} AND TABLE_NAME = ${table.name}`)
        if (!Array.isArray(rows[0])) throw new Error('Invalid information_schema table lookup result')
        if (rows[0].length > 0) {
          throw new Error(`Migration history is ambiguous for ${plan.id}/${migration.tag}: CREATE TABLE target ${table.name} already exists; resolve explicitly before migrating`)
        }
      }
    }
  }
}

export async function inspectMigrationHistory<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema>, manifests: readonly MigrationManifest[],
): Promise<MigrationInspection[]> {
  const { inspections } = await inspectLedgers(db, readMigrationPlan(manifests), false)
  await inspectTargets(db, inspections)
  return inspections
}

export async function inspectLegacyMigrationHistory<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema>, manifests: readonly MigrationManifest[],
): Promise<LegacyMigrationInspection[]> {
  const { inspections, legacy } = await inspectLedgers(db, readMigrationPlan(manifests), true)
  await inspectTargets(db, inspections)
  return legacy
}

async function withMigrationLock<TSchema extends Record<string, unknown>, TResult>(
  db: MySql2Database<TSchema> & { $client: Pool | Connection }, operation: (sessionDb: MySql2Database<Record<string, never>>) => Promise<TResult>,
): Promise<TResult> {
  const connection = 'getConnection' in db.$client ? await db.$client.getConnection() : db.$client
  const sessionDb = drizzle(connection, { mode: 'default' })
  let lockName: string | undefined
  let failure: unknown
  let destroyConnection = false
  try {
    const databaseResult = await sessionDb.execute(sql`SELECT DATABASE() AS databaseName`)
    const rows: unknown = databaseResult[0]
    const row: unknown = Array.isArray(rows) ? rows[0] : undefined
    if (!isRecord(row) || typeof row.databaseName !== 'string') throw new Error('Migrations require a selected MySQL database')
    const key = `yishan:migrations:${row.databaseName}`
    const requestedLock = key.length <= 64 ? key : `yishan:migrations:${createHash('sha256').update(row.databaseName).digest('hex').slice(0, 47)}`
    const lockResult = await sessionDb.execute(sql`SELECT GET_LOCK(${requestedLock}, 10) AS acquired`)
    const lockRows: unknown = lockResult[0]
    const lockRow: unknown = Array.isArray(lockRows) ? lockRows[0] : undefined
    if (!isRecord(lockRow) || Number(lockRow.acquired) !== 1) throw new Error('Could not acquire the database migration lock')
    lockName = requestedLock
    return await operation(sessionDb)
  } catch (error) {
    failure = error
    throw error
  } finally {
    try {
      if (lockName) {
        const result = await sessionDb.execute(sql`SELECT RELEASE_LOCK(${lockName}) AS released`)
        const rows: unknown = result[0]
        const row: unknown = Array.isArray(rows) ? rows[0] : undefined
        if (!isRecord(row) || Number(row.released) !== 1) throw new Error('Could not release the database migration lock')
      }
    } catch (releaseError) {
      destroyConnection = true
      if (failure) throw new AggregateError([failure, releaseError], 'Migration failed and its lock could not be released')
      throw releaseError
    } finally {
      if (destroyConnection) connection.destroy()
      else if ('release' in connection && typeof connection.release === 'function') connection.release()
    }
  }
}

async function createHistory(db: MySql2Database<Record<string, never>>, table: string): Promise<void> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS ${sql.identifier(table)} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`)
}

async function recordMigration(db: MySql2Database<Record<string, never>>, table: string, migration: PlannedMigration): Promise<void> {
  await db.execute(sql`INSERT INTO ${sql.identifier(table)} (hash, created_at) VALUES (${migration.hash}, ${migration.timestamp})`)
}

export async function reconcileLegacyMigrationHistory<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema> & { $client: Pool | Connection }, manifests: readonly MigrationManifest[],
): Promise<LegacyMigrationInspection[]> {
  const plans = readMigrationPlan(manifests)
  if (plans.length === 0) return []
  return withMigrationLock(db, async (sessionDb) => {
    const { inspections, legacy } = await inspectLedgers(sessionDb, plans, true)
    await inspectTargets(sessionDb, inspections)
    for (const { plan, migrations } of legacy) {
      if (migrations.length === 0) continue
      await createHistory(sessionDb, plan.historyTable)
      for (const migration of migrations) await recordMigration(sessionDb, plan.historyTable, migration)
    }
    return legacy
  })
}

export async function migrateDatabase<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema> & { $client: Pool | Connection }, manifests: readonly MigrationManifest[],
): Promise<MigrationPlan[]> {
  const plans = readMigrationPlan(manifests)
  if (plans.length === 0) return plans
  return withMigrationLock(db, async (sessionDb) => {
    const { inspections } = await inspectLedgers(sessionDb, plans, false)
    await inspectTargets(sessionDb, inspections)
    // All histories and pending CREATE targets are checked before any DDL.
    for (const { plan, pending } of inspections) {
      if (pending.length === 0) continue
      await createHistory(sessionDb, plan.historyTable)
      for (const migration of pending) {
        for (let index = 0; index < migration.statements.length; index++) {
          try {
            await sessionDb.execute(sql.raw(migration.statements[index]))
          } catch (cause) {
            throw new Error(`Migration ${plan.id}/${migration.tag} failed at statement ${index + 1}; MySQL DDL may already be applied and must be reconciled explicitly`, { cause })
          }
        }
        await recordMigration(sessionDb, plan.historyTable, migration)
      }
    }
    return plans
  })
}
