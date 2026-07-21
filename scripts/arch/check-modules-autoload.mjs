#!/usr/bin/env node
/**
 * Light-weight module discovery contract (Stage 1: modules-autoload-stage1).
 *
 * Scans `apps/yishan-api/src/modules/` for sub-directories and verifies:
 *   M1 — every module directory contains a `routes.ts`
 *   M2 — `routes.ts` exports a `meta` const with a string `id`
 *   M3 — the directory name equals `meta.id` (skip names starting with `_`)
 *
 * Stage 1 deliberately avoids stricter checks (Fastify plugin signature,
 * `defaultEnabled` type, prefix shape, route schema) so the new path can
 * land without forcing the existing hello plugin to migrate. Stage 2 will
 * harden these once `plugins/yishan/hello` is moved into `modules/hello/`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const repoRoot = process.cwd()
const modulesRoot = join(repoRoot, 'apps/yishan-api/src/modules')

const violations = []

if (!existsSync(modulesRoot)) {
  // Stage 1 is opt-in: no modules/ directory means the new path is unused.
  process.stdout.write('[modules-autoload] no modules/ directory found; nothing to check\n')
  process.exit(0)
}

for (const entry of readdirSync(modulesRoot)) {
  const dir = join(modulesRoot, entry)
  if (!statSync(dir).isDirectory()) continue

  const routesFile = join(dir, 'routes.ts')
  if (!existsSync(routesFile)) {
    violations.push({ entry, rule: 'M1', message: 'missing routes.ts' })
    continue
  }

  const source = readFileSync(routesFile, 'utf8')
  const metaMatch = source.match(/export\s+const\s+meta\s*=\s*\{([\s\S]*?)\}/)
  if (!metaMatch) {
    violations.push({ entry, rule: 'M2', message: 'missing `export const meta = { ... }`' })
    continue
  }

  const idMatch = metaMatch[1].match(/id\s*:\s*['"`]([^'"`]+)['"`]/)
  if (!idMatch) {
    violations.push({ entry, rule: 'M2', message: 'meta.id must be a string literal' })
    continue
  }

  const declaredId = idMatch[1]
  if (!entry.startsWith('_') && declaredId !== entry) {
    violations.push({
      entry,
      rule: 'M3',
      message: `meta.id="${declaredId}" must equal directory name="${entry}"`,
    })
  }
}

if (violations.length === 0) {
  process.stdout.write(`[modules-autoload] PASS ${readdirSync(modulesRoot).filter((e) => statSync(join(modulesRoot, e)).isDirectory()).length} module(s)\n`)
  process.exit(0)
}

process.stderr.write(`[modules-autoload] FAIL ${violations.length} violation(s)\n`)
for (const v of violations) {
  process.stderr.write(`  - ${v.rule} ${relative(repoRoot, join(modulesRoot, v.entry))}: ${v.message}\n`)
}
process.exit(1)