# Task 1 implementation report

Commit: `5045388eff34c9427b7d2c903a062f55af75497c`

Changed files:

- `apps/yishan-admin/src/modules/crm/pages/customers/types.ts`
- `apps/yishan-admin/src/modules/crm/pages/customers/utils/customerWorkspaceQuery.ts`
- `apps/yishan-admin/src/modules/crm/pages/customers/utils/customerWorkspaceQuery.test.ts`
- `apps/yishan-admin/src/services/crm.ts`

TDD evidence:

- Red: the focused codec test failed because `customerWorkspaceQuery` was missing.
- Green: `pnpm --filter yishan-admin exec jest customerWorkspaceQuery.test.ts --runInBand` passed, 3 tests.
- Focused Biome lint, `git diff --check`, and `git show --check` passed.
- `pnpm --filter yishan-admin tsc` is blocked by existing generated Umi/dependency errors; task files no longer appear in its output after local fixes.

Scope statement: no backend/API files were changed. URL parsing rejects invalid view/page/customer values; list query mapping omits `customerId` and maps the UI-only `important` view to `level=important`.

## Review follow-up

Review fix commit: `7635d805fdb4465aec7f897084dbd8f9651a6194`

- `toCustomerListQuery` now maps UI filter names to the committed customer API contract: `collaboratorUserId` → `collaboratorId`, `tagId` → `tagIds`, and each UI `*AtFrom`/`*AtTo` field to its API date-boundary name.
- `CustomerListQuery` now uses the API field names and constrained customer type, pool status, sort field, and sort order types.
- URL parsing rejects page sizes above 200, keywords above 100 characters, unsupported sort/type/pool values, and invalid calendar date-times before a list request can be formed.

TDD evidence:

- Red: focused codec tests failed for leaked UI mapping names and for `pageSize=201` plus invalid enum/date/keyword URL values.
- Green: `pnpm --filter yishan-admin exec jest customerWorkspaceQuery.test.ts --runInBand` passed, 5 tests.
- Focused Biome lint and `git diff --check` passed.
