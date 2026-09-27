# Task 4 Report: Customer Workspace and Drawer

## Delivered

- Reworked the existing customer Drawer to expose only: Overview, Journey, Contacts, Opportunities, Quotations, Contracts, Payments, Tasks, and Attachments.
- Added the Overview detail fields and financial summary: owner, status, level, source, industry, region, primary contact, follow-up times, open opportunity, cumulative contract, received, and remaining amounts.
- Made `新增跟进` the primary header action and connected it to the existing follow-up form in the Overview activity rail.
- Added lifecycle list tabs backed by CRM opportunities, quotations, contracts, payments, and tasks endpoints.
- Made Journey distinguish manual follow-ups from system events through different icon, tag, and rule treatment.
- Extended the admin CRM client with types and CRUD/list calls for contracts, payments, and tasks.
- Kept the ProTable customer workspace and removed the collaborator field from its advanced-filter UI.

## Verification

- `pnpm --filter yishan-admin jest --runInBand src/modules/crm/components/drawer/CustomerDrawer.test.tsx`
- `pnpm --filter yishan-admin jest --runInBand src/modules/crm/pages/customers/utils/customerWorkspaceQuery.test.ts src/modules/crm/components/customers/CustomerTableColumns.test.tsx`
- `pnpm --filter yishan-admin exec biome lint ...` for the changed CRM admin files

The full admin `tsc --noEmit` remains blocked by pre-existing Umi generated-type and workspace module resolution failures, including missing exports from `@umijs/max`.

## Review Follow-up

- Journey now combines manual customer activities with customer-scoped opportunity, quotation, contract, and payment system events, newest first.
- Overview and Payments load all paginated opportunities and contracts before calculating financial aggregates or retrieving contract payments.
- Lifecycle statuses now use shared Chinese labels and Ant Design semantic colors for opportunities, quotations, contracts, and tasks.
- Added a focused system-event projection test and updated the drawer-service mock for paginated loading.

## Review Verification

- `pnpm --filter yishan-admin jest --runInBand src/modules/crm/components/drawer/tabs/journeyEvents.test.ts src/modules/crm/components/drawer/CustomerDrawer.test.tsx src/modules/crm/pages/customers/utils/customerWorkspaceQuery.test.ts src/modules/crm/components/customers/CustomerTableColumns.test.tsx` (4 suites, 19 tests passed)
- `pnpm --filter yishan-admin exec biome lint ...` for all 12 changed CRM admin files (passed)
- `pnpm --filter yishan-admin exec tsc --noEmit` remains blocked by pre-existing workspace-wide Umi generated-type/module-resolution errors.

## Contract Journey Follow-up

- Contract API responses now include `createdAt`, allowing Journey to emit a creation event for every contract.
- Journey no longer labels a contract's historical signing or effective date with its current status. The API does not provide a reliable contract status-transition timestamp, so no contract status event is projected.
- Added a regression test for a performing contract whose creation, signing, and effective dates differ.

## Contract Journey Verification

- `pnpm --filter yishan-admin jest --runInBand src/modules/crm/components/drawer/tabs/journeyEvents.test.ts src/modules/crm/components/drawer/CustomerDrawer.test.tsx` (2 suites, 3 tests passed)
- `pnpm --filter yishan-api test -- tests/contract-payment-service.test.ts` (1 file, 8 tests passed)
