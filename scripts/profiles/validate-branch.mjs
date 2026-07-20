#!/usr/bin/env node
// scripts/profiles/validate-branch.mjs — Wave 5 CI gate.
//
// Usage:
//   node scripts/profiles/validate-branch.mjs
//
// Reads the current git branch (from .git/HEAD) and maps it to a profile:
//   - main  → core
//   - all   → official
//   - any other branch → throw, no silent fallback.
//
// Then runs profile:validate for that profile. This script is the CI
// entry that replaces the old `pnpm profile:validate` step in
// yishan-fullstack-ci.yml so that a `main` push cannot accidentally
// validate `official` (and vice-versa).
//
// Per PROPOSAL §6 / §11: validation failures must throw and exit non-zero;
// this script deliberately does NOT catch and log — the caller (pnpm
// script) propagates the exit code.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')

const BRANCH_TO_PROFILE = {
  main: 'core',
  all: 'official',
}

function readCurrentBranch() {
  const headPath = join(ROOT, '.git', 'HEAD')
  if (!existsSync(headPath)) {
    throw new Error(
      `.git/HEAD missing at ${headPath}; refusing to infer profile from branch`,
    )
  }
  const head = readFileSync(headPath, 'utf8').trim()
  // HEAD contents look like:
  //   ref: refs/heads/main        → branch mode
  //   <sha>                        → detached HEAD (CI shallow clones); fall
  //                                  back to refs/heads/<branch> via env or
  //                                  GITHUB_REF.
  if (head.startsWith('ref: ')) {
    return head.slice('ref: '.length).replace(/^refs\/heads\//, '')
  }
  // Detached: try environment overrides first.
  const envBranch = process.env.GITHUB_REF_NAME
    ?? process.env.YISHAN_BRANCH
    ?? process.env.CI_COMMIT_REF_NAME
  if (envBranch) return envBranch
  throw new Error(
    `detached HEAD (raw HEAD="${head.slice(0, 20)}...") and no GITHUB_REF_NAME / YISHAN_BRANCH env; cannot infer profile from branch`,
  )
}

function profileForBranch(branch) {
  const profile = BRANCH_TO_PROFILE[branch]
  if (!profile) {
    const known = Object.keys(BRANCH_TO_PROFILE).join(', ')
    throw new Error(
      `branch '${branch}' does not map to a known profile (expected one of: ${known})`,
    )
  }
  return profile
}

function validateProfile(profile) {
  const validator = join(SCRIPT_DIR, 'validate.mjs')
  const result = spawnSync(
    process.execPath,
    [validator, '--profile', profile],
    { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' },
  )
  if (result.status !== 0) {
    throw new Error(
      `profile:validate failed for branch-derived profile '${profile}' (exit ${result.status})`,
    )
  }
}

function main() {
  // CI workflow sets YISHAN_PROFILE via the 'Determine profile from branch'
  // step. Honor it as the authoritative source so feature/refactor branches
  // that fall back to core don't trip the strict branch mapping here.
  const envProfile = process.env.YISHAN_PROFILE
  const branch = readCurrentBranch()

  if (envProfile) {
    // eslint-disable-next-line no-console
    console.log(
      `[profile:validate:ci] branch=${branch} → profile=${envProfile} (from YISHAN_PROFILE env)`,
    )
    validateProfile(envProfile)
    // eslint-disable-next-line no-console
    console.log(
      `[profile:validate:ci] PASS branch=${branch} profile=${envProfile}`,
    )
    return
  }

  const profile = profileForBranch(branch)
  // eslint-disable-next-line no-console
  console.log(`[profile:validate:ci] branch=${branch} → profile=${profile}`)
  validateProfile(profile)
  // eslint-disable-next-line no-console
  console.log(`[profile:validate:ci] PASS branch=${branch} profile=${profile}`)
}

main()