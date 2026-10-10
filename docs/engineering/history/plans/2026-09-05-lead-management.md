# Lead Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan task-by-task with tests written and observed failing before production changes.

**Goal:** Add a first-class CRM lead lifecycle from capture through qualification, follow-up, assignment and atomic conversion into customer/contact records.

**Architecture:** Keep leads separate from customers and opportunities. The CRM module owns `crm_lead`, its lifecycle and data-scope rules; it reuses existing source dictionaries, ownership patterns, customer/contact creation services, and the established Route → Service → Repository → Drizzle layering. Lead activity is a dedicated `crm_lead_activity` table unless a fully compatible polymorphic activity migration is demonstrably smaller and safer.

**Tech Stack:** Fastify 5, TypeBox, Drizzle/MySQL, Vitest, React 19, Umi, Ant Design Pro, Jest, pnpm.

**Spec:** User-approved lead-management implementation prompt in this task. This document is its executable summary.

## Global Constraints

- Do not implement opportunities, contracts, orders, marketing automation, external form/webhook ingestion, AI scoring, or BI.
- Do not overload `crm_customer_status` with lead status and do not store lead activities in `crm_activity.customer_id`.
- Do not fabricate client data, API responses or statistics.
- Preserve customer/contact/activity/public-pool API compatibility.
- Reuse existing CRM permission naming, DataScope, service/repository patterns and menu seed conventions.
- All write paths must be authorized by the server; conversion and activity time recalculation must be transactional.
- Work only in this linked worktree and do not modify the parent checkout.

---

### Task 1: Map conventions and establish lead contracts

**Files:**
- Inspect: `apps/yishan-api/src/modules/crm/{db/schema.ts,schemas,services,repositories,routes,tests,config/system-menu.json}`
- Inspect: `apps/yishan-admin/src/modules/crm/` and `apps/yishan-admin/src/services/crm.ts`
- Create: lead schema, repository/service/route test files following existing names

- [ ] Identify the exact customer/contact duplicate, authorization, create and transaction interfaces that conversion will call.
- [ ] Add failing tests for lead contactability validation, duplicate candidates, state transitions and data-scope visibility.
- [ ] Run those tests and confirm failure is due to the missing lead implementation.

### Task 2: Persist leads and lead activities

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/db/schema.ts`
- Create: the next CRM Drizzle migration and metadata using the repository's supported generation workflow
- Create: `repositories/lead.repository.ts`, `repositories/lead-activity.repository.ts`
- Create: lead and lead-activity schemas

- [ ] Add `crm_lead` with identity/contact details, source, intent, status, owner, follow-up dates, disqualification, conversion references, audit fields, soft delete and query-serving indexes.
- [ ] Add `crm_lead_activity` with lead, optional contact detail, follow-up fields, operator and timestamps.
- [ ] Add failing repository/service tests for duplicate lookup across active leads and existing customers/contacts.
- [ ] Implement only enough repository logic to pass the tests, then run the focused test set.

### Task 3: Implement lifecycle, ownership and activity services

**Files:**
- Create: `services/lead.service.ts`, `services/lead-activity.service.ts`
- Modify: CRM error code and permission schemas, module route registration as needed
- Test: new lead service/activity test files

- [ ] Implement create/read/list/update with the required contactability invariant and explainable duplicate candidates.
- [ ] Implement `claim`, `assign`, `qualify`, `disqualify` and guards against writing/assigning terminal converted leads; disqualification requires a reason.
- [ ] Implement lead-pool behavior and data-scope enforcement using the existing customer ownership policy as the reference, never client-side authorization.
- [ ] Implement activity creation in a transaction that recalculates `lastFollowUpAt` and `nextFollowUpAt` on the lead.
- [ ] Add a semantically distinct lead transfer/audit record if no current general audit facility fits.
- [ ] Run the focused tests after each red-green cycle.

### Task 4: Implement safe atomic conversion

**Files:**
- Modify: lead service, customer/contact services only at their existing public boundaries if necessary
- Test: lead conversion service tests

- [ ] Write failing tests for new customer + contact conversion, association to an existing customer, conversion rollback, and concurrent/repeated conversion prevention.
- [ ] Implement a single transaction: recheck duplicates, resolve or create the customer, resolve or create the contact, copy source/owner/appropriate intent data, then mark the lead converted with references/timestamp.
- [ ] Preserve the lead and all lead activities; never create an opportunity.
- [ ] Run the lead service test suite and the existing customer/contact CRM test suites.

### Task 5: Expose APIs, OpenAPI and permissions

**Files:**
- Create: `routes/v1/leads/index.ts` and nested activity routes following existing route conventions
- Modify: route schemas, `config/system-menu.json`, permission seed/config, OpenAPI artifacts only through repository tooling
- Test: API tests where existing patterns make route coverage practical

- [ ] Add list/create/detail/update endpoints plus claim, assign, qualify, disqualify, convert, list activities and create activity.
- [ ] Make list filters real: keyword, status, source, owner, created, last-follow-up and next-follow-up windows, plus system views all/mine/pending/pool/converted/disqualified.
- [ ] Add least-privilege permissions matching existing `crm:*` naming.
- [ ] Verify that generated/committed OpenAPI client artifacts remain in sync via the documented command.

### Task 6: Build the admin lead workspace

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/leads/index.tsx` and focused lead components/hooks
- Modify: CRM client service/types and menu configuration
- Test: focused Jest tests for URL/view state, table rendering and permission-driven actions

- [ ] Add one CRM menu entry “线索”; use top-level system views rather than a separate lead-pool menu.
- [ ] Build a real-data table with required default fields and real filter controls.
- [ ] Open a lead Drawer from the row while preserving URL/list state; handle loading, empty, error, not-found and forbidden states.
- [ ] Implement Overview, Follow-up and Transfer tabs. Expose only actions allowed by current status and permission.
- [ ] Provide a conversion flow that makes the user choose an existing or new customer/contact based on server-provided duplicate candidates.
- [ ] Display converted customer/contact links for terminal converted leads.

### Task 7: Verify, document and review the diff

**Files:**
- Modify only relevant CRM documentation if the project convention requires it

- [ ] Run focused CRM API tests, admin tests, typechecks/lint, API build/OpenAPI synchronization, and production builds proportional to touched applications.
- [ ] Inspect `git diff` to ensure no generated noise or unrelated changes remain.
- [ ] Report exact commands, passing/failing results, migrations, API surface, permissions, and intentionally deferred features.
