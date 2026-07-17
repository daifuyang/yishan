import { inspectMigrations, runMigrations } from './scripts/migrate.js'
import { resetDatabaseAndSeed } from './scripts/reset.js'

interface MigrationRunnerEvent {
  mode?: 'dry-run' | 'apply' | 'reset-and-seed'
}

/**
 * Internal-only FC event handler. It has no HTTP trigger and is invoked by the
 * protected workflow after the deployment package has been built.
 */
export async function handler(event: MigrationRunnerEvent = {}) {
  const mode = event.mode ?? 'dry-run'
  if (mode === 'dry-run') {
    return { mode, migrations: await inspectMigrations() }
  }
  if (mode === 'apply') {
    return { mode, migrations: await runMigrations() }
  }
  if (mode === 'reset-and-seed') {
    await resetDatabaseAndSeed()
    return { mode, status: 'completed' }
  }
  throw new Error(`Unsupported migration runner mode: ${String(mode)}`)
}
