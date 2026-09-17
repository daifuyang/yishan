# API Validation Findings Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the existing N1-N6 API fixes, record the results accurately, and archive the resolved validation report without breaking its references.

**Architecture:** This is a documentation-closure change backed by current regression tests. The API implementation remains untouched; tests establish that the existing code still satisfies each historical finding, then the report is moved from the repository root into the fixes archive and linked documentation is updated.

**Tech Stack:** TypeScript, Fastify, Vitest, Markdown, Git, PowerShell.

**Spec:** `docs/superpowers/specs/2026-09-12-api-validation-closure-design.md`

## Global Constraints

- Do not change API behavior, error-code values, OpenAPI response schemas, or token-statistics compatibility fields in this closure work.
- Use the current code and fresh test output as the source of truth; do not mark a finding complete from an old commit alone.
- Preserve the historical problem description and recommended remediation in the archived report.
- Keep `TODO-openapi-spec-sync.md` active; it owns the unresolved OpenAPI drift CI work.

---

### Task 1: Verify the Existing N1-N6 Regression Suite

**Files:**
- Verify: `apps/yishan-api/test/not-found.routes.test.ts`
- Verify: `apps/yishan-api/test/admin.dicts.routes.test.ts`
- Verify: `apps/yishan-api/test/pagination.test.ts`
- Verify: `apps/yishan-api/test/auth.routes.test.ts`
- Verify: `apps/yishan-api/test/system.routes.test.ts`

**Interfaces:**
- Consumes: Existing Fastify handlers, schemas, services, and route plugins.
- Produces: Fresh evidence that N1-N6 remain covered before their audit record is closed.

- [x] **Step 1: Run the focused regression files.**

```powershell
pnpm --filter yishan-api exec vitest run test/not-found.routes.test.ts test/admin.dicts.routes.test.ts test/pagination.test.ts test/auth.routes.test.ts test/system.routes.test.ts
```

Observed: exit code `0`; 5 files and 60 tests passed.

- [x] **Step 2: Run the complete API suite.**

```powershell
pnpm --filter yishan-api test
```

Observed: exit code `0`; 48 files and 491 tests passed, with 24 integration tests skipped by environment conditions.

### Task 2: Close and Archive the Validation Report

**Files:**
- Move: `FIX-api-validation-2026-07-24.md` to `docs/archive/fixes/FIX-api-validation-2026-07-24.md`
- Create: `docs/archive/fixes/README.md`
- Modify: `docs/archive/fixes/FIX-api-validation-2026-07-24.md`

**Interfaces:**
- Consumes: The passing results from Task 1 and code references listed in the design.
- Produces: A resolved audit record whose status, checklist, and location are unambiguous.

- [x] **Step 1: Create the archive directory and README.**

```markdown
# 已归档修复记录

这里保存已经验证完成的缺陷发现与修复记录。当前待办以仓库根目录 `TODO.md` 为准。
```

- [x] **Step 2: Move the report and update its status block.**

Replace the current `状态：待 review` line with a completion line containing the Task 1 verification date. Add a concise N1-N6 completion table that links each finding to its implementation and focused test file. Keep the original discovery details below it.

- [x] **Step 3: Mark only verified acceptance checkboxes complete.**

For each N1-N6 section, convert the existing unchecked acceptance items to checked items only when Task 1 proves them. Replace obsolete proposed paths or values with the actual implementation references: `ROUTE_NOT_FOUND=25005`, `ResourceErrorCode`, `PaginationQuerySchema`, `softAuthenticate`, and `apiTokens` / `userTokens`.

### Task 3: Repair References and Verify Documentation Integrity

**Files:**
- Modify: `TODO-openapi-spec-sync.md`
- Modify: Any Markdown file returned by the reference scan below
- Verify: `TODO.md`

**Interfaces:**
- Consumes: The archived report path from Task 2.
- Produces: No stale relative Markdown link to the root-level report and no resolved findings in the active TODO index.

- [x] **Step 1: Locate every Markdown reference to the report.**

```powershell
rg -n 'FIX-api-validation-2026-07-24\.md' -g '*.md' .
```

Expected: a small, explicit list of Markdown references to update; source-code comments are not links and remain unchanged.

- [x] **Step 2: Update relative links to `docs/archive/fixes/FIX-api-validation-2026-07-24.md`.**

For files at repository root use `./docs/archive/fixes/FIX-api-validation-2026-07-24.md`; calculate an equivalent relative path for files below `docs/`.

- [x] **Step 3: Confirm active TODO scope and whitespace integrity.**

```powershell
rg -n 'N1|N2|N3|N4|N5|N6|FIX-api-validation' TODO.md TODO-*.md
git diff --check
```

Expected: `TODO.md` contains only the admin-route factory and OpenAPI drift tasks; `git diff --check` exits `0`.

- [ ] **Step 4: Commit the closure documentation.**

```powershell
git add docs/archive/fixes TODO-openapi-spec-sync.md TODO.md
git commit -m "docs(api): archive verified validation findings"
```
