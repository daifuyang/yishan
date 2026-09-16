# CRM Customer Opportunity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ProTable-based customer opportunity workspace with atomic opportunity creation, customer lifecycle updates, and customer activities.

**Architecture:** Keep the existing Fastify opportunity resource and repository-service route layering. The service creates the opportunity, recalculates lifecycle, and records customer-visible activities in one transaction. The customer Drawer owns refresh state and passes it into the table and activity rail.

**Tech Stack:** React 19, TypeScript, Ant Design 6, Ant Design Pro, Umi Max, Fastify 5, TypeBox, Drizzle ORM, MySQL, Vitest, Jest.

**Spec:** `docs/superpowers/specs/2026-09-15-crm-customer-opportunities-design.md`

## Global Constraints

- Use only `requirement`, `proposal`, `negotiation`, `won`, and `lost`; migrate `discover` and `qualify` to `requirement`.
- Preserve `POST /api/crm/v1/opportunities`; do not create a second opportunity API.
- Store estimated opportunity amount in cents and keep it independent from quotation, contract, and payment amounts.
- Do not regress customer lifecycle while creating an opportunity. Write a status activity only for an actual transition to `opportunity`.
- Use an unwrapped `ProTable` with `headerTitle` and `toolBarRender`; do not add decorative Cards.
- Never show enum codes in Chinese CRM UI.

---

### Task 1: Canonical Opportunity Schema, Migration, and Repository

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/db/schema.ts:562-619`
- Create: `apps/yishan-api/src/modules/crm/drizzle/0057_crm-opportunity-workspace.sql`
- Modify: `apps/yishan-api/src/modules/crm/drizzle/meta/_journal.json`
- Modify: `apps/yishan-api/src/modules/crm/schemas/opportunity.schema.ts:15-230`
- Modify: `apps/yishan-api/src/modules/crm/repositories/opportunity.repository.ts:20-310`
- Test: `apps/yishan-api/src/modules/crm/tests/opportunity-service.test.ts`

**Interfaces:**
- Produces `OpportunityStageCode = 'requirement' | 'proposal' | 'negotiation' | 'won' | 'lost'`.
- Produces create/update/response fields `requirement`, `scope`, `nextAction`, `nextFollowUpAt`, and `remark`.

- [ ] **Step 1: Write the failing contract test**

Add this assertion to the existing `OpportunityService.create` test:

```ts
expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
  stageCode: 'requirement',
  requirement: '统一客户管理',
  scope: 'CRM 20用户',
  nextAction: '提供正式方案和报价',
  nextFollowUpAt: expect.any(Date),
}), expect.anything())
```

- [ ] **Step 2: Verify the test is red**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/opportunity-service.test.ts`

Expected: FAIL because the create payload defaults to `discover` and cannot persist the new fields.

- [ ] **Step 3: Implement the canonical data contract**

Replace stage constants and state transitions with:

```ts
export const OPPORTUNITY_STAGES = ['requirement', 'proposal', 'negotiation', 'won', 'lost'] as const
export const STAGE_FORWARD_TRANSITIONS = {
  requirement: ['proposal'], proposal: ['negotiation'], negotiation: ['won', 'lost'], won: [], lost: [],
} as const
```

Add nullable opportunity columns `requirement`, `scope`, `nextAction`, `nextFollowUpAt`, and `remark`. Include them in `OpportunityRow`, `CreateOpportunityInput`, `UpdateOpportunityInput`, `baseColumns`, repository create, and repository update. Make stage default `requirement`.

Create migration `0057_crm-opportunity-workspace.sql`: add the five columns, update `crm_opportunity.stage_code`, `crm_opportunity_stage_log.from_stage`, and `crm_opportunity_stage_log.to_stage` from `discover` and `qualify` to `requirement`, then change the table default to `requirement`. Register it after migration 0056.

Require owner, expected-close date, next action, and next-follow-up time in the create request. Restrict user-created stages to the first three non-terminal values in the service.

- [ ] **Step 4: Verify the test is green**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/opportunity-service.test.ts`

Expected: PASS with the new stage and fields in the repository payload.

- [ ] **Step 5: Commit the task**

```bash
git add apps/yishan-api/src/modules/crm/db/schema.ts apps/yishan-api/src/modules/crm/drizzle/0057_crm-opportunity-workspace.sql apps/yishan-api/src/modules/crm/drizzle/meta/_journal.json apps/yishan-api/src/modules/crm/schemas/opportunity.schema.ts apps/yishan-api/src/modules/crm/repositories/opportunity.repository.ts apps/yishan-api/src/modules/crm/tests/opportunity-service.test.ts
git commit -m "feat(crm): define canonical opportunity stages"
```

### Task 2: Transactional Creation, Lifecycle, and Activities

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/services/opportunity.service.ts:40-220`
- Test: `apps/yishan-api/src/modules/crm/tests/opportunity-service.test.ts`

**Interfaces:**
- Produces `OpportunityService.create({ input, currentUser }): Promise<OpportunityRow>` that includes lifecycle and customer activity writes in its existing transaction.

- [ ] **Step 1: Write failing lifecycle activity tests**

For a `following` customer, add assertions for the creation activity and one transition activity:

```ts
expect(activitySpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
  customerId: 100,
  entityType: 'customer',
  metadata: expect.objectContaining({ eventType: 'opportunity_created', opportunityName: 'CRM 20用户采购' }),
}), expect.anything())
expect(activitySpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
  type: 'status_change', metadata: expect.objectContaining({ from: 'following', to: 'opportunity' }),
}), expect.anything())
```

Add a second test with an already-`opportunity` customer asserting that only the creation activity is written.

- [ ] **Step 2: Verify the tests are red**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/opportunity-service.test.ts`

Expected: FAIL because create currently creates no customer activities.

- [ ] **Step 3: Implement the transaction behavior**

Trim all supplied texts, validate nonnegative safe integer cents, verify the selected owner is in the current data scope, and retain the supplied owner rather than forcing the creator. Within `dbManager.transaction`, create the row, write customer activity metadata `{ eventType: 'opportunity_created', opportunityId, opportunityName, amountCents, expectedCloseDate, stage, nextAction }`, recalculate the lifecycle, and write `status_change` only when prior status is `potential` or `following` and resulting status is `opportunity`.

Use this activity content shape:

```ts
`创建商机「${opportunity.name}」\n预计金额：${formatCents(opportunity.expectedAmountCents)}\n预计成交：${formatDate(opportunity.expectedCloseDate)}\n下一步：${opportunity.nextAction}`
```

Update all old `discover`/`qualify` state-machine tests and kanban order references to the five stages.

- [ ] **Step 4: Verify the tests are green**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/opportunity-service.test.ts`

Expected: PASS, including no duplicate status activity for a second opportunity.

- [ ] **Step 5: Commit the task**

```bash
git add apps/yishan-api/src/modules/crm/services/opportunity.service.ts apps/yishan-api/src/modules/crm/tests/opportunity-service.test.ts
git commit -m "feat(crm): record opportunity creation lifecycle"
```

### Task 3: Browser Contracts, Customer Activity, ProTable, and Form

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/domain/statuses.ts`
- Modify: `apps/yishan-admin/src/services/crm.ts`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/sub/ActivityTimeline.tsx`
- Create: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/OpportunityCreateDrawer.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/OpportunitiesTab.tsx`
- Test: `apps/yishan-admin/src/modules/crm/components/drawer/sub/ActivityTimeline.test.tsx`
- Test: `apps/yishan-admin/src/modules/crm/components/drawer/tabs/OpportunitiesTab.test.tsx`

**Interfaces:**
- Produces `createOpportunity(payload: OpportunityCreatePayload): Promise<OpportunityRow>`.
- Produces `OpportunityCreateDrawer` props `{ open, customer, contacts, onClose, onCreated }`.
- Produces `OpportunitiesTab` props `{ customer, refreshKey, onCreated, onOpportunityClick? }`.

- [ ] **Step 1: Write failing timeline and tab tests**

Test that an activity with `metadata.eventType = 'opportunity_created'` shows business copy and hides the enum:

```tsx
expect(screen.getByText('商机创建')).toBeTruthy()
expect(screen.getByText('创建商机「CRM 20用户采购」')).toBeTruthy()
expect(screen.queryByText(/opportunity_created/)).toBeNull()
```

Test that toolbar and Empty CTA both open one Drawer titled “新建商机”, and defaults show the fixed customer and “需求确认”.

- [ ] **Step 2: Verify the tests are red**

Run: `pnpm --filter yishan-admin exec jest src/modules/crm/components/drawer/sub/ActivityTimeline.test.tsx src/modules/crm/components/drawer/tabs/OpportunitiesTab.test.tsx --runInBand`

Expected: FAIL because the tab remains `LifecycleListTab` and has no creation form.

- [ ] **Step 3: Implement browser contracts and activity rendering**

Use five Chinese status descriptors: 需求确认, 方案报价, 商务谈判, 成交, 失败. Extend browser opportunity row and create payload types, and add `createOpportunity` through the existing CRM request wrapper.

In `ActivityTimeline`, identify the opportunity event through metadata and render title `创建商机「${opportunityName}」` with only nonempty amount, expected-close, and next-action lines.

- [ ] **Step 4: Implement the ProTable and nested ProForm**

Replace `LifecycleListTab` with unwrapped `ProTable<OpportunityRow>` using `headerTitle={`商机（${total}）`}`, `toolBarRender`, `actionRef`, `scroll={{ x: 980 }}`, compact `Empty.PRESENTED_IMAGE_SIMPLE`, and columns name, stage, estimated amount, expected close, owner, next action, and actions. Name and “查看” use the same optional click handler; “更多” is the only additional row action.

Create the 600px nested Drawer with `ProForm`: text fields for name/next action; disabled fixed customer; selects for contact, owner, and non-terminal stage; digit field in yuan; date/date-time fields; text areas for requirement, scope, and remark. Convert yuan to cents and Dayjs to ISO on submit. Keep the Drawer open after errors, display `商机创建失败，请稍后重试` when no business error exists, and use footer actions “取消”/“创建商机”.

- [ ] **Step 5: Verify submit success and failure behavior**

Extend the tab test: submit the sandbox values, assert `createOpportunity`, local table reload, and `onCreated`; reject the request and assert the Drawer remains open with its values and error copy.

Run: `pnpm --filter yishan-admin exec jest src/modules/crm/components/drawer/sub/ActivityTimeline.test.tsx src/modules/crm/components/drawer/tabs/OpportunitiesTab.test.tsx --runInBand`

Expected: PASS for both CTAs, defaults, render mapping, success refresh, and retained form state.

- [ ] **Step 6: Commit the task**

```bash
git add apps/yishan-admin/src/modules/crm/domain/statuses.ts apps/yishan-admin/src/services/crm.ts apps/yishan-admin/src/modules/crm/components/drawer/sub/ActivityTimeline.tsx apps/yishan-admin/src/modules/crm/components/drawer/sub/ActivityTimeline.test.tsx apps/yishan-admin/src/modules/crm/components/drawer/tabs/OpportunityCreateDrawer.tsx apps/yishan-admin/src/modules/crm/components/drawer/tabs/OpportunitiesTab.tsx apps/yishan-admin/src/modules/crm/components/drawer/tabs/OpportunitiesTab.test.tsx
git commit -m "feat(crm): add customer opportunity workspace"
```

### Task 4: Customer Drawer Wiring and Verification

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawer.tsx:40-270`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawerHeader.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/components/drawer/sub/CustomerActivityRail.tsx`
- Test: `apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawer.test.tsx`

**Interfaces:**
- Produces one shared handler for the header’s “新增 → 新建商机” menu and the tab’s new-opportunity entry point.

- [ ] **Step 1: Write the failing integration test**

Open header “新增”, click “新建商机”, and assert it opens the same form. Simulate its `onCreated` callback and assert customer detail is refetched and parent `onChanged` runs:

```tsx
await user.click(screen.getByRole('button', { name: /新增/ }))
await user.click(screen.getByRole('menuitem', { name: '新建商机' }))
expect(await screen.findByRole('heading', { name: '新建商机' })).toBeTruthy()
```

- [ ] **Step 2: Verify the test is red**

Run: `pnpm --filter yishan-admin exec jest src/modules/crm/components/drawer/CustomerDrawer.test.tsx --runInBand`

Expected: FAIL because the header route displays the old placeholder toast.

- [ ] **Step 3: Implement shared state and local refresh**

Add `opportunityCreateOpen` and `customerRefreshKey` to `CustomerDrawer`. Route `CreateEntityKey === 'opportunity'` to the create state and leave other global actions unchanged. Pass customer, refresh key, a shared `handleOpportunityCreated`, and `onOpportunityClick` into `OpportunitiesTab`.

`handleOpportunityCreated` must refetch `getCustomer(customerId)`, replace customer state, increment refresh key, and call `onChanged`. Let `CustomerActivityRail` accept the refresh key and refetch activities on change. Do not use `window.location.reload()`.

- [ ] **Step 4: Run focused checks**

Run:

```bash
pnpm --filter yishan-admin exec jest src/modules/crm/components/drawer/CustomerDrawer.test.tsx src/modules/crm/components/drawer/tabs/OpportunitiesTab.test.tsx src/modules/crm/components/drawer/sub/ActivityTimeline.test.tsx --runInBand
pnpm --filter yishan-admin lint
pnpm --filter yishan-api build:ts
```

Expected: all selected tests, admin lint/typecheck, and API TypeScript build exit 0.

- [ ] **Step 5: Run final verification and inspect scope**

Run:

```bash
pnpm --filter yishan-api test
pnpm --filter yishan-admin test
pnpm --filter yishan-admin build
git diff --check
git status --short
```

Expected: test suites and build exit 0; `git diff --check` emits no errors; changed files are the planned CRM files plus the pre-existing working-tree changes.

- [ ] **Step 6: Commit the task**

```bash
git add apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawer.tsx apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawerHeader.tsx apps/yishan-admin/src/modules/crm/components/drawer/sub/CustomerActivityRail.tsx apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawer.test.tsx
git commit -m "feat(crm): refresh customer after opportunity creation"
```
