#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const specPath = process.argv[2] ?? 'apps/yishan-api/openapi.json'

function git(args) {
  return spawnSync('git', args, { encoding: 'utf8' })
}

const tracked = git(['ls-files', '--error-unmatch', '--', specPath])
if (tracked.status !== 0) {
  console.error(`[openapi-drift] ${specPath} must be tracked by Git`)
  process.exit(1)
}

const unstaged = git(['diff', '--quiet', '--', specPath])
const staged = git(['diff', '--cached', '--quiet', '--', specPath])
if (unstaged.status !== 0 || staged.status !== 0) {
  console.error(
    `[openapi-drift] ${specPath} is out of sync. Run the API, execute the OpenAPI dump, and commit the result.`,
  )
  process.exit(1)
}

console.log(`[openapi-drift] ${specPath} is in sync`)
