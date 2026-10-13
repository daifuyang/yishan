# Mobile Login Log Detail API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace in-memory login-log detail handoff with a user-scoped API, synchronized OpenAPI, and a refresh/deep-link safe mobile detail page.

**Architecture:** Add a repository query constrained by both log ID and current user ID, expose it through the existing `LoginLogService` and app-user route registrar, dump the runtime OpenAPI, and update the App's existing hand-written API client. The App detail page consumes that client and existing detail/state components; list and detail requests remain account-scoped.

**Tech Stack:** Fastify 5, TypeBox, Drizzle, Vitest, hand-written TypeScript API client, Taro 4/React.

**Spec:** `docs/superpowers/specs/2026-10-13-mobile-page-alignment-design.md`

## Global Constraints

- Use the existing `PERMS.LIST_MY_LOGINS` permission for both list and detail.
- Return `LOGIN_LOG_NOT_FOUND` for missing, soft-deleted, and other-user records.
- Do not add a table or migration; preserve `sysLoginLog` response semantics.
- `apps/demo/app` uses a hand-written client under `src/api`; only the OpenAPI JSON artifacts are dumped and committed.
- The OpenAPI path and the hand-written client method/path must be checked together — `pnpm check:openapi` only compares the two JSON artifacts, so the client's path is pinned by a client-path test (`apps/demo/app/tests/organization.test.cjs`).

---

### Task 1: Add repository and service behavior

**Files:**
- Modify: `packages/core/system-api/src/core/repositories/login-log.repository.ts`
- Modify: `packages/core/system-api/src/core/services/login-log.service.ts`
- Test: `packages/core/system-api/test/login-log.service.test.ts`

**Interfaces:**
- Produces repository method:

  ```ts
  LoginLogRepository.findByIdForUser(id: number, userId: number): Promise<LoginLogDetailRow | null>
  ```

- Produces service method:

  ```ts
  LoginLogService.getMyLoginLogById(userId: number, id: number): Promise<SysLoginLogResp>
  ```

- [ ] **Step 1: Write service tests for the three visibility cases**

  Spy on `findByIdForUser` and assert a mapped response for a matching row; assert `BusinessError` with `SystemManageErrorCode.LOGIN_LOG_NOT_FOUND` for `null`; assert the same error for a row belonging to another user by making the repository return `null` for the constrained query.

- [ ] **Step 2: Run the focused Vitest file and confirm failure**

  ```bash
  pnpm exec vitest run packages/core/system-api/test/login-log.service.test.ts
  ```

  Expected: FAIL because the repository and service methods do not exist.

- [ ] **Step 3: Implement the constrained repository query**

  Add `findByIdForUser` using the existing public columns and `fetchLoginLogDetail` query shape, with `and(eq(sysLoginLog.id, id), eq(sysLoginLog.userId, userId), isNull(sysLoginLog.deletedAt))`. Keep the existing unconstrained admin `findById` unchanged.

- [ ] **Step 4: Implement the service mapping and uniform error**

  Call `findByIdForUser`, throw the existing `LOGIN_LOG_NOT_FOUND` business error when no row is returned, and map the row with `LoginLogMapper.toResp`.

- [ ] **Step 5: Run the focused tests and commit**

  ```bash
  pnpm exec vitest run packages/core/system-api/test/login-log.service.test.ts
  git add packages/core/system-api/src/core/repositories/login-log.repository.ts packages/core/system-api/src/core/services/login-log.service.ts packages/core/system-api/test/login-log.service.test.ts
  git commit -m "feat(system-api): add user-scoped login log lookup"
  ```

### Task 2: Add the app route and route tests

**Files:**
- Modify: `packages/core/system-api/src/core/routes/api/v1/app/users/index.ts`
- Test: `packages/core/system-api/test/my-login-log.routes.test.ts`

**Interfaces:**
- Consumes: `LoginLogService.getMyLoginLogById` from Task 1.
- Produces: `GET /api/v1/app/users/me/login-logs/:id`, operationId `appGetMyLoginLog`, response `$ref: sysLoginLogDetailResp#`.

- [ ] **Step 1: Add route tests for params, permission, and response delegation**

  Assert the route schema has positive integer `params.id`, operationId `appGetMyLoginLog`, `PERMS.LIST_MY_LOGINS`, and `sysLoginLogDetailResp#`; mock the service and assert it receives `request.currentUser.id` and the numeric route ID.

- [ ] **Step 2: Run the focused route test and confirm failure**

  ```bash
  pnpm exec vitest run packages/core/system-api/test/my-login-log.routes.test.ts
  ```

- [ ] **Step 3: Register the route immediately after the list route**

  Use the existing `createRouteRegistrar` and `ResponseUtil.success`; keep route handlers limited to parameter extraction, service call, and response wrapping.

- [ ] **Step 4: Run route and API tests**

  ```bash
  pnpm exec vitest run packages/core/system-api/test/my-login-log.routes.test.ts
  pnpm test:api
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/core/system-api/src/core/routes/api/v1/app/users/index.ts packages/core/system-api/test
  git commit -m "feat(system-api): expose my login log detail route"
  ```

### Task 3: Dump OpenAPI and update the App client

**Files:**
- Modify: `apps/demo/api/openapi.json`
- Modify: `docs/architecture/api-v1-runtime-openapi.json`
- Modify: `apps/demo/app/src/api/user.ts`
- Test: `packages/core/system-api/test/openapi-login-log.test.ts`

- [ ] **Step 1: Generate the runtime contract**

  ```bash
  pnpm --filter @yishan/demo-api openapi:dump
  ```

  Confirm the new path, operationId, params schema, and response reference are present.

- [ ] **Step 2: Update the architecture baseline using the existing baseline convention**

  Add the exact generated path and operation to `docs/architecture/api-v1-runtime-openapi.json`; do not hand-edit unrelated paths or schemas.

- [ ] **Step 3: Update the hand-written App client and inspect the diff**

  Add `getMyLoginLog(id: number)` beside `getMyLoginLogs` in `apps/demo/app/src/api/user.ts`, using `request<LoginLog>({ method: 'GET', path: `/api/v1/app/users/me/login-logs/${id}` })`. The existing `LoginLog` interface already contains the detail fields, so do not change `apps/demo/app/src/api/types.ts`. Confirm that no admin generated client is imported by the App.

- [ ] **Step 4: Run contract checks**

  ```bash
  pnpm check:openapi
  git diff -- apps/demo/api/openapi.json docs/architecture/api-v1-runtime-openapi.json
  ```

- [ ] **Step 5: Commit the contract and client together**

  ```bash
  git add apps/demo/api/openapi.json docs/architecture/api-v1-runtime-openapi.json apps/demo/app/src/api/user.ts packages/core/system-api/test/openapi-login-log.test.ts
  git commit -m "chore(api): sync mobile login log detail client"
  ```

### Task 4: Convert the mobile login-log list to server-backed pagination

**Files:**
- Modify: `apps/demo/app/src/pages/profile/login-log/index.tsx`
- Modify: `apps/demo/app/src/pages/profile/login-log/index.module.scss`
- Modify: `apps/demo/app/tests/login-log-management.test.cjs`

**Interfaces:**
- Consumes: `userApi.getMyLoginLogs`, `useListPagination`, `ManagementFilterBar`, `ManagementFilterTriggers`, `DateRangeSheet`, `ManagementList`, and `ManagementStates`.
- Produces: list rows whose navigation passes only the numeric log ID; no `rememberLoginLog` call.

- [ ] **Step 1: Add a failing assertion that navigation does not store the row**

  Assert the list imports no `handoff` module, calls `userApi.getMyLoginLogs` through `useListPagination`, and renders status/sort/time filters with shared management controls.

- [ ] **Step 2: Run the focused list test**

  ```bash
  node --test apps/demo/app/tests/login-log-management.test.cjs
  ```

- [ ] **Step 3: Implement server-backed filters and navigation**

  Use `useListPagination` with the existing list endpoint; translate status/sort/time-range state into the endpoint query; navigate with `?id=${row.id}` only. Preserve current account scope and permission guard.

- [ ] **Step 4: Run the focused test and commit**

  ```bash
  node --test apps/demo/app/tests/login-log-management.test.cjs
  git add apps/demo/app/src/pages/profile/login-log/index.tsx apps/demo/app/src/pages/profile/login-log apps/demo/app/tests/login-log-management.test.cjs
  git commit -m "refactor(app): paginate profile login logs from server"
  ```

### Task 5: Convert the detail page to real fetch with retry and scope protection

**Files:**
- Modify: `apps/demo/app/src/pages/profile/login-log/detail/index.tsx`
- Delete: `apps/demo/app/src/pages/profile/login-log/handoff.ts`
- Test: `apps/demo/app/tests/profile-login-log-detail.test.cjs`

**Interfaces:**
- Consumes: hand-written `userApi.getMyLoginLog`, `ManagementStates`/`StateView`, `withAccountScope`, existing detail layout components.
- Produces: detail page state machine `loading | ready | error | missing`, with retry and no in-memory dependency.

- [ ] **Step 1: Add failing detail-page tests**

  Test successful ID fetch, invalid ID, network/API failure with retry, and a stale response after account/session change. Assert the page never renders a record supplied by the old handoff module.

- [ ] **Step 2: Run the focused detail test and confirm failure**

  ```bash
  node --test apps/demo/app/tests/profile-login-log-detail.test.cjs
  ```

- [ ] **Step 3: Implement the detail request lifecycle**

  Read `useRouter().params.id`, validate it as a positive integer, capture the current account/session version, call `userApi.getMyLoginLog`, and apply the response only when the scope is still current. Render loading, retryable error, and missing/not-found states through the existing state components.

- [ ] **Step 4: Remove the handoff module and list writes**

  Delete `pages/profile/login-log/handoff.ts`; remove all `rememberLoginLog`/`recallLoginLog` imports and calls.

- [ ] **Step 5: Run detail, App, and API checks**

  ```bash
  node --test apps/demo/app/tests/profile-login-log-detail.test.cjs
  pnpm --filter @yishan/demo-app test
  pnpm test:api
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add apps/demo/app/src/pages/profile/login-log apps/demo/app/tests
  git commit -m "fix(app): load profile login log detail from API"
  ```

### Task 6: Run the complete interface-line quality gate

- [ ] **Step 1: Verify contract files and source residuals**

  ```bash
  rg -n "rememberLoginLog|recallLoginLog|handoff" apps/demo/app/src/pages/profile/login-log
  pnpm check:openapi
  git diff --check
  ```

  Expected: no handoff references and no OpenAPI/client contract drift.

- [ ] **Step 2: Run all required API and mobile checks**

  ```bash
  pnpm test:api
  pnpm test:integration
  pnpm typecheck:mobile
  pnpm --filter @yishan/demo-app test
  pnpm build:app
  pnpm check:taro
  pnpm check:boundaries
  ```

- [ ] **Step 3: Run H5 browser checks for login-log list/detail**

  Use the existing isolated browser harness at 320px and 390px. Verify direct navigation to a valid ID, refresh, retry after a failed request, and an ID belonging to another user.
