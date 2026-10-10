# Lead Activity Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist lead follow-up records and present them in a date-grouped, filterable Activity Rail with an inline composer.

**Architecture:** Add a dedicated `crm_lead_activity` table so customer activity and dashboard queries remain untouched. Nest activity list/create endpoints beneath `/api/crm/v1/leads/:id/activities`; the frontend combines persisted follow-ups with derived lifecycle events from the lead row for a single timeline.

**Tech Stack:** Fastify, Drizzle/MySQL, TypeBox, React 19, Ant Design 6, Jest, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-lead-operating-loop-design.md`

## Global Constraints

- Do not change the left-side lead detail information architecture or existing customer activity tables/routes.
- Use CRM permissions and data-scope rules for all lead activity reads/writes.
- Follow-up types are `phone`, `wechat`, `visit`, `meeting`, `email`, and `other`.
- Timeline uses typography, whitespace, and `Timeline`; it must not introduce activity cards or date banners.

---

### Task 1: Persist lead follow-up records

**Files:**
- Create: `apps/yishan-api/src/modules/crm/repositories/lead-activity.repository.ts`
- Create: `apps/yishan-api/src/modules/crm/services/lead-activity.service.ts`
- Create: `apps/yishan-api/src/modules/crm/tests/lead-activity-service.test.ts`
- Modify: `apps/yishan-api/src/modules/crm/db/schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/drizzle/0002_add-lead-activities.sql`

**Interfaces:**
- Produces `LeadActivityRepository.listByLeadId(leadId)` and `LeadActivityService.create(leadId, input, currentUser)`.
- A created activity updates `crm_lead.last_follow_up_at` and `crm_lead.next_follow_up_at` in the same transaction.

- [ ] Write a failing Vitest asserting `LeadActivityService.create` stores the current operator and updates both lead follow-up timestamps.
- [ ] Run `pnpm --filter yishan-api test lead-activity-service.test.ts` and verify it fails because the service is missing.
- [ ] Add `crm_lead_activity` with `lead_id`, type, content, occurred/next-follow-up timestamps, operator, and audit timestamps; index `(lead_id, occurred_at)`.
- [ ] Implement repository list/create and a scoped service using `LeadRepository.findById`, then run the test until it passes.

### Task 2: Expose lead activity HTTP contract

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/schemas/lead.schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/leads/index.ts`
- Modify: `apps/yishan-admin/src/services/crm.ts`

**Interfaces:**
- Produces `GET /api/crm/v1/leads/:id/activities` and `POST /api/crm/v1/leads/:id/activities`.
- Produces frontend `listLeadActivities(id)` and `createLeadActivity(id, input)`.

- [ ] Write a route/service test that rejects an empty follow-up content and accepts a valid `phone` record.
- [ ] Define TypeBox request/response schemas mirroring the activity contract and register both nested routes with lead read/create permissions.
- [ ] Add typed frontend client functions and run the focused API test to green.

### Task 3: Build the Activity Rail and inline composer

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/leads/LeadActivityRail.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/leadTimeline.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/leads/LeadDetailDrawer.tsx`
- Modify: `apps/yishan-admin/tests/lead-timeline.test.ts`

**Interfaces:**
- `LeadActivityRail` consumes a `LeadRow`, loads persisted follow-ups, filters `all|followup|status|system`, and invokes `createLeadActivity` from an inline composer.
- `buildLeadTimeline` returns typed activity events grouped by local calendar date.

- [ ] Write a failing Jest test that combines a persisted phone follow-up with derived creation/status events and groups them by date.
- [ ] Implement the rail header, text tabs, date groups, and lightweight timeline item hierarchy.
- [ ] Add the inline composer: type selector, content input, optional next-follow-up date, cancel/save; refresh the rail after save.
- [ ] Run `pnpm --filter yishan-admin jest --runInBand tests/lead-timeline.test.ts` and focused component tests until green.

### Task 4: Verify the integrated feature

**Files:**
- Modify only files from Tasks 1–3 when verification identifies a defect.

- [ ] Run focused API Vitest tests, focused admin Jest tests, and `pnpm --filter yishan-admin tsc --noEmit`.
- [ ] Run Biome checks on changed admin files and `git diff --check`.
- [ ] Manually inspect the authenticated `/crm/leads` drawer: write a follow-up, switch each filter, and confirm the new entry persists after reopening.
