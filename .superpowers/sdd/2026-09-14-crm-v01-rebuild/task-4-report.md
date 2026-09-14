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
