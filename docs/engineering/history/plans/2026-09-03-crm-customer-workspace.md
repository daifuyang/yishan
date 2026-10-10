# CRM Customer Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the CRM customer page into a URL-restorable customer workspace with a real follow-up workflow and a quick-view Drawer.

**Architecture:** `/crm/customers` remains the list route. URL search parameters carry view, filters, pagination, sorting, and `customerId`. The page orchestrates calls through `@/services/crm`; leaf components only render supplied data and callbacks. Existing customer, contact, and activity APIs remain authoritative.

**Tech Stack:** React 19, TypeScript, Umi Max, Ant Design 6, Ant Design Pro, Jest, Fastify CRM API.

**Spec:** `docs/superpowers/specs/2026-09-03-crm-customer-workspace-design.md`

## Global Constraints

- Preserve all user-owned uncommitted CRM API changes.
- Keep `/crm/customer-detail?id=:id` compatible.
- Do not call `request` or `fetch` from components.
- Hide unauthorized actions and keep the API as the authorization source of truth.
- Do not fabricate stats, stages, opportunities, AI content, or saved views.

---

### Task 1: Define workspace types and URL codec

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/types.ts`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/utils/customerWorkspaceQuery.ts`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/utils/customerWorkspaceQuery.test.ts`
- Modify: `apps/yishan-admin/src/services/crm.ts`

**Interfaces:**
- Produces: `CustomerWorkspaceQuery`, `CustomerWorkspaceFilters`, `CustomerViewId`, `parseCustomerWorkspaceQuery`, and `serializeCustomerWorkspaceQuery`.
- Consumes: existing customer service list types.

- [ ] **Step 1: Write the failing URL round-trip test.**

```ts
it('preserves current list state and selected customer', () => {
  const state = parseCustomerWorkspaceQuery('?view=mine&page=2&pageSize=20&keyword=%E4%B8%8A%E6%B5%B7&customerId=123')
  expect(state).toMatchObject({ view: 'mine', page: 2, pageSize: 20, keyword: '上海', customerId: 123 })
  expect(serializeCustomerWorkspaceQuery(state)).toContain('customerId=123')
})
```

- [ ] **Step 2: Run test and verify it fails.**

Run: `pnpm --filter yishan-admin test -- customerWorkspaceQuery.test.ts --runInBand`

Expected: FAIL because the codec does not exist.

- [ ] **Step 3: Implement the pure codec and contracts.**

```ts
export type CustomerViewId = 'all' | 'mine' | 'pending' | 'important' | 'pool'
export interface CustomerWorkspaceQuery extends CustomerWorkspaceFilters {
  view: CustomerViewId
  page: number
  pageSize: number
  customerId?: number
}
```

The `important` UI view maps to the already-supported `level` filter. Add explicit unavailable capability types for stats, pipeline, and opportunities, but do not add network calls for absent APIs.

- [ ] **Step 4: Run verification.**

Run: `pnpm --filter yishan-admin test -- customerWorkspaceQuery.test.ts --runInBand && pnpm --filter yishan-admin tsc`

Expected: PASS.

- [ ] **Step 5: Commit the task.**

Run: `git add apps/yishan-admin/src/modules/crm/pages/customers/types.ts apps/yishan-admin/src/modules/crm/pages/customers/utils/customerWorkspaceQuery.ts apps/yishan-admin/src/modules/crm/pages/customers/utils/customerWorkspaceQuery.test.ts apps/yishan-admin/src/services/crm.ts && git commit -m "feat(crm): add customer workspace query contracts"`

### Task 2: Create the list workspace shell

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerPageHeader.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerViewTabs.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerFilterBar.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerAdvancedFilterDrawer.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/customerWorkspace.module.less`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerViewTabs.test.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx`

**Interfaces:**
- Consumes: `CustomerWorkspaceQuery`, `onQueryChange(next)`.
- Produces: the title/actions/view/filter shell and supported list query input.

- [ ] **Step 1: Write the failing view change test.**

```tsx
render(<CustomerViewTabs value="mine" onChange={onChange} />)
fireEvent.click(screen.getByRole('tab', { name: '公海' }))
expect(onChange).toHaveBeenCalledWith('pool')
```

- [ ] **Step 2: Run test and verify it fails.**

Run: `pnpm --filter yishan-admin test -- CustomerViewTabs.test.tsx --runInBand`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Build the page shell.**

Use `PageContainer` without overriding its breadcrumb. Present the customer title, subtitle, new-customer action, import action, and low-frequency Dropdown. Place tabs, a 280–340px search field, compact Select filters, reset control, and an advanced-filter Drawer below it.

```tsx
<CustomerViewTabs value={query.view} onChange={(view) => updateQuery({ view, page: 1 })} />
<CustomerFilterBar query={query} onChange={(filters) => updateQuery({ ...filters, page: 1 })} />
```

The advanced Drawer maintains draft values and applies only supported API fields on submit. It labels saved views as unavailable rather than persisting anything.

- [ ] **Step 4: Run verification.**

Run: `pnpm --filter yishan-admin test -- CustomerViewTabs.test.tsx --runInBand && pnpm --filter yishan-admin lint`

Expected: PASS.

- [ ] **Step 5: Commit the task.**

Run: `git add apps/yishan-admin/src/modules/crm/pages/customers && git commit -m "feat(crm): add customer workspace filters and views"`

### Task 3: Rebuild table and stats presentation

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerWorkspaceStats.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerTable.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerTable.test.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx`

**Interfaces:**
- Consumes: customer list data, `onOpenCustomer(id)`, `onStartFollowUp(customer)`, and action visibility flags.
- Produces: dense customer table and truthful loading/error/unavailable stats.

- [ ] **Step 1: Write the failing interaction/permission test.**

```tsx
render(<CustomerTable data={[customer]} onOpenCustomer={open} permissions={{ update: true, delete: false }} />)
fireEvent.click(screen.getByText(customer.name))
expect(open).toHaveBeenCalledWith(customer.id)
fireEvent.click(screen.getByLabelText('更多操作'))
expect(screen.queryByText('删除客户')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run test and verify it fails.**

Run: `pnpm --filter yishan-admin test -- CustomerTable.test.tsx --runInBand`

Expected: FAIL because the table component does not exist.

- [ ] **Step 3: Implement customer rows and summary states.**

Use ProTable toolbar controls for columns, density and reload. Render customer helper text, contacts when returned, restrained status/level tags, owner, follow-up dates, source, and the `[跟进] [···]` action pattern. Row/name clicks must open Drawer. Destructive actions are final menu entries behind `Popconfirm`. `CustomerWorkspaceStats` shows skeleton/error/unavailable status and never hardcodes numbers.

- [ ] **Step 4: Run verification.**

Run: `pnpm --filter yishan-admin test -- CustomerTable.test.tsx --runInBand && pnpm --filter yishan-admin lint`

Expected: PASS.

- [ ] **Step 5: Commit the task.**

Run: `git add apps/yishan-admin/src/modules/crm/pages/customers && git commit -m "feat(crm): rebuild customer list workspace"`

### Task 4: Implement Customer Drawer and overview

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/CustomerDrawer.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/CustomerDrawerHeader.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/CustomerSummaryBar.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/CustomerStagePipeline.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/tabs/OverviewTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/CustomerDrawer.test.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx`

**Interfaces:**
- Consumes: `customerId`, `onClose`, `onOpenFullDetail`, and `getCustomer`.
- Produces: responsive quick-view Drawer that fetches detail independently from the list.

- [ ] **Step 1: Write the failing lazy-load test.**

```tsx
render(<CustomerDrawer customerId={123} open onClose={onClose} />)
expect(screen.getByText('客户详情加载中')).toBeInTheDocument()
await screen.findByText('上海星河科技有限公司')
expect(mockGetCustomer).toHaveBeenCalledWith(123)
expect(mockListContactsByCustomer).not.toHaveBeenCalled()
```

- [ ] **Step 2: Run test and verify it fails.**

Run: `pnpm --filter yishan-admin test -- CustomerDrawer.test.tsx --runInBand`

Expected: FAIL because the Drawer does not exist.

- [ ] **Step 3: Implement the Drawer shell.**

Use responsive widths (`clamp(900px, 58vw, 1180px)` desktop, `90vw` mid-size, full-screen mobile). The header has customer identity, tags, owner, primary follow-up action, and legacy-compatible full-detail navigation. Use skeleton/result/empty/error states. Pipeline receives typed data and shows “暂未配置销售阶段” while unavailable.

```tsx
<Drawer open={open} onClose={onClose} width="clamp(900px, 58vw, 1180px)" destroyOnClose>
  <CustomerDrawerHeader customer={customer} onOpenFullDetail={() => history.push(`/crm/customer-detail?id=${customer.id}`)} />
  <CustomerSummaryBar customer={customer} />
  <Tabs items={tabs} />
</Drawer>
```

- [ ] **Step 4: Wire URL state without list reload.**

Opening sets only `customerId`. Closing removes only `customerId`; it must preserve view, filters, page, page size and sorting. Drawer open/close must not call the table action ref.

- [ ] **Step 5: Run verification.**

Run: `pnpm --filter yishan-admin test -- CustomerDrawer.test.tsx --runInBand && pnpm --filter yishan-admin tsc && pnpm --filter yishan-admin build`

Expected: PASS.

- [ ] **Step 6: Commit the task.**

Run: `git add apps/yishan-admin/src/modules/crm/pages/customers && git commit -m "feat(crm): add customer quick-view drawer"`

### Task 5: Add lazy follow-up, contacts, and detail-page consolidation

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/tabs/FollowUpTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/tabs/ContactsTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/tabs/OpportunitiesTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/tabs/MoreTab.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/tabs/FollowUpTab.test.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerJourney.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/customers/components/CustomerDrawer/CustomerDrawer.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/customer-detail/index.tsx`
- Modify: `apps/yishan-api/src/modules/crm/config/system-menu.json`

**Interfaces:**
- Consumes: existing `createActivity`, customer activity/contact list APIs, contact creation API, and `onCustomerChanged`.
- Produces: saved follow-up refreshes plus lazy tab states; a compatible full detail page using shared display primitives.

- [ ] **Step 1: Write failing follow-up refresh test.**

```tsx
render(<FollowUpTab customerId={123} onCustomerChanged={refresh} />)
fireEvent.change(screen.getByLabelText('跟进内容'), { target: { value: '电话沟通 CRM 方案' } })
fireEvent.click(screen.getByRole('button', { name: '保存跟进' }))
await waitFor(() => expect(mockCreateActivity).toHaveBeenCalled())
expect(refresh).toHaveBeenCalledTimes(1)
```

- [ ] **Step 2: Run test and verify it fails.**

Run: `pnpm --filter yishan-admin test -- FollowUpTab.test.tsx --runInBand`

Expected: FAIL because `FollowUpTab` does not exist.

- [ ] **Step 3: Implement real follow-up and lazy tabs.**

The form contains supported Activity fields: method, contact, content, and next follow-up time. It must not pretend to persist intention, stage, or a next-follow-up plan. On success, re-fetch activities and customer detail without closing Drawer.

```tsx
await createActivity(customerId, values)
await Promise.all([reloadActivities(), onCustomerChanged()])
message.success('跟进已记录')
```

Contacts load at first activation and use the existing nested contact API. Opportunities and unsupported More sections render clear unavailable states. Replace the full-detail raw table/duplicated timelines with shared journey and summary presentation; retain its legacy URL.

- [ ] **Step 4: Consolidate menu.**

Rename “我的客户” to “客户”; hide standalone pool from the sidebar while retaining its route/API. Do not add a false “商机” route.

- [ ] **Step 5: Run full verification.**

Run: `pnpm --filter yishan-admin test -- --runInBand && pnpm --filter yishan-admin lint && pnpm --filter yishan-admin build && pnpm --filter yishan-api test -- src/modules/crm`

Expected: PASS. If an API test fails due to the pre-existing dirty baseline, record it without changing user-owned files.

- [ ] **Step 6: Commit the task.**

Run: `git add apps/yishan-admin/src/modules/crm apps/yishan-api/src/modules/crm/config/system-menu.json && git commit -m "feat(crm): complete customer workspace workflows"`

### Task 6: Final acceptance

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-crm-customer-workspace-design.md` only if an implemented capability boundary needs correction.

**Interfaces:**
- Consumes: tasks 1–5.
- Produces: evidence for list filtering, Drawer state restoration, follow-up refresh and detail compatibility.

- [ ] **Step 1: Exercise the acceptance paths against a local admin session.**

Validate mine view, keyword search, supported filter combinations, Drawer opening/switching/closing, follow-up save with refreshed timeline/times, and full detail navigation. If local data is unavailable, record the missing service/data dependency rather than adding mock production records.

- [ ] **Step 2: Run final quality gate.**

Run: `pnpm --filter yishan-admin test -- --runInBand && pnpm --filter yishan-admin lint && pnpm --filter yishan-admin build && pnpm --filter yishan-api test && git diff --check && git status --short`

Expected: no task-caused failures and no whitespace errors; user-owned CRM API changes remain untouched.

- [ ] **Step 3: Commit documentation only if it changed.**

Run: `git add docs/superpowers/specs/2026-09-03-crm-customer-workspace-design.md && git commit -m "docs: finalize CRM workspace capability notes"`
