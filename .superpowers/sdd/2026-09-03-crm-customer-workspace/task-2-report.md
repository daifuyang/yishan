# Task 2 — Customer workspace shell report

## Delivered

- Added the compact customer workspace header, system-view tabs, quick filters, and advanced-filter Drawer.
- Wired supported URL query fields to the existing list request through the Task 1 query codec.
- Preserved the customer creation Drawer and its duplicate-customer handling; its entry point now sits in the workspace header.
- Added only module-scoped styling; no API or backend file was changed.

## Files

- `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx`
- `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerPageHeader.tsx`
- `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerViewTabs.tsx`
- `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerViewTabs.test.tsx`
- `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerFilterBar.tsx`
- `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerAdvancedFilterDrawer.tsx`
- `apps/yishan-admin/src/modules/crm/pages/customers/components/customerWorkspace.module.less`

## TDD evidence

- **RED:** `pnpm --filter yishan-admin test -- CustomerViewTabs.test.tsx -- --runInBand` failed before implementation with `Cannot find module './CustomerViewTabs'`.
- **GREEN:** the same command passed: 1 suite, 1 test, 0 snapshots.
- **Module lint:** `pnpm --filter yishan-admin biome:lint -- src/modules/crm/pages/customers` passed; 9 files checked, no fixes needed.
- **Whitespace:** `git diff --check` passed.
- **Project typecheck:** `pnpm --filter yishan-admin tsc` is blocked by pre-existing project setup errors (unavailable `@umijs/max` exports, generated Umi aliases, and `yishan-tiptap` resolution). The output did not identify a Task 2-specific error.

## Commit

- Implementation: `067c470fecbfa32f8e668ebb6414f29ebd34a020` — `feat(crm): add customer workspace filters and views`
