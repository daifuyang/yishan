import 'dotenv/config'
import { createHash } from 'node:crypto'
import { createPool } from 'mysql2/promise'
import { collectMigrationPlan } from './migration-plan.js'

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const user = encodeURIComponent(process.env.DATABASE_USER ?? 'root')
  const password = encodeURIComponent(process.env.DATABASE_PASSWORD ?? '')
  const host = process.env.DATABASE_HOST ?? 'localhost'
  const port = process.env.DATABASE_PORT ?? '3306'
  const database = process.env.DATABASE_NAME ?? 'yishan'
  return `mysql://${user}:${password}@${host}:${port}/${database}`
}

export type MigrationStatus = 'applied' | 'pending' | 'modified'

export interface MigrationResult {
  id: string
  status: MigrationStatus
}

function migrationHash(sql: string) {
  return createHash('sha256').update(sql).digest('hex')
}

async function readAppliedMigrations(pool: ReturnType<typeof createPool>) {
  const [tables] = await pool.query("SHOW TABLES LIKE '__drizzle_migrations'")
  if ((tables as unknown[]).length === 0) return new Map<string, string>()

  const [appliedRows] = await pool.query('SELECT name, hash FROM __drizzle_migrations')
  return new Map((appliedRows as Array<{ name: string, hash: string }>).map((row) => [row.name, row.hash]))
}

/**
 * Reads the deployment's migration plan without changing the database. This is
 * deliberately used by the FC migration runner's default dry-run mode.
 */
export async function inspectMigrations(): Promise<MigrationResult[]> {
  const pool = createPool({
    uri: databaseUrl(),
    multipleStatements: true
  })

  try {
    const applied = await readAppliedMigrations(pool)
    return collectMigrationPlan().map(({ id, sql }) => {
      const previous = applied.get(id)
      return {
        id,
        status: previous ? (previous === migrationHash(sql) ? 'applied' : 'modified') : 'pending'
      }
    })
  } finally {
    await pool.end()
  }
}

/** Applies every pending Core and bundled-plugin migration exactly once. */
export async function runMigrations(): Promise<MigrationResult[]> {
  const pool = createPool({
    uri: databaseUrl(),
    multipleStatements: true
  })

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        hash VARCHAR(64) NOT NULL,
        applied_at DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
        PRIMARY KEY (id),
        UNIQUE KEY uniq_drizzle_migration_name (name)
      )
    `)

    const applied = await readAppliedMigrations(pool)
    const plan = collectMigrationPlan()
    const results: MigrationResult[] = []

    for (const migration of plan) {
      const { id, sql } = migration
      const hash = migrationHash(sql)
      const previous = applied.get(id)

      if (previous) {
        if (previous !== hash) {
          throw new Error(`Migration ${id} was modified after being applied`)
        }
        results.push({ id, status: 'applied' })
        continue
      }

      console.log(`Applying migration ${id}`)
      await pool.query(sql)
      await pool.query('INSERT INTO __drizzle_migrations (name, hash) VALUES (?, ?)', [id, hash])
      results.push({ id, status: 'pending' })
    }

    return results
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  runMigrations().then((results) => {
    console.log(JSON.stringify({ mode: 'apply', migrations: results }, null, 2))
  }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
