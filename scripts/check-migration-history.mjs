import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function checkMigrationHistory(root, baseline) {
  const errors = []
  const target = path => path.replace(/^apps\/yishan-api\/drizzle\//, 'packages/core/system-api/drizzle/')
    .replace(/^apps\/yishan-api\/src\/modules\//, 'apps/demo/api/src/modules/')
  for (const original of baseline.migrations) {
    const path = target(original.path)
    try {
      const content = readFileSync(resolve(root, path))
      const hash = createHash('sha256').update(content).digest('hex')
      if (hash !== (original.publishedSha256 ?? original.sha256)) errors.push(`${path}: published SQL changed`)
    } catch { errors.push(`${path}: published SQL missing`) }
  }
  for (const original of baseline.journals ?? []) {
    const path = target(original.path)
    try {
      const current = JSON.parse(readFileSync(resolve(root, path), 'utf8'))
      const previous = original.journal
      if (current.version !== previous.version || current.dialect !== previous.dialect
        || !Array.isArray(current.entries) || current.entries.length < previous.entries.length
        || previous.entries.some((entry, index) => JSON.stringify(entry) !== JSON.stringify(current.entries[index]))) {
        errors.push(`${path}: published journal identity or order changed`)
      }
    } catch { errors.push(`${path}: published journal missing or invalid`) }
  }
  return errors
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const baseline = JSON.parse(readFileSync(resolve(root, 'docs/architecture/api-v1-baseline.json'), 'utf8'))
  const errors = checkMigrationHistory(root, baseline)
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log(`[migration-history] ${baseline.migrations.length} published SQL hashes and ${baseline.journals?.length ?? 0} journal histories unchanged`)
}
