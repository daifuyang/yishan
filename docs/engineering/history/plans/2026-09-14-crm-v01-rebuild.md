# CRM V0.1 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a customer-centered CRM MVP from customer entry through contract payment.

**Architecture:** Preserve the existing CRM module, customer workspace, Drawer shell, and Drizzle conventions. Replace the separate Lead domain with Customer status and public-pool state, complete the sales objects, and expose the flow through dense list pages and detail Drawers.

**Tech Stack:** React 19, Ant Design Pro, Umi Max, Fastify 5, Drizzle ORM, MySQL, Vitest, Jest, Taro.

**Spec:** `docs/superpowers/specs/2026-09-14-crm-v01-design.md`

## Global Constraints

- Modify only CRM product code, CRM docs, routes, menus, schema, migrations, and CRM tests.
- Reuse the existing Customer Drawer, ProTable style, responsive width hook, and semantic theme tokens.
- Use one Customer aggregate; do not add a Lead compatibility path.
- Do not add dependencies or change non-CRM modules.
- Use Chinese MVP copy without explanatory subtitles.

### Task 1: Establish CRM V0.1 domain constants and destructive schema migration

**Files:**
- Create: `apps/yishan-api/src/modules/crm/domain/statuses.ts`
- Create: `apps/yishan-api/src/modules/crm/drizzle/0052_crm-v01-customer-lifecycle.sql`
- Modify: `apps/yishan-api/src/modules/crm/db/schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/seed.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/crm-v01-statuses.test.ts`

- [ ] Write failing tests for the five customer states, five opportunity stages, quotation, contract, and task labels.
- [ ] Implement typed `value`, `label`, and `semantic` status descriptors used by API and UI.
- [ ] Replace lead tables and payment-plan/write-off schema with customer status code, a simple payment table, and task/attachment tables.
- [ ] Write migration SQL that drops test-data-only lead and payment complexity before creating the V0.1 tables and indexes.
- [ ] Run `pnpm --filter yishan-api test -- crm-v01-statuses`.

### Task 2: Complete CRM API lifecycle services

**Files:**
- Create: `apps/yishan-api/src/modules/crm/repositories/contract.repository.ts`
- Create: `apps/yishan-api/src/modules/crm/repositories/payment.repository.ts`
- Create: `apps/yishan-api/src/modules/crm/repositories/task.repository.ts`
- Create: `apps/yishan-api/src/modules/crm/services/contract.service.ts`
- Create: `apps/yishan-api/src/modules/crm/services/payment.service.ts`
- Create: `apps/yishan-api/src/modules/crm/services/task.service.ts`
- Create: `apps/yishan-api/src/modules/crm/schemas/contract.schema.ts`
- Create: `apps/yishan-api/src/modules/crm/schemas/payment.schema.ts`
- Create: `apps/yishan-api/src/modules/crm/schemas/task.schema.ts`
- Create: `apps/yishan-api/src/modules/crm/routes/v1/contracts/index.ts`
- Create: `apps/yishan-api/src/modules/crm/routes/v1/payments/index.ts`
- Create: `apps/yishan-api/src/modules/crm/routes/v1/tasks/index.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/permissions.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/customer.service.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/contract-payment-service.test.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/customer-pool-flow.test.ts`

- [ ] Write failing contract-payment tests covering contract creation from quotation and 100000 minus two payments.
- [ ] Implement contract, payment, and task CRUD with customer-scope access checks.
- [ ] Implement quotation-to-contract creation and payment aggregation in transaction-safe services.
- [ ] Update customer status after opportunity creation, contract creation, and lost opportunity actions.
- [ ] Run the two focused Vitest suites.

### Task 3: Remove Lead domain and reshape menus/routes

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/config/system-menu.json`
- Modify: `apps/yishan-api/src/modules/crm/schemas/permissions.ts`
- Delete: `apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts`
- Delete: `apps/yishan-api/src/modules/crm/services/lead.service.ts`
- Delete: `apps/yishan-api/src/modules/crm/services/lead-conversion.service.ts`
- Delete: `apps/yishan-admin/src/modules/crm/pages/leads/*`
- Delete: `apps/yishan-admin/src/modules/crm/pages/lead-pool/*`
- Test: `apps/yishan-api/src/modules/crm/tests/menu-v01.test.ts`

- [ ] Write a menu test asserting no lead paths and all V0.1 paths.
- [ ] Replace the CRM menu tree with customer management, sales management, and workbench groups.
- [ ] Remove lead permissions and ensure dynamic routes have no lead component references.
- [ ] Run API menu and admin route unit tests.

### Task 4: Deliver Customer workspace and drawer lifecycle views

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/domain/statuses.ts`
- Create: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/OverviewTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/JourneyTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/ContractsTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/PaymentsTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/TasksTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/AttachmentsTab.tsx`
- Modify: `apps/yishan-admin/src/services/crm.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawer.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/ContactsTab.tsx`
- Test: `apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawer.test.tsx`

- [ ] Write Drawer tests for the nine tabs and primary `新增跟进` action.
- [ ] Extend the CRM service client with the V0.1 entities.
- [ ] Rebuild customer columns and filters around status, owner, source, follow-up dates, and opportunity amount.
- [ ] Present manual and system journey events with distinct visual treatments.
- [ ] Run the customer workspace and Drawer Jest tests.

### Task 5: Deliver sales and workbench list/Drawer pages

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/opportunities/index.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/quotations/index.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/contracts/index.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/payments/index.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/tasks/index.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/products/index.tsx`
- Create: `apps/yishan-admin/src/modules/crm/components/drawer/EntityDetailDrawer.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/dashboard/index.tsx`
- Test: `apps/yishan-admin/src/modules/crm/pages/contracts/index.test.tsx`

- [ ] Write contract list tests for received and remaining amount rendering.
- [ ] Implement ProTable list pages using shared filters and the detail Drawer.
- [ ] Implement quotation copying, voiding, and conversion to contract.
- [ ] Restrict the dashboard to the specified operational counters, to-do list, recent activity, and sales funnel.
- [ ] Run list page Jest tests.

### Task 6: Update mobile entries and product documentation

**Files:**
- Modify: `apps/yishan-app/src/app.config.ts`
- Modify: `apps/yishan-app/src/pages/apps/index.tsx`
- Modify: `docs/products/crm/README.md`
- Create: `docs/products/crm/客户管理/公海.md`
- Create: `docs/products/crm/客户管理/跟进记录.md`
- Create: `docs/products/crm/工作台/任务.md`
- Create: `docs/products/crm/工作台/产品服务.md`
- Modify: `docs/products/crm/客户管理/客户.md`
- Modify: `docs/products/crm/客户管理/联系人.md`
- Modify: `docs/products/crm/销售管理/商机.md`
- Modify: `docs/products/crm/销售管理/报价单.md`
- Modify: `docs/products/crm/销售管理/合同.md`
- Modify: `docs/products/crm/销售管理/回款.md`
- Move: `docs/products/crm/销售管理/拜访.md` to `docs/products/crm/archive/拜访.md`
- Move: `docs/products/crm/销售管理/工单.md` to `docs/products/crm/archive/工单.md`

- [ ] Write mobile workbench configuration tests for the eight actions.
- [ ] Keep the four-tab navigation and add the CRM workbench grid.
- [ ] Rewrite each V0.1 document with positioning, scenarios, structure, functions, fields, states, operations, rules, permissions, empty states, errors, and exclusions.
- [ ] Run mobile lint and documentation link checks.

### Task 7: Verify end-to-end business acceptance

**Files:**
- Create: `apps/yishan-api/src/modules/crm/tests/crm-v01-acceptance.test.ts`
- Create: `apps/yishan-admin/e2e/modules/crm-v01.spec.ts`

- [ ] Write API acceptance tests for customer-to-follow-up, opportunity-to-quotation-to-contract, payments, and public-pool reassignment.
- [ ] Write Playwright flows for the user-facing path and absence of lead routes.
- [ ] Run `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm --filter yishan-api test:integration`, and CRM Playwright tests.

### Task 8: Make Customer Lifecycle a Projected State Machine

**Files:**
- Create: `apps/yishan-api/src/modules/crm/drizzle/0055_crm-customer-relationship-status.sql`
- Modify: `apps/yishan-api/src/modules/crm/db/schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/domain/statuses.ts`
- Modify: `apps/yishan-api/src/modules/crm/repositories/customer.repository.ts`
- Modify: `apps/yishan-api/src/modules/crm/repositories/contract.repository.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/customer-lifecycle.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/customer.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/opportunity.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/contract.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/customer.schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/customers/index.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/customer-lifecycle-state-machine.test.ts`

**Interfaces:**
- Produces `CustomerLifecycleService.recalculate(customerId, updaterId, db): Promise<CustomerStatusCode>` as the sole writer of effective `statusCode`.
- Produces `CustomerService.transitionRelationshipStatus({ id, target, reasonCode, remark, currentUser })` for user-driven transitions.
- `statusCode` remains the five-value UI projection; `relationshipStatus` is only `potential | following | lost`.

- [ ] **Step 1: Write failing state-machine tests.**

```ts
it('keeps a won opportunity at opportunity until a qualifying commercial fact exists', async () => {
  const status = await lifecycle.recalculate(customerId, userId, db)
  expect(status).toBe('opportunity')
})

it('does not turn a customer into customer for a draft contract', async () => {
  expect(await lifecycle.recalculate(customerId, userId, db)).toBe('following')
})

it('blocks lost while an active opportunity exists', async () => {
  await expect(customerService.transitionRelationshipStatus(input)).rejects.toMatchObject({ code: 'CRM_CUSTOMER_STATUS_TRANSITION_INVALID' })
})
```

- [ ] **Step 2: Run the focused test file and confirm the current implementation fails because it treats won opportunities and every live contract as a sale.**

Run: `pnpm --filter yishan-api test -- customer-lifecycle-state-machine`

- [ ] **Step 3: Add the destructive development migration and schema field.**

```sql
ALTER TABLE crm_customer
  ADD COLUMN relationship_status VARCHAR(16) NOT NULL DEFAULT 'potential' AFTER status_code;
UPDATE crm_customer
  SET relationship_status = CASE status_code
    WHEN 'lost' THEN 'lost'
    WHEN 'following' THEN 'following'
    ELSE 'potential'
  END;
```

Add an index on `relationship_status`; use a subsequent projector migration to recompute the existing effective status from active/won opportunities and `performing`/`completed` contracts.

- [ ] **Step 4: Implement projection and guarded transition service.**

The projector must use this exact precedence: `lost`, then qualifying contract/direct close, then active-or-won opportunity, then stored relationship status. A qualifying contract is only `performing` or `completed`. Marking lost requires a reason and no qualifying fact or active/won opportunity. Reactivation must target `following` with a remark. The generic customer create and PATCH schemas must not accept `statusCode` or `relationshipStatus`; generic repository update must only receive lifecycle fields from lifecycle code. Persist a `status_change` activity with `{ from, to, reasonCode, remark, source }` in the same transaction.

- [ ] **Step 5: Make opportunity and contract mutations call the same projector.**

Call it after opportunity create, advance, win, lose, and delete; and after contract create, update status, and delete. Reject opportunity and contract creation for a lost customer before any side effects.

- [ ] **Step 6: Run focused lifecycle and existing CRM service tests.**

Run: `pnpm --filter yishan-api test -- customer-lifecycle-state-machine opportunity-service contract-payment-service followup-recalc`

### Task 9: Add Controlled No-Contract Close

**Files:**
- Create: `apps/yishan-api/src/modules/crm/drizzle/0056_crm-direct-close.sql`
- Modify: `apps/yishan-api/src/modules/crm/db/schema.ts`
- Create: `apps/yishan-api/src/modules/crm/repositories/direct-close.repository.ts`
- Create: `apps/yishan-api/src/modules/crm/services/direct-close.service.ts`
- Create: `apps/yishan-api/src/modules/crm/schemas/direct-close.schema.ts`
- Create: `apps/yishan-api/src/modules/crm/routes/v1/direct-closes/index.ts`
- Modify: `apps/yishan-api/src/modules/crm/module.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/customer-lifecycle.service.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/direct-close.service.test.ts`

**Interfaces:**
- Produces `DirectCloseService.confirm(opportunityId, input, currentUser)` and `DirectCloseService.revoke(id, input, currentUser)`.
- Produces `crm_direct_close` as a commercial fact, never a contract or order.

- [ ] **Step 1: Write failing direct-close tests.**

```ts
it('only confirms a direct close from a won opportunity', async () => {
  await expect(service.confirm(openOpportunityId, payload, user)).rejects.toMatchObject({ code: 'CRM_DIRECT_CLOSE_OPPORTUNITY_NOT_WON' })
})

it('projects a confirmed direct close as customer and restores opportunity when revoked', async () => {
  await service.confirm(wonOpportunityId, payload, user)
  expect((await customerService.detail(customerId, user)).statusCode).toBe('customer')
  await service.revoke(directCloseId, { reason: '录入错误' }, user)
  expect((await customerService.detail(customerId, user)).statusCode).toBe('opportunity')
})
```

- [ ] **Step 2: Run the direct-close test and confirm it fails because no record/service exists.**

Run: `pnpm --filter yishan-api test -- direct-close.service`

- [ ] **Step 3: Add the direct-close table and repository.**

```sql
CREATE TABLE crm_direct_close (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  opportunity_id INT NOT NULL,
  amount_cents BIGINT NOT NULL,
  closed_at DATETIME NOT NULL,
  evidence_type VARCHAR(32) NOT NULL,
  attachment_ids JSON NULL,
  remark VARCHAR(2000) NULL,
  revoked_at DATETIME NULL,
  revoked_reason VARCHAR(500) NULL,
  creator_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updater_id INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Enforce one non-revoked direct close per opportunity in the service transaction. Keep evidence types exactly `payment_proof`, `order_confirmation`, `verbal_confirmation`, and `other`.

- [ ] **Step 4: Implement confirm/revoke in transactions.**

Confirmation requires a non-negative safe-integer amount, close date, evidence type, and either attachment IDs or a non-empty remark. It writes a customer system activity and recalculates lifecycle. Revocation requires a non-empty reason, writes its activity, and recalculates lifecycle. Both require access to the opportunity's customer.

- [ ] **Step 5: Register routes and run tests.**

Expose `POST /crm/v1/opportunities/:id/direct-close` and `POST /crm/v1/direct-closes/:id/revoke`; return the direct-close record and projected customer status. Run: `pnpm --filter yishan-api test -- direct-close.service customer-lifecycle-state-machine`.

### Task 10: Replace Direct Customer Status Editing in the Drawer

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/domain/statuses.ts`
- Modify: `apps/yishan-admin/src/services/crm.ts`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/OverviewTab.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/sub/CustomerActivityRail.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawer.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawer.test.tsx`
- Test: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/OverviewTab.test.tsx`

**Interfaces:**
- Consumes `transitionCustomerRelationshipStatus(id, { target, reasonCode?, remark? })` and read-only `statusCode`/`relationshipStatus`.
- Consumes the direct-close route only from the opportunity detail action, never from Customer Drawer status controls.

- [ ] **Step 1: Write failing Drawer tests.**

```tsx
it('shows lost as a separate terminal state rather than a step after customer', () => {
  render(<OverviewTab customer={{ statusCode: 'following' }} />)
  expect(screen.getByText('已流失')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '标记流失' })).toBeVisible()
})

it('uses the transition endpoint instead of generic customer patch', async () => {
  await user.click(screen.getByRole('button', { name: '标记跟进中' }))
  expect(crmApi.transitionCustomerRelationshipStatus).toHaveBeenCalledWith(12, { target: 'following' })
})
```

- [ ] **Step 2: Run the focused test and confirm it fails because status changes still use the generic update client.**

Run: `pnpm --filter yishan-admin test -- OverviewTab`

- [ ] **Step 3: Implement presentation and actions.**

Render `潜在 -> 跟进中 -> 有商机 -> 已成交` as a read-only projected path. Render `已流失` only when current, otherwise offer it in More with a reason dialog. Offer reactivation only for lost customers and require a remark. Do not render a manual action for `opportunity` or `customer`; show its originating fact and link to the relevant tab. Keep the existing left-information/right-activity layout and current responsive rail width.

- [ ] **Step 4: Make follow-up promotion server-driven.**

Remove the client-side `updateCustomer({ statusCode })` after activity creation. The follow-up API is responsible for promoting potential to following and writing a system event. Refresh Drawer data after activity creation.

- [ ] **Step 5: Run focused Drawer tests and admin typecheck.**

Run: `pnpm --filter yishan-admin test -- CustomerDrawer OverviewTab`

Run: `pnpm --filter yishan-admin exec tsc --noEmit`

### Task 11: Verify Lifecycle Regression Paths

**Files:**
- Create: `apps/yishan-api/src/modules/crm/tests/customer-lifecycle-acceptance.test.ts`
- Modify: `docs/products/crm/README.md`

- [ ] **Step 1: Write acceptance tests for every status-sensitive sales path.**

```ts
it('requires reactivation before a lost customer can create an opportunity', async () => {
  await customerService.transitionRelationshipStatus({ id: customerId, target: 'lost', reasonCode: 'no_need', currentUser: user })
  await expect(opportunityService.create(openOpportunity, user)).rejects.toMatchObject({ code: 'CRM_CUSTOMER_LOST' })
})

it('does not count a draft or terminated contract as customer', async () => {
  await contractService.create({ ...contractInput, status: 'draft' }, user)
  expect((await customerService.detail(customerId, user)).statusCode).toBe('following')
})

it('keeps a won but unsigned opportunity at opportunity', async () => {
  await opportunityService.markWon(opportunityId, user)
  expect((await customerService.detail(customerId, user)).statusCode).toBe('opportunity')
})

it('allows a contract path and controlled no-contract path to customer', async () => {
  await contractService.update(contractId, { status: 'performing' }, user)
  expect((await customerService.detail(customerId, user)).statusCode).toBe('customer')
  await directCloseService.confirm(wonOpportunityId, directCloseInput, user)
  expect((await customerService.detail(customerId, user)).statusCode).toBe('customer')
})

it('restores the correct effective status after commercial facts are removed', async () => {
  await directCloseService.revoke(directCloseId, { reason: '重复录入' }, user)
  expect((await customerService.detail(customerId, user)).statusCode).toBe('opportunity')
})
```

- [ ] **Step 2: Run the acceptance suite and resolve any failures in the responsible service, not in test-only helpers.**

Run: `pnpm --filter yishan-api test -- customer-lifecycle-acceptance`

- [ ] **Step 3: Update product documentation.**

Document the distinction between relationship state, opportunity stage, contract fact, direct close, and the status guardrails. State explicitly that direct close is not an order or a substitute contract.

- [ ] **Step 4: Execute final targeted verification.**

Run: `pnpm --filter yishan-api test -- customer-lifecycle-state-machine direct-close.service customer-lifecycle-acceptance opportunity-service contract-payment-service followup-recalc`.

Run: `pnpm --filter yishan-admin test -- CustomerDrawer OverviewTab`.

Run: `pnpm --filter yishan-api exec tsc --noEmit` and `pnpm --filter yishan-admin exec tsc --noEmit`.
