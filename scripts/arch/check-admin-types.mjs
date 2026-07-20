#!/usr/bin/env node
// scripts/arch/check-admin-types.mjs — P1-3 admin type-boundary gate.
//
// Handwritten Admin code must NOT depend on the generated ambient `API.*`
// namespace (apps/yishan-admin/src/services/generated/typings.d.ts). It should
// import stable types from `@yishan/admin-sdk` instead, so OpenAPI field churn
// does not cascade into pages. See AGENTS.md §6 / PROPOSAL P1-3.
//
// Migration is incremental: files listed in ALLOWLIST below are the not-yet-
// migrated pages and are tolerated for now. This list must only ever SHRINK —
// do not add new entries; migrate the file to @yishan/admin-sdk instead. A
// stale entry (migrated or deleted) is reported so it can be removed.
//
// Scope: apps/yishan-admin/src/**/*.{ts,tsx}, excluding generated/, *.d.ts
// (tsc-emitted declaration artifacts), and .umi / .umi-test caches.
//
// Exit codes: 0 = clean, 1 = a non-allowlisted file references API.*
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = join(dirname(__filename), '..', '..')
const ADMIN_SRC = join(ROOT, 'apps', 'yishan-admin', 'src')

// Not-yet-migrated pages. SHRINK ONLY.
const ALLOWLIST = new Set([
  'apps/yishan-admin/src/pages/account/center/index.tsx',
  'apps/yishan-admin/src/pages/system/attachments/components/AttachmentFolderForm.tsx',
  'apps/yishan-admin/src/pages/system/attachments/index.tsx',
  'apps/yishan-admin/src/pages/system/department/components/DepartmentForm.tsx',
  'apps/yishan-admin/src/pages/system/department/index.tsx',
  'apps/yishan-admin/src/pages/system/dict/components/DictDataForm.tsx',
  'apps/yishan-admin/src/pages/system/dict/components/DictDataManager.tsx',
  'apps/yishan-admin/src/pages/system/dict/components/DictTypeForm.tsx',
  'apps/yishan-admin/src/pages/system/dict/index.tsx',
  'apps/yishan-admin/src/pages/system/login-log/index.tsx',
  'apps/yishan-admin/src/pages/system/menu/components/MenuForm.tsx',
  'apps/yishan-admin/src/pages/system/menu/index.tsx',
  'apps/yishan-admin/src/pages/system/plugins/index.tsx',
  'apps/yishan-admin/src/pages/system/position/components/PositionForm.tsx',
  'apps/yishan-admin/src/pages/system/position/index.tsx',
  'apps/yishan-admin/src/pages/system/role/components/RoleForm.tsx',
  'apps/yishan-admin/src/pages/system/role/index.tsx',
  'apps/yishan-admin/src/pages/system/storage/index.tsx',
  'apps/yishan-admin/src/pages/system/user/components/UserForm.tsx',
  'apps/yishan-admin/src/pages/system/user/index.tsx',
  'apps/yishan-admin/src/pages/user/login/index.tsx',
])

const API_RE = /\bAPI\./

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'generated' || entry.name.startsWith('.umi') || entry.name === 'node_modules') continue
      yield* walk(full)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      yield full
    }
  }
}

const violations = []
const seenAllowed = new Set()

for (const file of walk(ADMIN_SRC)) {
  const rel = relative(ROOT, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  const hits = []
  lines.forEach((line, i) => {
    if (API_RE.test(line)) hits.push({ line: line.trim().slice(0, 100), n: i + 1 })
  })
  if (hits.length === 0) continue
  if (ALLOWLIST.has(rel)) {
    seenAllowed.add(rel)
    continue
  }
  for (const h of hits) {
    violations.push(
      `${rel}:${h.n}: handwritten Admin code must not reference generated API.* — ` +
        `import stable types from @yishan/admin-sdk instead: ${h.line}`,
    )
  }
}

// Report (do not fail on) stale allowlist entries so the list keeps shrinking.
const stale = [...ALLOWLIST].filter((f) => !seenAllowed.has(f))
for (const f of stale) {
  console.warn(`[arch:admin-types] allowlist entry no longer uses API.* (migrated or removed) — please drop it: ${f}`)
}

if (violations.length > 0) {
  console.error(`[arch:admin-types] FAIL ${violations.length} violation(s):`)
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log(
  `[arch:admin-types] PASS (allowlist: ${ALLOWLIST.size} file(s) pending migration${stale.length ? `, ${stale.length} stale` : ''})`,
)
