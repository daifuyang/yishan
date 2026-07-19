#!/usr/bin/env node
// scripts/docs/check.mjs — Wave 4 docs:check entry.
//
// PROPOSAL §8.3 demands an automated check that the root spec/contract
// documents stay aligned with the implementation. This script audits:
//
//   1. Root spec set (AGENTS.md, README.md, ARCHITECTURE.md,
//      PLUGIN_CONTRACT.md, RELEASE_CONTRACT.md, CONTRIBUTING.md,
//      MIGRATION_GUIDE.md) — listed explicitly, no directory listing
//      games that hide archived files.
//
//   2. Each spec must not mention the deprecated terms listed in
//      PROPOSAL §8.3 (`Prisma`, `core/models`, `prisma/schema`,
//      `plugins/modules`). Whitelist: any path under `specs/archive/`
//      and the literal string `prisma-era` (which appears in the
//      marker we use to flag legacy sections for grep-ability).
//
//   3. Any `pnpm <name>` invocation in the spec must correspond to a
//      script defined in the root package.json. Catches stale command
//      listings.
//
//   4. Markdown links of the form `(./relative/path)` must resolve to
//      an existing file relative to the doc location.
//
// Exit codes: 0 = clean, 1 = violations.
//
// This script is dependency-free; reads files only.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')

const ROOT_DOCS = [
  'AGENTS.md',
  'README.md',
  'ARCHITECTURE.md',
  'PLUGIN_CONTRACT.md',
  'RELEASE_CONTRACT.md',
  'CONTRIBUTING.md',
  'MIGRATION_GUIDE.md',
]

// MIGRATION_GUIDE is the canonical place to mention the legacy terms
// we migrated away from. Treat its references to Prisma / core/models /
// plugins/modules / prisma/schema as historical references rather than
// current-truth statements.
const FORBIDDEN_TERMS_WHITELIST = new Set(['MIGRATION_GUIDE.md'])

const FORBIDDEN_TERMS = [
  { term: 'Prisma', pattern: /\bPrisma\b/ },
  { term: 'core/models', pattern: /\bcore\/models\b/ },
  { term: 'prisma/schema', pattern: /\bprisma\/schema\b/ },
  { term: 'plugins/modules', pattern: /\bplugins\/modules\b/ },
]

const WHITELIST_HINTS = [
  /^prisma-era\b/,
]

function fail(msg, violations) {
  console.error('[docs:check] FAIL')
  for (const v of violations) {
    console.error(`  ${v}`)
  }
  console.error(`  ${msg}`)
  process.exit(1)
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

function checkForbiddenTerms(filePath, content) {
  const violations = []
  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    for (const { term, pattern } of FORBIDDEN_TERMS) {
      if (pattern.test(line)) {
        // Allow the literal `prisma-era` (whitelisted via WHITELIST_HINTS
        // match against the same line).
        const whitelisted = WHITELIST_HINTS.some((re) => re.test(line))
        if (!whitelisted) {
          violations.push(
            `${filePath}:${idx + 1}: forbidden term '${term}': ${line.slice(0, 120)}`,
          )
        }
      }
    }
  })
  return violations
}

function listRootScripts() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  return new Set(Object.keys(pkg.scripts ?? {}))
}

function checkPnpmCommands(filePath, content, scripts) {
  const violations = []
  // Match `pnpm <token>` where <token> is a script name AND does NOT
  // start with `-` (flag) and is not inside an inline code span.
  // Strategy: process the line by line so we can detect fenced code
  // blocks. Inside fences, treat the lines as code and look for the
  // first whitespace-separated token after `pnpm`.
  const lines = content.split('\n')
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (!inFence) continue
    // Inside a code fence. Match `pnpm <command>` and a second
    // occurrence if `pnpm -r ...`. Skip flag-prefixed lines and
    // placeholder tokens like `<name>`.
    const matches = [...line.matchAll(/\bpnpm\s+(?!--)([a-zA-Z][\w:-]*)/g)]
    for (const m of matches) {
      const cmd = m[1]
      // Token immediately followed by `<` is a placeholder variable
      // (e.g. `pnpm deploy:<provider>`); skip.
      const afterMatchIdx = m.index + m[0].length
      const afterChar = line.charAt(afterMatchIdx)
      if (afterChar === '<') continue
      if (!scripts.has(cmd)) {
        // Pseudo-commands not declared as scripts.
        const allowed = new Set(['install', 'add', 'remove', 'exec', 'run', 'i', 'dlx'])
        if (allowed.has(cmd)) continue
        violations.push(
          `${filePath}:${i + 1}: unknown pnpm script reference 'pnpm ${cmd}'`,
        )
      }
    }
  }
  return violations
}

function checkMarkdownLinks(filePath, content) {
  const violations = []
  const dir = dirname(filePath)
  // Match [text](relative-or-absolute) but skip http(s) and anchor links.
  const regex = /\]\(([^)]+)\)/g
  let m
  while ((m = regex.exec(content)) !== null) {
    const target = m[1].trim()
    if (!target) continue
    if (/^https?:\/\//.test(target)) continue
    if (target.startsWith('#')) continue
    // Strip optional title (foo.md "title").
    const cleaned = target.replace(/\s+["'].*["']$/, '').split('#')[0]
    if (!cleaned) continue
    const abs = join(dir, cleaned)
    if (!existsSync(abs)) {
      violations.push(`${filePath}: broken markdown link '${target}' (expected at ${relative(ROOT, abs)})`)
    }
  }
  return violations
}

function checkDocument(filePath, scripts) {
  const content = readText(filePath)
  const basename = filePath.split('/').pop()
  // The migration guide is the canonical home for legacy term
  // references (Prisma, plugins/modules, etc.); skip forbidden-term
  // detection there. Other checks still apply.
  const violations = []
  if (!FORBIDDEN_TERMS_WHITELIST.has(basename)) {
    violations.push(...checkForbiddenTerms(filePath, content))
  }
  violations.push(...checkPnpmCommands(filePath, content, scripts))
  violations.push(...checkMarkdownLinks(filePath, content))
  return violations
}

function main() {
  const scripts = listRootScripts()
  let allViolations = []

  console.log('[docs:check] starting')
  for (const doc of ROOT_DOCS) {
    const full = join(ROOT, doc)
    if (!existsSync(full)) {
      allViolations.push(`${doc}: missing root spec document`)
      continue
    }
    const v = checkDocument(full, scripts)
    if (v.length > 0) {
      console.log(`[docs:check] ${doc}: ${v.length} violation(s)`)
      allViolations = allViolations.concat(v)
    } else {
      console.log(`[docs:check] ${doc}: ok`)
    }
  }

  // Also scan ARCHIVE directory presence: per PROPOSAL §8.3, archived
  // historical docs must carry an explicit Archived marker, and they
  // are outside the root spec set so this script does not enforce
  // forbidden-term rules against them.
  const archiveDir = join(ROOT, 'specs', 'archive')
  if (!existsSync(archiveDir)) {
    console.log('[docs:check] specs/archive/ missing (allowed in Wave 4 only if absent)')
  }

  if (allViolations.length > 0) {
    fail(`${allViolations.length} total violation(s)`, allViolations)
  }

  console.log('[docs:check] PASS')
}

main()
