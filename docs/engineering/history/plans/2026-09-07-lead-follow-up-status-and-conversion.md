# 线索跟进状态与客户转换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let salespeople choose one of four follow-up statuses while recording a follow-up, and make customer conversion independent of that status.

**Architecture:** Persist the four follow-up statuses in `crm_lead.status`; the activity-create transaction owns activity, timestamps, status change, and audit record. Customer conversion keeps the selected status intact and writes only relationship fields plus a conversion activity. The admin page consumes the returned lead, reloads its timeline and list, and swaps the conversion button for the linked-customer destination.

**Tech Stack:** Fastify, TypeBox, Drizzle/MySQL, React, Ant Design Pro, Vitest, Jest, Playwright CLI.

**Spec:** `docs/superpowers/specs/2026-09-07-lead-follow-up-status-and-conversion-design.md`

## Global Constraints

- Status values are exactly `pending`, `contact_valid`, `contact_invalid`, and `closed`.
- `followUpStatus` is required on every create-follow-up request.
- No follow-up may infer or silently change status.
- Conversion is available for every lead without `convertedCustomerId`; it never overwrites `status`.
- Timeline sorting is `occurredAt DESC`; identical timestamps show a human follow-up before its system status audit.
- Preserve ownership/data-scope checks and the existing customer/contact conversion transaction.

---

### Task 1: Replace lifecycle status contract and migrate existing values

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/db/schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/repositories/lead.repository.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/lead.schema.ts`
- Create: `apps/yishan-api/drizzle/0001_lead_follow_up_status.sql`
- Modify: `apps/yishan-admin/src/services/crm.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/lead-status-contract.test.ts`

**Interfaces:**
- Produces `LeadStatus = 'pending' | 'contact_valid' | 'contact_invalid' | 'closed'` and `LEAD_FOLLOW_UP_STATUS` with the same values.
- Produces `status?: LeadStatus` list filtering and `isConverted: boolean` derived from `convertedCustomerId`.

- [ ] **Step 1: Write failing contract tests**

```ts
it('accepts only the four user-selectable follow-up statuses', () => {
  expect(Value.Check(LeadActivityCreateReqSchema, {
    type: 'phone', content: '已联系', followUpStatus: 'contact_valid',
  })).toBe(true)
  expect(Value.Check(LeadActivityCreateReqSchema, {
    type: 'phone', content: '已联系', followUpStatus: 'processing',
  })).toBe(false)
})
```

- [ ] **Step 2: Run the contract test and confirm it fails**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-status-contract.test.ts`

Expected: FAIL because the request lacks `followUpStatus` and the old enum accepts `processing`.

- [ ] **Step 3: Implement the four-value contract and SQL migration**

Use `pending` as the schema default and map existing rows in `0001_lead_follow_up_status.sql`:

```sql
UPDATE crm_lead SET status = 'pending' WHERE status IN ('new', 'processing', 'converted');
UPDATE crm_lead SET status = 'contact_valid' WHERE status = 'qualified';
UPDATE crm_lead SET status = 'contact_invalid' WHERE status = 'disqualified';
```

Remove disqualification-only fields and endpoints only after their callers are replaced in Tasks 2–4. Expose `isConverted` in response types as `convertedCustomerId !== null`; do not add a new mutable database field.

- [ ] **Step 4: Run contract verification**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-status-contract.test.ts`

Expected: PASS with `contact_valid` accepted and `processing` rejected.

- [ ] **Step 5: Commit**

```bash
git add apps/yishan-api/src/modules/crm/db/schema.ts apps/yishan-api/src/modules/crm/repositories/lead.repository.ts apps/yishan-api/src/modules/crm/schemas/lead.schema.ts apps/yishan-api/drizzle/0001_lead_follow_up_status.sql apps/yishan-api/src/modules/crm/tests/lead-status-contract.test.ts apps/yishan-admin/src/services/crm.ts
git commit -m "feat(crm): define user-selectable lead follow-up statuses"
```

### Task 2: Make follow-up submission own status changes and its audit event

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/services/lead-activity.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts`
- Modify: `apps/yishan-api/src/modules/crm/tests/lead-activity-service.test.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/leadFollowUpForm.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/LeadActivityRail.tsx`
- Test: `apps/yishan-admin/tests/lead-follow-up-form.test.ts`

**Interfaces:**
- `LeadActivityCreateInput` adds `followUpStatus: LeadStatus`.
- `LeadActivityService.create` returns `{ activity, lead }`, where `activity` is always the human follow-up.

- [ ] **Step 1: Write failing service and form tests**

```ts
it('writes a status audit only when the selected status differs', async () => {
  await service.create(1, { type: 'phone', content: '接通', followUpStatus: 'contact_valid' }, salesperson)
  expect(LeadRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'contact_valid' }), expect.anything())
  expect(LeadActivityRepository.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
    type: 'status_change', content: '跟进状态由「未处理」变为「联系方式有效」',
  }), expect.anything())
})

it('includes the selected follow-up status in the API input', () => {
  expect(toLeadActivityInput({ type: 'phone', content: ' 接通 ', followUpStatus: 'closed' }))
    .toEqual({ type: 'phone', content: '接通', followUpStatus: 'closed' })
})
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-activity-service.test.ts`

Run: `pnpm --filter yishan-admin exec jest --runInBand tests/lead-follow-up-form.test.ts`

Expected: FAIL because the request/form type lacks `followUpStatus`.

- [ ] **Step 3: Implement one transaction and visible form field**

Require the state select in `LeadActivityRail`; default new leads to `pending` and all others to `lead.status`. In the service, write the human activity first, update timestamps and selected status, then write one `status_change` only if the values differ. Do not block `closed` or `contact_invalid` leads from follow-up. Reload all activities after success and call the page callback with the returned lead.

- [ ] **Step 4: Verify**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-activity-service.test.ts`

Run: `pnpm --filter yishan-admin exec jest --runInBand tests/lead-follow-up-form.test.ts`

Expected: PASS; unchanged status produces only one activity and changed status produces two.

- [ ] **Step 5: Commit**

```bash
git add apps/yishan-api/src/modules/crm/services/lead-activity.service.ts apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts apps/yishan-api/src/modules/crm/tests/lead-activity-service.test.ts apps/yishan-admin/src/modules/crm/pages/leads/leadFollowUpForm.ts apps/yishan-admin/src/modules/crm/pages/leads/LeadActivityRail.tsx apps/yishan-admin/tests/lead-follow-up-form.test.ts
git commit -m "feat(crm): choose lead status when recording follow-up"
```

### Task 3: Decouple conversion from follow-up status

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/repositories/lead.repository.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/lead-conversion.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/tests/lead-conversion-service.test.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/ConvertLeadDialog.tsx`

**Interfaces:**
- Replaces `lockQualifiedForConversionInTx` with `lockAvailableForConversionInTx`, which rejects only `convertedCustomerId IS NOT NULL`.
- `LeadConversionService.preview/convert` accept every current follow-up status.

- [ ] **Step 1: Write the failing conversion test**

```ts
it.each(['pending', 'contact_valid', 'contact_invalid', 'closed'] as const)(
  'converts a %s lead without changing its follow-up status', async (status) => {
    const result = await service.convert(buildLead({ status }), createCustomerAndContact, salesperson)
    expect(result.lead).toMatchObject({ status, convertedCustomerId: expect.any(Number) })
  },
)
```

- [ ] **Step 2: Run it to confirm failure**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-conversion-service.test.ts`

Expected: FAIL because only `qualified` leads can be locked and converted.

- [ ] **Step 3: Implement the availability lock and non-destructive conversion**

Lock any non-deleted lead whose `convertedCustomerId` is null. Keep customer/contact validation, transaction boundaries, data scope, and conversion audit. Delete the status assignment from the lead update; audit content must name the linked customer and contact. In `ConvertLeadDialog`, remove status-based disabling and only block a duplicate conversion.

- [ ] **Step 4: Verify**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-conversion-service.test.ts`

Expected: PASS; a second conversion fails without creating another customer/contact.

- [ ] **Step 5: Commit**

```bash
git add apps/yishan-api/src/modules/crm/repositories/lead.repository.ts apps/yishan-api/src/modules/crm/services/lead-conversion.service.ts apps/yishan-api/src/modules/crm/tests/lead-conversion-service.test.ts apps/yishan-admin/src/modules/crm/pages/leads/ConvertLeadDialog.tsx
git commit -m "feat(crm): convert leads independent of follow-up status"
```

### Task 4: Rebuild list, drawer actions, and chronological activity rendering

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/index.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/LeadDetailDrawer.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/leadActions.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/leadTimeline.ts`
- Test: `apps/yishan-admin/tests/lead-actions.test.ts`
- Test: `apps/yishan-admin/tests/lead-timeline.test.ts`

**Interfaces:**
- `getLeadActions` exposes `convert` for every `convertedCustomerId === null` lead and `openCustomer` otherwise.
- The page’s `applyLeadUpdate` replaces the open drawer row and reloads the table.

- [ ] **Step 1: Write failing action and ordering tests**

```ts
it('offers convert for every unconverted follow-up status', () => {
  for (const status of ['pending', 'contact_valid', 'contact_invalid', 'closed'] as const) {
    expect(getLeadActions({ ...lead, status, convertedCustomerId: null }).map((x) => x.key)).toContain('convert')
  }
})

it('orders same-time human follow-up before the status audit', () => {
  expect(buildLeadTimeline(lead, [statusChange, phoneFollowUp]).slice(0, 2).map((x) => x.category))
    .toEqual(['followup', 'status'])
})
```

- [ ] **Step 2: Run them to confirm failure**

Run: `pnpm --filter yishan-admin exec jest --runInBand tests/lead-actions.test.ts tests/lead-timeline.test.ts`

Expected: FAIL because actions and labels still use the old lifecycle.

- [ ] **Step 3: Implement the new presentation rules**

Render the four labels/colors in the list and drawer. Remove qualify/disqualify/reactivate buttons and dialogs from the page. Keep “写跟进” usable for every status. Show “转为客户” in the drawer until conversion, then replace it with “查看客户详情” linking to `/crm/customer-detail?id=<convertedCustomerId>`. Maintain newest-first sort and category tie-break in the time line.

- [ ] **Step 4: Verify**

Run: `pnpm --filter yishan-admin exec jest --runInBand tests/lead-actions.test.ts tests/lead-timeline.test.ts`

Expected: PASS; only customer relation changes the conversion action.

- [ ] **Step 5: Commit**

```bash
git add apps/yishan-admin/src/modules/crm/pages/leads/index.tsx apps/yishan-admin/src/modules/crm/pages/leads/LeadDetailDrawer.tsx apps/yishan-admin/src/modules/crm/pages/leads/leadActions.ts apps/yishan-admin/src/modules/crm/pages/leads/leadTimeline.ts apps/yishan-admin/tests/lead-actions.test.ts apps/yishan-admin/tests/lead-timeline.test.ts
git commit -m "feat(crm): present independent follow-up and conversion states"
```

### Task 5: Run browser acceptance and full verification

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/README.md`

- [ ] **Step 1: Start the local API/admin services and authenticate Playwright**

Use the seeded `admin/admin123` account only in the local development environment.

- [ ] **Step 2: Execute the browser acceptance path**

1. Create or select a `pending` lead.
2. Record a phone follow-up with status `contact_valid`.
3. Verify drawer header, timeline (follow-up then audit), and list row update without reload.
4. Record another follow-up selecting `closed`, then another selecting `pending`; verify both transitions persist.
5. Convert the lead while it is `pending`; verify the status remains `pending` and the button becomes “查看客户详情”.

- [ ] **Step 3: Run full automated verification**

```bash
pnpm --filter yishan-api test
pnpm --filter yishan-api build:ts
pnpm --filter yishan-admin test -- --runInBand
pnpm --filter yishan-admin lint
git diff --check
```

- [ ] **Step 4: Update CRM documentation and commit**

Document the four follow-up statuses, explicit follow-up selection, conversion independence, and “查看客户详情” behavior.

```bash
git add apps/yishan-api/src/modules/crm/README.md
git commit -m "docs(crm): document flexible lead follow-up workflow"
```

## Plan self-review

- Spec coverage: Task 1 establishes the four-status contract and migration; Task 2 implements user-controlled status changes and time-line audit; Task 3 removes conversion gating; Task 4 updates all user-facing actions and ordering; Task 5 proves the browser workflow and documents it.
- Placeholder scan: every task defines files, production interfaces, tests, commands, and expected behavior.
- Type consistency: `LeadStatus` and `followUpStatus` originate in Task 1 and are consumed by Task 2 through Task 4; conversion detects prior conversion using `convertedCustomerId`, never `status`.
