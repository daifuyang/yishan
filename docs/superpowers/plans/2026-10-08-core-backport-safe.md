# Core safe backport implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Bring proven framework improvements from `all` into local `main`, keeping the commercial CRM independent.

**Architecture:** Backport bounded final implementations rather than merging the business branch. Preserve Core schema, demo modules, storage and deployment behavior. Keep source provenance and verify the combined Core runtime.

**Tech Stack:** pnpm 8.15.9, Node 22.22.1, Fastify, TypeScript, Umi, Jest, Vitest.

**Spec:** User-approved analysis in `docs/analysis/2026-10-08-yishan-core-merge.md` (design document preserved with this batch). This plan executes only its confident subset.

## Global Constraints

- Base `0dc03c7`; source `b0764f4`. Read target implementation and related tests before changes.
- Do not import CRM/public quotation, sys_enum, permission hooks, schema/migrations, storage or deployment changes.
- Preserve the original all checkout, user backup and analysis files. No remote push.
- Merge verified commits into local main; this is already authorized by the user.
- Use existing tests as regression specifications; demonstrate red then green for changed behavior.
- Coordinator owns package/config/lockfile changes and commits. Implementers do not dispatch subagents.

### Task 1: Portable build and shared development target

**Files:** API/app/docs package.json, pnpm-lock.yaml, pnpm-workspace.yaml; packages/shared-config; admin config/proxy.ts; app config/dev.ts and config/index.ts; relevant consumer package.json.

**Interfaces:** Produce `API_TARGET` from `@yishan/shared-config`, default http://localhost:3100, override YISHAN_API_TARGET. No production deploy changes.

- [x] Read source commits 25b67dc, 58c97ab, 021016c, f0819ca, 7a5fd5c and current consumers.
- [x] Port only cross-env/rimraf scripts, exclude example workspaces and source-only shared config. Keep existing unrelated dependencies; regenerate lock with pinned pnpm.
- [x] Verify frozen install, API build, app/docs typechecks and actual shared target import/default/override behavior.

```powershell
pnpm install --lockfile-only
pnpm install --frozen-lockfile
pnpm --filter yishan-api build:ts
```

### Task 2: API Core correctness and complete CRUD

**Files:** src/core/routes/admin-crud.ts; routes/api/v1/admin/{users,departments,positions,roles,menus,dicts}/index.ts; test/admin-crud.test.ts, admin.dicts.routes.test.ts, admin.menus.routes.test.ts; core/module-loader/module-loader.ts; scripts/onboard-modules.ts; app.ts; core/permissions/catalog.ts; constants/business-codes/index.ts; test/app.auth.routes.test.ts and business-error-response.test.ts (all paths under apps/yishan-api).

**Interfaces:** CRUD permissions declared before catalog initialization, retain role grant and menu access behavior. Module loader uses dist-first fallback without preferSrc. Only app auth login/refresh join bypass catalog. Reserved integer 33xxx module errors map to HTTP 400; existing 30xxx–32xxx behavior retained.

- [x] Read main routes, schemas, services and tests; transplant source regression tests first and record failing run.
- [x] Port final bounded CRUD files (including c2d9e30 permission declaration and 6444469 aliases), loader (5a4f0a9), slash-normalized dev exclusion, app bypass and error range hunks. No full mixed commit cherry-pick.
- [x] Run focused suites, entire API tests and build:ts; inspect final Core contract and regenerate admin client only if contract changes.

```powershell
pnpm --filter yishan-api exec vitest run test/admin-crud.test.ts test/admin.dicts.routes.test.ts test/admin.menus.routes.test.ts test/app.auth.routes.test.ts test/business-error-response.test.ts
pnpm --filter yishan-api test
pnpm --filter yishan-api build:ts
```

### Task 3: Admin nested menus and login error ownership

**Files:** apps/yishan-admin/src/utils/dynamicRoutes.ts, utils/__tests__/dynamicRoutes.test.ts, app.tsx (flatten only), requestErrorConfig.ts, utils/__tests__/requestErrorConfig.test.ts, pages/user/login/index.tsx; config/config.ts (development output only).

**Interfaces:** Flatten pathless directory chains preserving page routes. Login form owns authentication errors through skipErrorHandler; expired protected requests retain global handling. PUBLIC_PATH/avatar behavior stays unchanged.

- [x] Read main and closest tests, port tests first, record failing run.
- [x] Port final dynamic routes utility and narrow app.tsx integration; port login 401 classification and correct duplicate global toast/form Alert; isolate development output from dist.
- [x] Run focused Jest, all admin tests, lint/typecheck and build. Add meaningful login ownership regression if existing tests do not cover it.

```powershell
pnpm --filter yishan-admin exec jest --runInBand src/utils/__tests__/dynamicRoutes.test.ts src/utils/__tests__/requestErrorConfig.test.ts
pnpm --filter yishan-admin test -- --runInBand
pnpm --filter yishan-admin lint
pnpm --filter yishan-admin build
```

### Task 4: Integration verification, review and local merge

**Files:** This plan and concise verification/provenance notes only; bounded fixes from reviews if necessary.

- [x] Review each task against constraints; fix material findings.
- [x] Run pnpm lint, pnpm test, pnpm build plus API build explicitly and app build if supported. Identify pre-existing failures against main before ruling on scope.
- [x] Request independent whole-branch review against original main. Verify no commercial modules/schema/deployment changes.
- [x] Commit reviewed batches and fast-forward local main from a separate main worktree. Verify branch heads and original all worktree status. No push.

```powershell
git diff --check
node scripts/check-main-baseline.mjs
git merge --ff-only core/backport-safe
```
