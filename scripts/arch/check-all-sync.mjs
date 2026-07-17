#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function refExists(ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', ref])
    return true
  } catch {
    return false
  }
}

const mainRef = refExists('origin/main') ? 'origin/main' : 'main'

try {
  git(['merge-base', '--is-ancestor', mainRef, 'HEAD'])
  console.log(`[branch:all-sync] PASS: HEAD contains ${mainRef}`)
} catch {
  console.error(`[branch:all-sync] FAIL: all must contain the latest ${mainRef} commit before merge or release`)
  process.exit(1)
}
