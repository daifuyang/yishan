#!/usr/bin/env node
// Usage: node scripts/profiles/parse.mjs --profile <name>
// Reads profiles/<name>.yaml, validates against the profile schema, and emits
// a catalog JSON to artifacts/plugin-catalog.json (gitignored).
//
// This is the Wave 1 stub. Stage B will wire it into the real SDK and the
// AutoLoad removal work in ADR-003.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parse as parseYaml } from 'yaml'

const args = Object.fromEntries(process.argv.slice(2).map((arg, i, arr) => {
  const m = arg.match(/^--(.+)$/)
  return m ? [m[1], arr[i + 1]] : null
}).filter(Boolean))

if (!args.profile) {
  console.error('usage: node scripts/profiles/parse.mjs --profile <name>')
  process.exit(1)
}

const profilePath = join(process.cwd(), 'profiles', `${args.profile}.yaml`)
const profile = parseYaml(readFileSync(profilePath, 'utf8'))

// Stub: surface minimal validation so Wave 1 can prove the schema round-trips.
const errors = []
if (!profile.profile) errors.push('profile: missing top-level "profile" field')
if (!Array.isArray(profile.plugins)) errors.push('plugins: must be an array')
if (!Array.isArray(profile.targets)) errors.push('targets: must be an array')
for (const pluginId of profile.plugins ?? []) {
  if (!/^[\w-]+\/[\w-]+$/.test(pluginId)) {
    errors.push(`plugins[${pluginId}]: invalid plugin id (must match ^[\\w-]+/[\\w-]+$)`)
  }
}
if (errors.length) {
  console.error('[profile:parse] FAIL')
  for (const e of errors) console.error('  -', e)
  process.exit(1)
}

const catalog = {
  profile: profile.profile,
  version: profile.version,
  description: profile.description,
  samples: profile.samples ?? [],
  plugins: profile.plugins.map((id) => ({ id, kind: (profile.samples ?? []).includes(id) ? 'sample' : 'production' })),
  targets: profile.targets,
  generatedAt: new Date().toISOString(),
  sourceProfile: `${args.profile}.yaml`,
}

const outPath = join(process.cwd(), 'artifacts', 'plugin-catalog.json')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(catalog, null, 2))

console.log(`[profile:parse] PASS profile=${catalog.profile} plugins=${catalog.plugins.length} targets=${catalog.targets.length}`)
console.log(`[profile:parse] wrote ${outPath}`)