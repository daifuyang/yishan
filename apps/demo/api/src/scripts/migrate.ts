import 'dotenv/config'
import { readMigrationPlan, inspectMigrationHistory, migrateDatabase, inspectLegacyMigrationHistory, reconcileLegacyMigrationHistory } from '@yishan/core-database'
import { createDatabase } from '@yishan/core-database'
import { systemModule } from '@yishan/core-system-api'
import { schema } from '@yishan/core-system-api/schema'
import { demoModules } from '../manifest'
import { loadConfig } from '../config'

export const migrationManifest = [systemModule, ...demoModules].flatMap(module => module.migrations ? [module.migrations] : [])

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--check', '--dry-run', '--apply', '--reconcile-dry-run', '--reconcile-apply'].includes(args[0])) {
    throw new Error('Usage: migrate --check | --dry-run | --apply | --reconcile-dry-run | --reconcile-apply (no implicit database writes)')
  }
  const plans = readMigrationPlan(migrationManifest)
  if (args[0] === '--check') {
    for (const plan of plans) console.log(`${plan.id}: ${plan.migrations.length} migrations -> ${plan.historyTable}`)
    return
  }
  const config = loadConfig()
  const database = createDatabase({ connection: config.connection, schema })
  try {
    if (args[0] === '--dry-run') {
      const inspections = await inspectMigrationHistory(database.db, migrationManifest)
      for (const { plan, pending } of inspections) console.log(`${plan.id}: ${pending.length} pending -> ${plan.historyTable}`)
      return
    }
    if (args[0] === '--reconcile-dry-run' || args[0] === '--reconcile-apply') {
      const inspections = args[0] === '--reconcile-dry-run'
        ? await inspectLegacyMigrationHistory(database.db, migrationManifest)
        : await reconcileLegacyMigrationHistory(database.db, migrationManifest)
      for (const { plan, migrations } of inspections) {
        console.log(`${plan.id}: ${migrations.length} legacy records ${args[0] === '--reconcile-dry-run' ? 'to copy' : 'copied'} -> ${plan.historyTable}`)
      }
      return
    }
    await migrateDatabase(database.db, migrationManifest)
    console.log('Installed module migrations completed')
  } finally { await database.close() }
}

if (require.main === module) void main().catch(error => { console.error(error); process.exitCode = 1 })
