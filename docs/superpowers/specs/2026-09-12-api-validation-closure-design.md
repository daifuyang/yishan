# API Validation Findings Closure Design

## Goal

Close the 2026-07-24 API validation report against the codebase as it exists today: retain the report as historical evidence, make its status and acceptance results accurate, and keep only genuinely unfinished API work in the active TODO index.

## Current Evidence

All six findings from the archived `docs/archive/fixes/FIX-api-validation-2026-07-24.md` already have production code and focused regression coverage, introduced primarily by commit `4097cb4`.

| Finding | Current implementation | Regression evidence |
|---|---|---|
| N1: 404 envelope | `app.ts` registers `setNotFoundHandler`; `ROUTE_NOT_FOUND` is `25005`. | `test/not-found.routes.test.ts` |
| N2: error-code separation | `ResourceErrorCode` exists; the global error handler maps HTTP 404 to it; dict routes use resource-specific not-found codes. | `test/admin.dicts.routes.test.ts` |
| N3: pagination limits | `PaginationQuerySchema` caps `page` at `100000` and `pageSize` at `100`; repository helpers cap offsets. | `test/pagination.test.ts`, `test/admin.dicts.routes.test.ts` |
| N4: login contract | Auth schemas and route responses use `data.token`, not `accessToken`. | `test/auth.routes.test.ts` |
| N5: logout authentication | `softAuthenticate` allows a body token as the logout fallback. | `test/auth.routes.test.ts` |
| N6: token statistics | API-token and user-token counts are separated; deprecated flat fields remain for compatibility. | `test/system.routes.test.ts` |

The separate OpenAPI security issue is also fixed by the route-level `onRoute` hook and is already archived under `docs/archive/todos/`.

## Decision

Treat the remaining work as documentation and verification closure, not a new API refactor. Do not change endpoint behavior, business-code values, or response shapes in this work item.

The original report will state that N1-N6 are complete only after their focused tests and the API test suite pass in the current worktree. It will be moved to `docs/archive/fixes/` because it is a resolved audit record, and all Markdown links to it will be updated. Code comments may retain its filename as a historical reference.

## Scope

In scope:

- Run focused N1-N6 regression tests, then the full `yishan-api` test suite.
- Confirm the current implementation still matches each report finding.
- Update the audit report with completion status, implementation references, and the actual verification date.
- Archive the resolved report and repair Markdown links.

Out of scope:

- Replacing resource-specific not-found codes with one global code.
- Removing deprecated token-statistics fields before downstream callers are audited.
- Changing logout semantics beyond the existing `softAuthenticate` flow.
- Adding an OpenAPI drift CI job; that remains `TODO-openapi-spec-sync.md`.

## Acceptance Criteria

- The six focused test files pass, and `pnpm --filter yishan-api test` passes.
- The archived report clearly distinguishes historical discovery from completed remediation.
- Every Markdown link to the archived report resolves.
- `TODO.md` retains only active work and does not reintroduce resolved N1-N6 items.
