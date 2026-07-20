#!/usr/bin/env node
// scripts/arch/check-admin-types.mjs — P1-3 admin type-boundary gate.
//
// Handwritten Admin code must NOT depend on the generated ambient `API.*`
// namespace (apps/yishan-admin/src/services/generated/typings.d.ts). It should
// import stable types from `@yishan/admin-sdk` instead, so OpenAPI field churn
// does not cascade into pages. See AGENTS.md §6 / PROPOSAL P1-3.
//
// Migration is incremental and ratcheted by a per-file BASELINE of tolerated
// API.* occurrences (the not-yet-migrated pages). Rules:
//   - A file NOT in the baseline may not reference API.* at all (new files and
//     already-migrated files are gated immediately).
//   - A baseline file may not INCREASE its API.* count — no new API.* deps may
//     be added to a pending page (this is the ratchet requested in review).
//   - A baseline file whose count DROPPED is reported so the baseline can be
//     tightened; a file that reached 0 (fully migrated) or was deleted is
//     reported so its entry can be removed. The baseline must only shrink.
//
// Scope: apps/yishan-admin/src/**/*.{ts,tsx}, excluding services/generated/,
// *.d.ts (tsc-emitted), and .umi / .umi-test caches.
//
// Exit codes: 0 = clean, 1 = a gated file references API.* / a count increased.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = join(dirname(__filename), '..', '..')
const ADMIN_SRC = join(ROOT, 'apps', 'yishan-admin', 'src')

// Not-yet-migrated pages → max tolerated API.* occurrences. SHRINK ONLY.
// Do NOT add entries and do NOT raise counts — migrate the file instead.
const BASELINE = {
  'apps/yishan-admin/src/pages/account/center/index.tsx': 4,
  'apps/yishan-admin/src/pages/system/attachments/components/AttachmentFolderForm.tsx': 5,
  'apps/yishan-admin/src/pages/system/attachments/index.tsx': 15,
  'apps/yishan-admin/src/pages/system/department/components/DepartmentForm.tsx': 3,
  'apps/yishan-admin/src/pages/system/department/index.tsx': 1,
  'apps/yishan-admin/src/pages/system/dict/components/DictDataForm.tsx': 3,
  'apps/yishan-admin/src/pages/system/dict/components/DictDataManager.tsx': 2,
  'apps/yishan-admin/src/pages/system/dict/components/DictTypeForm.tsx': 3,
  'apps/yishan-admin/src/pages/system/dict/index.tsx': 3,
  'apps/yishan-admin/src/pages/system/login-log/index.tsx': 2,
  'apps/yishan-admin/src/pages/system/menu/components/MenuForm.tsx': 5,
  'apps/yishan-admin/src/pages/system/menu/index.tsx': 7,
  'apps/yishan-admin/src/pages/system/plugins/index.tsx': 3,
  'apps/yishan-admin/src/pages/system/position/components/PositionForm.tsx': 3,
  'apps/yishan-admin/src/pages/system/position/index.tsx': 2,
  'apps/yishan-admin/src/pages/system/role/components/RoleForm.tsx': 11,
  'apps/yishan-admin/src/pages/system/role/index.tsx': 3,
  'apps/yishan-admin/src/pages/system/storage/index.tsx': 13,
  'apps/yishan-admin/src/pages/system/user/components/UserForm.tsx': 6,
  'apps/yishan-admin/src/pages/system/user/index.tsx': 2,
  'apps/yishan-admin/src/pages/user/login/index.tsx': 1,
}

const API_OCCURRENCE = /\bAPI\./g

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
const warnings = []
const seen = new Set()

for (const file of walk(ADMIN_SRC)) {
  const rel = relative(ROOT, file)
  const count = (readFileSync(file, 'utf8').match(API_OCCURRENCE) ?? []).length
  if (count === 0) continue
  if (!(rel in BASELINE)) {
    violations.push(
      `${rel}: ${count} reference(s) to generated API.* — import stable types from @yishan/admin-sdk instead ` +
        `(this file is not in the migration baseline)`,
    )
    continue
  }
  seen.add(rel)
  const allowed = BASELINE[rel]
  if (count > allowed) {
    violations.push(
      `${rel}: API.* usage increased ${allowed} → ${count}; do not add new API.* dependencies to a pending page — ` +
        `migrate it to @yishan/admin-sdk`,
    )
  } else if (count < allowed) {
    warnings.push(`${rel}: API.* usage dropped ${allowed} → ${count}; tighten the baseline to ${count}`)
  }
}

// Baseline entries that no longer have any API.* (fully migrated) or were removed.
for (const rel of Object.keys(BASELINE)) {
  if (!seen.has(rel)) warnings.push(`${rel}: no longer references API.* (migrated or removed); drop it from the baseline`)
}

for (const w of warnings) console.warn(`[arch:admin-types] ${w}`)

if (violations.length > 0) {
  console.error(`[arch:admin-types] FAIL ${violations.length} violation(s):`)
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

const pending = Object.keys(BASELINE).length
console.log(
  `[arch:admin-types] PASS (baseline: ${pending} file(s) pending migration${warnings.length ? `, ${warnings.length} baseline note(s)` : ''})`,
)
