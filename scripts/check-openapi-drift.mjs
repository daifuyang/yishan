#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const specPath = process.argv[2] ?? 'apps/demo/api/openapi.json'

function git(args) {
  return spawnSync('git', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    )
  }
  return value
}

function canonical(jsonText) {
  return JSON.stringify(sortKeys(JSON.parse(jsonText)))
}

function pathList(jsonText) {
  const spec = JSON.parse(jsonText)
  return Object.keys(spec.paths ?? {}).sort()
}

const tracked = git(['ls-files', '--error-unmatch', '--', specPath])
if (tracked.status !== 0) {
  console.error(`[openapi-drift] ${specPath} must be tracked by Git`)
  process.exit(1)
}

const committed = git(['show', `HEAD:${specPath.replace(/\\/g, '/')}`])
if (committed.status !== 0) {
  console.error(`[openapi-drift] cannot read HEAD:${specPath}`)
  process.exit(1)
}

let working
try {
  working = readFileSync(specPath, 'utf8')
} catch {
  console.error(`[openapi-drift] cannot read ${specPath}`)
  process.exit(1)
}

if (canonical(committed.stdout) === canonical(working)) {
  console.log(`[openapi-drift] ${specPath} is in sync`)
  process.exit(0)
}

const committedPaths = pathList(committed.stdout)
const workingPaths = pathList(working)
const committedSet = new Set(committedPaths)
const workingSet = new Set(workingPaths)
const missing = workingPaths.filter((path) => !committedSet.has(path))
const extra = committedPaths.filter((path) => !workingSet.has(path))

console.error(
  `[openapi-drift] ${specPath} is out of sync. Run the API, execute the OpenAPI dump, and commit the result.`,
)
console.error(`[openapi-drift] committed paths: ${committedPaths.length}; dumped paths: ${workingPaths.length}`)
if (missing.length > 0) {
  console.error(`[openapi-drift] missing from commit (${missing.length}):`)
  for (const path of missing) console.error(`  + ${path}`)
}
if (extra.length > 0) {
  console.error(`[openapi-drift] extra in commit (${extra.length}):`)
  for (const path of extra) console.error(`  - ${path}`)
}
process.exit(1)
