#!/usr/bin/env node
// scripts/profiles/parse.mjs — Wave 4 catalog generator.
//
// Usage:
//   node scripts/profiles/parse.mjs --profile <name>
//   pnpm profile:catalog --profile <name>
//
// Reads profiles/<name>.yaml, validates against the profile schema (see
// `scripts/profiles/schema.mjs` for the rule list), and emits an
// immutable `artifacts/plugin-catalog.json`. ADR-002 §Context names the
// catalog the single source of truth for runtime plugin loading.
//
// Two-mode behaviour:
//   * No --profile arg → print usage, exit 1.
//   * --profile <name> → validate + write catalog, exit 0/1.
//
// The schema is intentionally tiny:
//   - top-level `profile` must equal the file basename (no drift)
//   - `plugins` must be a non-empty array of `vendor/slug` ids
//   - each plugin id must satisfy `^[\w-]+/[\w-]+$`
//   - `targets` must be a subset of the 5 allowed release targets
//   - `verify.db.services` must be a non-empty string array
//
// Cross-cutting checks (plugin manifest validity, plugin.ts presence,
// imports) live in `scripts/profiles/validate.mjs`; this script keeps
// fast single-file schema validation so `pnpm profile:catalog` stays
// cheap to run.
import { parse as parseYaml } from 'yaml'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, arr) => {
      const m = arg.match(/^--(.+)$/)
      return m ? [m[1], arr[i + 1]] : null
    })
    .filter(Boolean),
)

if (!args.profile) {
  console.error('usage: node scripts/profiles/parse.mjs --profile <name>')
  process.exit(1)
}

const ALLOWED_TARGETS = new Set(['api', 'admin', 'app-weapp', 'app-h5', 'docs'])
const PLUGIN_ID_RE = /^[\w-]+\/[\w-]+$/

function fail(errors) {
  console.error('[profile:parse] FAIL')
  for (const e of errors) console.error('  -', e)
  process.exit(1)
}

function readProfileText(name) {
  const profilePath = join(ROOT, 'profiles', `${name}.yaml`)
  if (!existsSync(profilePath)) {
    return { ok: false, error: `profile not found at ${profilePath}` }
  }
  let raw
  try {
    raw = readFileSync(profilePath, 'utf8')
  } catch (err) {
    return { ok: false, error: err.message }
  }
  return { ok: true, raw, path: profilePath }
}

function validateShape(profile, fileName) {
  const errors = []
  if (typeof profile.profile !== 'string' || profile.profile.length === 0) {
    errors.push('profile: missing top-level "profile" string')
  } else if (profile.profile !== fileName) {
    errors.push(`profile: top-level "profile" ("${profile.profile}") must equal file basename ("${fileName}")`)
  }
  if (!Array.isArray(profile.plugins)) {
    errors.push('plugins: must be an array')
  } else if (profile.plugins.length === 0) {
    errors.push('plugins: must be a non-empty array')
  }
  if (!Array.isArray(profile.targets)) {
    errors.push('targets: must be an array')
  } else if (profile.targets.length === 0) {
    errors.push('targets: must be a non-empty array')
  } else if (profile.targets.some((t) => !ALLOWED_TARGETS.has(t))) {
    errors.push(
      `targets: each entry must be one of ${[...ALLOWED_TARGETS].join(', ')}; got [${profile.targets.join(', ')}]`,
    )
  }
  if (!Array.isArray(profile.samples) && profile.samples !== undefined) {
    errors.push('samples: when present must be an array')
  }
  // plugins[].id pattern
  if (Array.isArray(profile.plugins)) {
    const seen = new Set()
    for (const id of profile.plugins) {
      if (typeof id !== 'string' || !PLUGIN_ID_RE.test(id)) {
        errors.push(
          `plugins[${JSON.stringify(id)}]: invalid plugin id (must match ^${PLUGIN_ID_RE.source}$)`,
        )
        continue
      }
      if (seen.has(id)) {
        errors.push(`plugins: duplicate plugin id '${id}'`)
      }
      seen.add(id)
    }
  }
  // verify.db.services must be a non-empty string array (ADR-004)
  if (profile.verify !== undefined) {
    if (typeof profile.verify !== 'object' || profile.verify === null) {
      errors.push('verify: must be an object')
    } else if (profile.verify.db !== undefined) {
      const db = profile.verify.db
      if (typeof db !== 'object' || db === null) {
        errors.push('verify.db: must be an object')
      } else {
        if (!Array.isArray(db.services)) {
          errors.push('verify.db.services: must be an array of service strings')
        } else if (db.services.length === 0) {
          errors.push('verify.db.services: must be non-empty')
        } else if (db.services.some((s) => typeof s !== 'string' || s.length === 0)) {
          errors.push('verify.db.services: each entry must be a non-empty string')
        }
      }
    }
  }
  return errors
}

function main() {
  const read = readProfileText(args.profile)
  if (!read.ok) {
    return fail([read.error])
  }
  let profile
  try {
    profile = parseYaml(read.raw)
  } catch (err) {
    return fail([`profile yaml is invalid: ${err.message}`])
  }
  const shapeErrors = validateShape(profile, args.profile)
  if (shapeErrors.length) return fail(shapeErrors)

  const catalog = {
    profile: profile.profile,
    version: profile.version,
    description: profile.description,
    samples: Array.isArray(profile.samples) ? profile.samples : [],
    plugins: profile.plugins.map((id) => ({
      id,
      kind: Array.isArray(profile.samples) && profile.samples.includes(id) ? 'sample' : 'production',
      // Runtime entry, derived from the id convention. Core mounts the
      // default export of `api.entry` under `api.prefix` inside the gate.
      // release:validate imports every plugin's entry generically (no
      // per-plugin special cases).
      api: {
        prefix: `/api/plugins/${id}/v1`,
        entry: `api/plugins/${id}/api/register.js`,
      },
    })),
    targets: profile.targets,
    verify: profile.verify ?? null,
    generatedAt: new Date().toISOString(),
    sourceProfile: `${args.profile}.yaml`,
  }

  const outPath = join(ROOT, 'artifacts', 'plugin-catalog.json')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(catalog, null, 2))

  console.log(
    `[profile:parse] PASS profile=${catalog.profile} plugins=${catalog.plugins.length} targets=${catalog.targets.length}`,
  )
  console.log(`[profile:parse] wrote ${outPath}`)
}

main()
