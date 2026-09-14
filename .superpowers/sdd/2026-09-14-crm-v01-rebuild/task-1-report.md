# Task 1 Report: CRM V0.1 Domain Constants and Schema Migration

## Scope

Implemented Task 1 from `task-1-brief.md` in the CRM API module only:

- Added one typed status descriptor contract for customer, opportunity,
  quotation, contract, and task states.
- Removed lead, ticket, payment-plan, payment-actual, and write-off table
  declarations from the Drizzle CRM schema.
- Added V0.1 `crm_payment`, `crm_task`, and `crm_attachment` table
  declarations and indexes.
- Added the destructive `0052_crm-v01-customer-lifecycle.sql` migration.
- Updated CRM enum seeding to emit the V0.1 lifecycle and status labels.

## TDD Evidence

### RED

Command:

```powershell
pnpm --filter yishan-api test -- crm-v01-statuses
```

Result: exit 1. Vitest collected three tests, all failed because the required
`../domain/statuses.js` module did not exist. The assertion reported that the
module promise rejected with `ERR_MODULE_NOT_FOUND`, which was the expected
absence of the feature under test.

### GREEN

Command:

```powershell
pnpm --filter yishan-api test -- crm-v01-statuses
```

Result: exit 0.

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

The final green run was performed after the complete schema cleanup.

## Changed Files

- `apps/yishan-api/src/modules/crm/domain/statuses.ts`
- `apps/yishan-api/src/modules/crm/db/schema.ts`
- `apps/yishan-api/src/modules/crm/drizzle/0052_crm-v01-customer-lifecycle.sql`
- `apps/yishan-api/src/modules/crm/seed.ts`
- `apps/yishan-api/src/modules/crm/tests/crm-v01-statuses.test.ts`

## Self-Review

- `crm_customer.status_code` is now required and defaults to `potential`;
  legacy nullable `status_id` remains unchanged.
- The migration deletes lead activity records, drops test-data-only legacy
  tables, normalizes unsupported customer status codes, and removes obsolete
  enum values before creating the V0.1 tables and indexes.
- The quotation descriptor includes `superseded` because the existing
  quotation service transitions accepted quotations into that state. Its label
  matches the service's existing user-facing wording.
- `git diff --check` completed without whitespace errors.
- The requested focused suite was run. A full TypeScript build was not run for
  this task because legacy lead services/routes remain until Task 3 while their
  Drizzle declarations are intentionally removed by this task; the plan's
  focused verification command is the status suite above.
