import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export interface MigrationPlanEntry {
  id: string
  path: string
  sql: string
}

function pluginNamespace(moduleRoot: string): string {
  const manifestPath = path.join(moduleRoot, 'manifest.ts')
  const source = readFileSync(manifestPath, 'utf8')
  const match = source.match(/dbNamespace:\s*['\"]([a-z][a-z0-9_]{2,23})['\"]/)
  if (!match) throw new Error(`Plugin manifest must declare dbNamespace: ${manifestPath}`)
  return match[1]
}

function validatePluginSql(id: string, namespace: string, sql: string): void {
  const objectNames = [
    ...sql.matchAll(/(?:CREATE TABLE|ALTER TABLE|DROP TABLE)\s+`?([a-z0-9_]+)`?/gi),
  ].map((match) => match[1])
  for (const name of objectNames) {
    if (!name.startsWith(`${namespace}_`)) {
      throw new Error(`Plugin migration ${id} may only manage ${namespace}_* objects (found ${name})`)
    }
  }

  const indexNames = [...sql.matchAll(/(?:UNIQUE\s+)?INDEX\s+`?([a-z0-9_]+)`?/gi)].map(
    (match) => match[1],
  )
  for (const name of indexNames) {
    if (
      !name.startsWith(`${namespace}_`) &&
      !name.startsWith(`idx_${namespace}_`) &&
      !name.startsWith(`uniq_${namespace}_`)
    ) {
      throw new Error(`Plugin migration ${id} index must use the ${namespace} namespace (found ${name})`)
    }
  }
}

export function collectMigrationPlan(root = process.cwd()): MigrationPlanEntry[] {
  const coreDir = path.join(root, 'drizzle')
  const core = readdirSync(coreDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      id: `core/${file}`,
      path: path.join(coreDir, file),
      sql: readFileSync(path.join(coreDir, file), 'utf8'),
    }))
  const modulesDir = path.join(root, 'src/plugins/modules')
  if (!existsSync(modulesDir)) return core
  const plugins = readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const moduleRoot = path.join(modulesDir, entry.name)
      const migrationsDir = path.join(moduleRoot, 'migrations')
      if (!existsSync(migrationsDir)) return []
      const namespace = pluginNamespace(moduleRoot)
      return readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.sql'))
        .sort()
        .map((file) => {
          const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
          const id = `plugin/${entry.name}/${file}`
          validatePluginSql(id, namespace, sql)
          return { id, path: path.join(migrationsDir, file), sql }
        })
    })
  return [...core, ...plugins]
}
