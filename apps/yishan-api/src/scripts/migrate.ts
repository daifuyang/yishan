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

async function main() {
  const pool = createPool({
    uri: databaseUrl(),
    multipleStatements: true
  })

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

  const [appliedRows] = await pool.query('SELECT name, hash FROM __drizzle_migrations')
  const applied = new Map((appliedRows as Array<{ name: string, hash: string }>).map((row) => [row.name, row.hash]))
  const plan = collectMigrationPlan()

  for (const migration of plan) {
    const { id, sql } = migration
    const hash = createHash('sha256').update(sql).digest('hex')
    const previous = applied.get(id)

    if (previous) {
      if (previous !== hash) {
        throw new Error(`Migration ${id} was modified after being applied`)
      }
      continue
    }

    console.log(`Applying migration ${id}`)
    await pool.query(sql)
    await pool.query('INSERT INTO __drizzle_migrations (name, hash) VALUES (?, ?)', [id, hash])
  }

  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
