# Lead Lifecycle and Customer Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/crm/leads` enforce the agreed factual lifecycle—first follow-up starts processing, qualified leads can be safely converted into a customer and contact, and disqualification/reactivation are auditable controlled actions.

**Architecture:** Keep `crm_lead.status` as the single lifecycle state and keep owner/pool/due date as independent fields. Add explicit command endpoints for qualification, disqualification, reactivation, conversion preview and conversion; ordinary lead PATCH remains unable to alter lifecycle fields. The backend owns transition guards, permissions, evidence validation, row locking and the customer/contact transaction; the React page only renders actions returned by the current record state and calls those commands.

**Tech Stack:** Fastify 5 + TypeBox + Drizzle ORM/MySQL + Vitest; React 19 + Umi Max + Ant Design/Pro Components + Jest.

**Spec:** `docs/superpowers/specs/2026-09-06-lead-operating-loop-design.md`

## Global Constraints

- Lifecycle values remain `new | processing | qualified | disqualified | converted`; do not overload them with ownership, public-pool membership, overdue status, opportunity stage, or deal outcome.
- A first persisted human follow-up transitions only `new → processing`; subsequent follow-ups never downgrade or advance status.
- Qualification requires a contactable channel plus non-empty evidence and next action; it may transition only `new | processing → qualified` and writes an auditable system activity.
- Disqualification requires one normalized reason code and a non-empty explanation. Only `new | processing | qualified → disqualified` is permitted.
- Reactivation is a separately permissioned correction action: only `disqualified → processing`, with a non-empty reason; it never applies to converted leads.
- Conversion means customer/contact identity creation or association, never a sale. It is allowed only from `qualified`, must atomically associate/create both entities, preserve source and ownership on newly created customers, and only then mark the lead converted.
- Every lifecycle change writes `crm_lead_activity` in the same database transaction as the lead update. Existing historical activity rows remain readable.
- The general `PATCH /leads/:id` schema must never accept `status`, disqualification, qualification, conversion, owner or pool fields.
- Preserve all existing user changes outside files listed in an individual task. Do not stage them in a task commit.

---

## Target API contract

```ts
type DisqualifyCode =
  | 'duplicate'
  | 'not_target'
  | 'no_demand'
  | 'unreachable'
  | 'invalid_contact'
  | 'rejected'
  | 'other'

type QualificationInput = {
  evidence: string       // 1..1000, concrete need/fit evidence
  nextAction: string     // 1..500, the agreed next sales action
}

type LeadConversionPreview = {
  lead: LeadRow
  customers: Array<{ id: number; name: string; type: 'enterprise' | 'individual'; ownerUserId: number | null; ownerUserName: string | null }>
  contacts: Array<{ id: number; customerId: number; name: string; mobile: string | null; email: string | null }>
}

type LeadConvertInput = {
  customer:
    | { mode: 'existing'; customerId: number }
    | { mode: 'create'; name: string; type: 'enterprise' | 'individual'; phone?: string | null }
  contact:
    | { mode: 'existing'; contactId: number }
    | { mode: 'create'; name: string; mobile?: string | null; phone?: string | null; email?: string | null }
}

type LeadActivityCreateResponse = { activity: LeadActivityRow; lead: LeadRow }
type LeadConversionResult = { lead: LeadRow; customer: CustomerRow; contact: ContactRow }
```

Routes to add:

```text
POST /api/crm/v1/leads/:id/qualify       body: QualificationInput
POST /api/crm/v1/leads/:id/disqualify    body: { code: DisqualifyCode; reason: string }
POST /api/crm/v1/leads/:id/reactivate    body: { reason: string }
GET  /api/crm/v1/leads/:id/conversion-preview
POST /api/crm/v1/leads/:id/convert       body: LeadConvertInput
```

`POST /:id/activities` changes its successful envelope data from a bare activity to `LeadActivityCreateResponse`; the service wrapper and every known caller must be updated in the same task.

### Task 1: Establish lifecycle data, schemas, permission catalog, and API types

**Files:**
- Create: `apps/yishan-api/src/modules/crm/drizzle/0005_lead-lifecycle-reasons.sql`
- Modify: `apps/yishan-api/src/modules/crm/db/schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/repositories/lead.repository.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/lead.schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/permissions.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/error-codes.ts`
- Modify: `apps/yishan-api/src/modules/crm/config/system-menu.json`
- Modify: `apps/yishan-admin/src/services/crm.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/lead-schema.test.ts`

**Interfaces:**
- Produces `DisqualifyCode`, `LeadQualificationReqSchema`, `LeadReactivateReqSchema`, `LeadConversionPreviewSchema`, `LeadConvertReqSchema`, `LeadConversionResultSchema`, and the matching static request types.
- Produces `LeadRow.disqualifyCode: DisqualifyCode | null`, `CrmPermissions.LEAD_REACTIVATE`, `CrmPermissions.LEAD_CONVERT`, and matching admin API wrapper/input/result types.
- Consumed by Tasks 2–6; do not use lifecycle strings or request shapes outside these exports.

- [ ] **Step 1: Write failing schema/contract tests**

```ts
import { Value } from '@sinclair/typebox/value'
import {
  LeadConvertReqSchema,
  LeadDisqualifyReqSchema,
  LeadQualificationReqSchema,
} from '../schemas/lead.schema.js'

it('rejects a free-form disqualification code and empty qualification facts', () => {
  expect(Value.Check(LeadDisqualifyReqSchema, { code: 'maybe', reason: '拒绝' })).toBe(false)
  expect(Value.Check(LeadQualificationReqSchema, { evidence: ' ', nextAction: '下周回访' })).toBe(false)
})

it('requires a customer and a contact conversion decision', () => {
  expect(Value.Check(LeadConvertReqSchema, {
    customer: { mode: 'existing', customerId: 10 },
  })).toBe(false)
})
```

- [ ] **Step 2: Run the focused test and confirm it fails because the lifecycle schemas do not exist**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-schema.test.ts`

Expected: FAIL with unresolved exports or missing module.

- [ ] **Step 3: Add the database field and schema exports**

Create a forward-only migration:

```sql
ALTER TABLE `crm_lead`
  ADD `disqualify_code` varchar(32) NULL AFTER `disqualify_reason`;
CREATE INDEX `idx_crm_lead_disqualify_code` ON `crm_lead` (`disqualify_code`);
```

Add `disqualifyCode` to the Drizzle table, `LeadRow`, `LeadRespSchema`, and repository selection mapping. Define the seven-code `LEAD_DISQUALIFY_CODES` tuple and use it in `LeadDisqualifyReqSchema`. Add strict TypeBox objects for all target API contract types, including a discriminated-union-style `Type.Union` for `customer.mode` and `contact.mode`; require positive IDs and prohibit a contact-less conversion.

Add error codes for invalid qualification facts, invalid reactivation, invalid conversion choice, and already converted/converting conflict. Register `crm:lead:reactivate` and `crm:lead:convert`, and add both menu permission nodes without exposing them as top-level navigation. Mirror all request/response types and wrappers in `crm.ts`; change `createLeadActivity` to return `{ activity, lead }`.

- [ ] **Step 4: Run focused API and TypeScript checks**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-schema.test.ts && pnpm --filter yishan-api build:ts && pnpm --filter yishan-admin tsc`

Expected: PASS; TypeScript reports no stale bare-activity caller.

- [ ] **Step 5: Commit only the lifecycle contract files**

```bash
git add apps/yishan-api/src/modules/crm/drizzle/0005_lead-lifecycle-reasons.sql apps/yishan-api/src/modules/crm/db/schema.ts apps/yishan-api/src/modules/crm/repositories/lead.repository.ts apps/yishan-api/src/modules/crm/schemas/lead.schema.ts apps/yishan-api/src/modules/crm/schemas/permissions.ts apps/yishan-api/src/modules/crm/schemas/error-codes.ts apps/yishan-api/src/modules/crm/config/system-menu.json apps/yishan-admin/src/services/crm.ts apps/yishan-api/src/modules/crm/tests/lead-schema.test.ts
git commit -m "feat(crm): define lead lifecycle contracts"
```

### Task 2: Make follow-up creation atomically start processing and return the updated lead

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/services/lead-activity.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/lead.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/lead.schema.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/lead-activity-service.test.ts`

**Interfaces:**
- Consumes `LeadActivityCreateResponse` from Task 1.
- Produces `LeadActivityService.create(...): Promise<LeadActivityCreateResponse>` and an activity timeline event `待处理 → 跟进中` only for a first follow-up on a `new` lead.
- Consumed by Task 5 and the admin Activity Rail in Task 6.

- [ ] **Step 1: Write failing service tests for the two transition cases**

```ts
it('writes the first follow-up, timestamps, and new → processing event in one transaction', async () => {
  // Stub a `new` accessible lead and the transaction repositories.
  const result = await new LeadActivityService().create(1, followUpInput, salesperson)
  expect(LeadRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({
    status: 'processing', lastFollowUpAt: occurredAt, nextFollowUpAt,
  }), expect.anything())
  expect(LeadActivityRepository.create).toHaveBeenCalledWith(expect.objectContaining({
    type: 'status_change', content: '待处理 → 跟进中',
  }), expect.anything())
  expect(result.lead.status).toBe('processing')
})

it('does not duplicate a status event for a follow-up on an already processing lead', async () => {
  // Stub status processing; assert no status_change insert and status remains processing.
})
```

- [ ] **Step 2: Run the focused service test and confirm it fails**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-activity-service.test.ts`

Expected: FAIL because create returns an activity only and does not write a transition.

- [ ] **Step 3: Implement transaction-local transition behavior**

Within the existing `dbManager.transaction`, re-read the lead through the transaction, reject terminal leads, insert the human follow-up, then update last/next times. If the transaction-local lead status is `new`, include `status: 'processing'` in that update and insert a second `crm_lead_activity` row of type `status_change`, content `待处理 → 跟进中`, and the same operator. Re-read the lead in the transaction and return `{ activity: activityWithOperator, lead }`.

Do not transition merely because a drawer opens, a line is edited, an owner changes, or an activity type is invalid. Preserve a follow-up on `qualified` as a normal follow-up with no status change.

Update the route response schema and success message to return the wrapper exactly once.

- [ ] **Step 4: Run focused regression tests**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-activity-service.test.ts src/modules/crm/tests/lead-service.test.ts`

Expected: PASS, including existing data-scope and terminal-state tests.

- [ ] **Step 5: Commit the atomic follow-up transition**

```bash
git add apps/yishan-api/src/modules/crm/services/lead-activity.service.ts apps/yishan-api/src/modules/crm/services/lead.service.ts apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts apps/yishan-api/src/modules/crm/schemas/lead.schema.ts apps/yishan-api/src/modules/crm/tests/lead-activity-service.test.ts
git commit -m "feat(crm): start lead processing on first follow-up"
```

### Task 3: Enforce qualify, disqualify, and reactivate command rules

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/services/lead.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/lead.schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/error-codes.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/lead-service.test.ts`

**Interfaces:**
- Consumes Task 1 schemas and error codes.
- Produces `LeadService.qualify({ leadId, evidence, nextAction, currentUser })`, `disqualify({ leadId, code, reason, currentUser })`, and `reactivate({ leadId, reason, currentUser })`.
- Task 6 calls their admin service wrappers and relies on returned `LeadRow` for in-place refresh.

- [ ] **Step 1: Add failing transition-rule tests**

```ts
it('refuses qualification without a usable channel, evidence, and next action', async () => {
  vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ mobile: null, phone: null, email: null, wechat: null }))
  await expect(service.qualify({ leadId: 1, evidence: '预算已确认', nextAction: '安排演示', currentUser: salesperson }))
    .rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_QUALIFICATION_REQUIRED })
})

it('stores code and explanation when disqualifying and writes a readable audit event', async () => {
  await service.disqualify({ leadId: 1, code: 'no_demand', reason: '本年度无采购计划', currentUser: salesperson })
  expect(LeadRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({
    status: 'disqualified', disqualifyCode: 'no_demand', disqualifyReason: '本年度无采购计划',
  }))
})

it('allows only a disqualified lead to reactivate to processing', async () => {
  // Assert status processing, code/reason cleared, and a status_change activity with the supplied reactivation reason.
})
```

- [ ] **Step 2: Run the lifecycle service test and confirm it fails**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-service.test.ts`

Expected: FAIL due to the old `qualify` signature and absent reactivation.

- [ ] **Step 3: Implement the transition commands and audit content**

Define `hasUsableContactChannel(lead)` as a trimmed check across mobile, phone, email, and wechat. Qualification must reject terminal leads and require a channel, trimmed evidence, and trimmed next action; it changes status to `qualified` and writes one `status_change` activity with:

```text
跟进中 → 有效
资格证据：<evidence>
下一步：<nextAction>
```

Disqualification must validate the code and explanation, forbid only `converted`/`disqualified`, persist both code and explanation, and write `跟进中 → 无效（无需求）：<reason>` using the localized code label. Reactivation accepts only `disqualified`, clears the current disqualification fields, sets `processing`, and writes `无效 → 跟进中（重新激活）：<reason>`. All three service methods must use one transaction for lead write plus system activity; use transaction-local repository calls.

Add routes with `LEAD_QUALIFY`, `LEAD_DISQUALIFY`, and `LEAD_REACTIVATE` permissions. Do not add a generic status mutation route.

- [ ] **Step 4: Run behavior and API build checks**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-service.test.ts && pnpm --filter yishan-api build:ts`

Expected: PASS; converted leads remain impossible to qualify, disqualify, reactivate, edit, assign, or follow up.

- [ ] **Step 5: Commit the lifecycle commands**

```bash
git add apps/yishan-api/src/modules/crm/services/lead.service.ts apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts apps/yishan-api/src/modules/crm/schemas/lead.schema.ts apps/yishan-api/src/modules/crm/schemas/error-codes.ts apps/yishan-api/src/modules/crm/tests/lead-service.test.ts
git commit -m "feat(crm): enforce lead lifecycle commands"
```

### Task 4: Build the safe conversion backend with preview, row lock, and idempotency

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/repositories/lead.repository.ts`
- Modify: `apps/yishan-api/src/modules/crm/repositories/customer.repository.ts`
- Modify: `apps/yishan-api/src/modules/crm/repositories/contact.repository.ts`
- Create: `apps/yishan-api/src/modules/crm/services/lead-conversion.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/lead.schema.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/lead-conversion-service.test.ts`

**Interfaces:**
- Produces `LeadRepository.lockQualifiedForConversionInTx(id, tx)` that returns a qualified lead while holding `SELECT ... FOR UPDATE`, or null.
- Produces `CustomerRepository.findConversionCandidates(...)`, `ContactRepository.findConversionCandidates(...)`, and `LeadConversionService.preview/convert`.
- Consumes source/customer/contact repository create and lookup primitives without calling public HTTP handlers or nesting transactions.
- Provides Task 6 with preview and convert endpoints.

- [ ] **Step 1: Write failing conversion tests, including concurrency and rollback cases**

```ts
it('creates a customer and primary contact, then marks the qualified lead converted in one transaction', async () => {
  const result = await service.convert(lead.id, createCustomerAndContact, salesperson)
  expect(result.lead).toMatchObject({ status: 'converted', convertedCustomerId: result.customer.id, convertedContactId: result.contact.id })
  expect(result.contact).toMatchObject({ customerId: result.customer.id, isPrimary: 1 })
})

it('allows an existing contact only when it belongs to the chosen customer', async () => {
  await expect(service.convert(lead.id, mismatchedExistingSelections, salesperson))
    .rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_CONVERSION_SELECTION_INVALID })
})

it('rolls back customer/contact writes when lead conversion cannot complete', async () => {
  // Make the final lead update throw; assert the transaction rejects and no success result is returned.
})

it('returns a conflict for a second converter after the first transaction has locked and converted the lead', async () => {
  // Simulate lockQualifiedForConversionInTx returning null because status is converted.
})
```

- [ ] **Step 2: Run the focused conversion test and confirm it fails**

Run: `pnpm --filter yishan-api test -- src/modules/crm/tests/lead-conversion-service.test.ts`

Expected: FAIL because conversion preview/service/repository methods do not exist.

- [ ] **Step 3: Implement candidate lookup and the conversion transaction**

Candidate preview may only read an accessible qualified lead. It returns exact/near identity candidates based on the existing customer duplicate strategy (enterprise: company name plus phone assistance; individual: mobile/phone priority) and contact candidates matching non-empty lead mobile/email. Candidate lists are hints, not authorization to link records outside the actor's data scope.

For conversion, re-check access, then start one `dbManager.transaction`. Use a repository method that issues a MySQL `SELECT ... FOR UPDATE` for the lead ID and verifies `status='qualified'` before any customer/contact insert. If it does not return a row, throw a lifecycle conflict; never create anything first. Validate that an existing customer is visible/operable by the actor and that an existing contact belongs to that selected customer. For create mode, create the customer with:

```ts
{
  name: input.customer.name,
  type: input.customer.type,
  phone: input.customer.phone ?? lead.mobile ?? lead.phone,
  sourceId: lead.sourceId,
  ownerUserId: lead.ownerUserId,
  ownerDepartmentId: lead.ownerDepartmentId,
  poolStatus: lead.ownerUserId ? 'owned' : 'public',
  creatorId: currentUser.id,
  updaterId: currentUser.id,
}
```

For create-contact mode, copy lead name/mobile/phone/email as defaults only when the request omits them, insert it for the selected/new customer, and set it primary in the same transaction. Then update the locked lead to `converted`, set `convertedCustomerId`, `convertedContactId`, `convertedAt`, and write a `status_change` activity naming the associated customer. Return `{ lead, customer, contact }` after transaction commit. No new lifecycle state, no client-supplied converted IDs, and no `CustomerService.create` call that starts a nested transaction.

- [ ] **Step 4: Add routes and execute focused verification**

Wire preview under `LEAD_CONVERT` and conversion under the same permission. Confirm OpenAPI response schemas include both entity IDs. Run:

```bash
pnpm --filter yishan-api test -- src/modules/crm/tests/lead-conversion-service.test.ts src/modules/crm/tests/lead-service.test.ts
pnpm --filter yishan-api build:ts
```

Expected: PASS; a converted lead cannot be converted a second time and failed conversion leaves the lead qualified.

- [ ] **Step 5: Commit the conversion backend**

```bash
git add apps/yishan-api/src/modules/crm/repositories/lead.repository.ts apps/yishan-api/src/modules/crm/repositories/customer.repository.ts apps/yishan-api/src/modules/crm/repositories/contact.repository.ts apps/yishan-api/src/modules/crm/services/lead-conversion.service.ts apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts apps/yishan-api/src/modules/crm/schemas/lead.schema.ts apps/yishan-api/src/modules/crm/tests/lead-conversion-service.test.ts
git commit -m "feat(crm): safely convert qualified leads"
```

### Task 5: Update frontend API contracts and timeline behavior

**Files:**
- Modify: `apps/yishan-admin/src/services/crm.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/LeadActivityRail.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/leadTimeline.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/LeadDetailDrawer.tsx`
- Test: `apps/yishan-admin/tests/lead-timeline.test.ts`
- Test: `apps/yishan-admin/tests/lead-follow-up-form.test.ts`

**Interfaces:**
- Consumes `LeadActivityCreateResponse`, lifecycle input types, preview and conversion result types from `crm.ts`.
- Produces `onLeadChanged(updated: LeadRow)` from the activity rail to the drawer/page, so the visible tag and actions update immediately after a first follow-up.
- Task 6 consumes this callback and new wrappers.

- [ ] **Step 1: Write failing frontend unit tests for updated follow-up state and lifecycle timeline labels**

```ts
it('renders conversion and reactivation system events as status events', () => {
  const events = buildLeadTimeline(lead, [
    systemActivity('status_change', '无效 → 跟进中（重新激活）：官网留资'),
    systemActivity('conversion', '有效 → 已转化：关联客户 上海示例'),
  ])
  expect(events.every((event) => event.category === 'status')).toBe(true)
})

it('uses the returned lead after saving the first follow-up', async () => {
  // Mock createLeadActivity to return { activity, lead: { ...lead, status: 'processing' } }.
  // Assert onLeadChanged receives the processing row.
})
```

- [ ] **Step 2: Run the focused Jest tests and confirm they fail**

Run: `pnpm --filter yishan-admin test -- --runInBand tests/lead-timeline.test.ts tests/lead-follow-up-form.test.ts`

Expected: FAIL because the activity wrapper and lifecycle event category are not handled.

- [ ] **Step 3: Implement the stable frontend data flow**

Replace the bare activity assumption with `result.activity`, prepend it to local activities, and call `onLeadChanged(result.lead)`. Thread the callback from `LeadActivityRail` through `LeadDetailDrawer` to `LeadPage`; replace the open detail state only when IDs match. Extend timeline mapping so `status_change`, `conversion`, and `reactivation` are status category with the status color; leave owner and profile edits as existing system/audit behavior.

Only render “写跟进” for non-terminal leads. A qualified lead remains eligible for follow-ups; converted and disqualified leads show the timeline but cannot open the form.

- [ ] **Step 4: Run type and focused frontend tests**

Run: `pnpm --filter yishan-admin test -- --runInBand tests/lead-timeline.test.ts tests/lead-follow-up-form.test.ts && pnpm --filter yishan-admin tsc`

Expected: PASS; no component reads `result.id` from the now-wrapped response.

- [ ] **Step 5: Commit the client contract update**

```bash
git add apps/yishan-admin/src/services/crm.ts apps/yishan-admin/src/modules/crm/pages/leads/LeadActivityRail.tsx apps/yishan-admin/src/modules/crm/pages/leads/leadTimeline.ts apps/yishan-admin/src/modules/crm/pages/leads/LeadDetailDrawer.tsx apps/yishan-admin/tests/lead-timeline.test.ts apps/yishan-admin/tests/lead-follow-up-form.test.ts
git commit -m "feat(crm): refresh lead state after follow-up"
```

### Task 6: Replace misleading actions with state-gated qualification, disqualification, reactivation, and conversion UI

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/leads/QualifyLeadDialog.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/leads/DisqualifyLeadDialog.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/leads/ReactivateLeadDialog.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/leads/ConvertLeadDialog.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/leads/leadActions.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/index.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/LeadDetailDrawer.tsx`
- Test: `apps/yishan-admin/tests/lead-actions.test.ts`
- Test: `apps/yishan-admin/tests/lead-detail-state.test.ts`

**Interfaces:**
- `getLeadActions(lead): LeadAction[]` is a pure function: it returns only actions permitted by lifecycle state, not guessed permissions.
- Dialogs call `qualifyLead`, `disqualifyLead`, `reactivateLead`, `getLeadConversionPreview`, and `convertLead`; successful calls provide the returned `LeadRow` to `onUpdated`.
- `ConvertLeadDialog` accepts `lead`, loads preview when opened, and returns the conversion result so the page can refresh and expose linked customer/contact IDs.

- [ ] **Step 1: Write failing state-to-action tests**

```ts
it.each([
  ['new', ['view', 'followUp', 'transfer', 'disqualify']],
  ['processing', ['view', 'followUp', 'transfer', 'qualify', 'disqualify']],
  ['qualified', ['view', 'followUp', 'transfer', 'convert', 'disqualify']],
  ['disqualified', ['view', 'reactivate']],
  ['converted', ['view', 'openCustomer']],
])('shows only business actions for %s', (status, expected) => {
  expect(getLeadActions({ ...lead, status } as LeadRow).map((action) => action.key)).toEqual(expected)
})
```

- [ ] **Step 2: Run the focused UI test and confirm it fails**

Run: `pnpm --filter yishan-admin test -- --runInBand tests/lead-actions.test.ts`

Expected: FAIL because actions are hard-coded and “转换” incorrectly invokes `qualifyLead`.

- [ ] **Step 3: Implement pure action gating and the three lightweight dialogs**

Implement `leadActions.ts` with the exact state mapping in the test. The qualify dialog requires “资格证据” and “下一步”; it calls `qualifyLead`, never a generic patch. The disqualify dialog uses a controlled reason-code select plus an explanation text area; no free-form status selector. The reactivation dialog requires the new signal/correction reason and visibly says it will return the lead to “跟进中”. All dialogs must show backend errors intact and close only after a successful command.

Replace placeholder print/lock/delete menu items in the lead list and drawer with these actual actions. Preserve transfer/return-to-pool actions, but do not let them alter the local status. Rename the old primary “转换” menu to “转为客户”; remove the implementation that calls `qualifyLead` for it.

- [ ] **Step 4: Implement the conversion confirmation dialog**

On open, request `getLeadConversionPreview(lead.id)`, show loading/error/empty states, and present two explicit choices:

1. use an existing candidate customer or create one; and
2. use a contact belonging to the selected existing customer or create a primary contact.

Pre-fill new customer with `companyName` (or lead name for individual) and new contact from lead fields, but retain editable controls. Disable submit until both a customer and contact choice are valid. On submit call `convertLead`; after success show `已转为客户` and pass `result.lead` upward. For associated existing customers, do not silently alter that customer's owner/source. On conversion conflict, keep the dialog open, display the message, reload preview, and never pretend success.

- [ ] **Step 5: Wire page/drawer state and verify UI behavior**

Lift dialog target state to `LeadPage`; after every command update the matching drawer row and reload the table. In `LeadDetailDrawer`, disable the transfer menu only for converted/disqualified leads, show the disqualification code/reason for invalid leads, and show clickable customer/contact references for converted leads using the existing customer route conventions.

Run:

```bash
pnpm --filter yishan-admin test -- --runInBand tests/lead-actions.test.ts tests/lead-detail-state.test.ts
pnpm --filter yishan-admin tsc
```

Expected: PASS; a qualified lead exposes “转为客户”, while a new lead never does.

- [ ] **Step 6: Commit the lifecycle UI**

```bash
git add apps/yishan-admin/src/modules/crm/pages/leads/QualifyLeadDialog.tsx apps/yishan-admin/src/modules/crm/pages/leads/DisqualifyLeadDialog.tsx apps/yishan-admin/src/modules/crm/pages/leads/ReactivateLeadDialog.tsx apps/yishan-admin/src/modules/crm/pages/leads/ConvertLeadDialog.tsx apps/yishan-admin/src/modules/crm/pages/leads/leadActions.ts apps/yishan-admin/src/modules/crm/pages/leads/index.tsx apps/yishan-admin/src/modules/crm/pages/leads/LeadDetailDrawer.tsx apps/yishan-admin/tests/lead-actions.test.ts apps/yishan-admin/tests/lead-detail-state.test.ts
git commit -m "feat(crm): expose state-gated lead lifecycle actions"
```

### Task 7: Complete API integration coverage and release verification

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/README.md`
- Modify: `docs/superpowers/specs/2026-09-06-lead-operating-loop-design.md` only if implementation reveals a deliberate contract change
- Test: `apps/yishan-api/test/integration/crm-lead-lifecycle.test.ts`
- Test: `apps/yishan-admin/tests/lead-actions.test.ts`

**Interfaces:**
- Consumes all completed endpoints and UI action contracts.
- Produces an executable regression suite and accurate operator-facing API documentation.

- [ ] **Step 1: Write the end-to-end API scenarios before documentation changes**

```ts
it('runs new → processing → qualified → converted and links the resulting customer and contact', async () => {
  // Authenticate a permitted sales user; create lead; post activity; qualify with facts;
  // preview; convert; assert returned IDs and GET lead status/links.
})

it('keeps owner/pool movement independent from a qualified lead status', async () => {
  // Qualify, assign to public pool, claim as another salesperson; status remains qualified.
})

it('rejects conversion from every status except qualified and preserves a qualified lead after a failed selection', async () => {
  // Exercise new, processing, disqualified, converted and mismatched contact cases.
})
```

- [ ] **Step 2: Run the integration test and confirm its first failure identifies missing fixture/setup work**

Run: `pnpm --filter yishan-api test:integration -- crm-lead-lifecycle.test.ts`

Expected: FAIL until the test fixture and lifecycle endpoints are all wired; do not skip this test due to database setup—fix the existing integration fixture convention instead.

- [ ] **Step 3: Make integration tests deterministic and update module documentation**

Use unique fixture names/mobile values, clean only rows created by the fixture, and assert response codes plus persisted data. Document the five state meanings, permitted command endpoints, normalized invalid codes, first-follow-up behavior, and the guarantee that conversion is not a sale. Do not document raw implementation details as user workflow.

- [ ] **Step 4: Run the full verification suite**

```bash
pnpm --filter yishan-api test
pnpm --filter yishan-api build:ts
pnpm --filter yishan-admin test -- --runInBand
pnpm --filter yishan-admin lint
pnpm --filter yishan-admin build
git diff --check
git status --short
```

Expected: all commands pass; `git status --short` contains only intentional lifecycle files plus any pre-existing unrelated user changes identified before Task 1.

- [ ] **Step 5: Commit verification/docs changes and request review**

```bash
git add apps/yishan-api/test/integration/crm-lead-lifecycle.test.ts apps/yishan-api/src/modules/crm/README.md docs/superpowers/specs/2026-09-06-lead-operating-loop-design.md
git commit -m "test(crm): cover lead lifecycle conversion"
```

Request a code review focused on transaction ordering, data scope on existing associations, and transitions from terminal states.

## Plan self-review

- Spec coverage: Task 2 implements automatic first-follow-up processing; Task 3 implements qualification evidence, invalid reasons, terminal guards, and controlled reactivation; Task 4 implements duplicate preview and transactional customer/contact conversion; Task 6 enforces state-specific UI; Task 7 validates owner/pool independence, auditability, and all critical failure paths.
- Placeholder scan: all tasks name files, interfaces, tests, commands, and expected outcomes; no deferred implementation language remains.
- Type consistency: API types originate in Task 1, service signatures in Tasks 2–4, and client consumers in Tasks 5–6. `LeadActivityCreateResponse` is consistently `{ activity, lead }`.
