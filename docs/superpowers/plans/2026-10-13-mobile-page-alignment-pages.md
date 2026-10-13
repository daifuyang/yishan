# Mobile Page Alignment Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate non-system mobile pages to the approved management language and repair contacts/account-scope behavior without changing business permissions or routes.

**Architecture:** Work in small page families after the foundation plan is complete. Lists/details/forms use the existing management components and `useRequireAuth({ moduleId })`; card pages keep their layout while consuming shared atoms and tokens. Contacts use the existing `DepartmentTreeNavigator` and account-scope helpers rather than creating a second tree implementation.

**Tech Stack:** Taro 4, React, TypeScript, Zustand auth/module stores, existing CommonJS and Playwright browser tests.

**Spec:** `docs/superpowers/specs/2026-10-13-mobile-page-alignment-design.md`

## Global Constraints

- Keep existing routes, permission codes, account switching, and backend business semantics.
- Use existing Ant/Taro/management primitives; do not add a dependency or a global store.
- Every changed request must discard stale results after account/session changes.
- Card pages keep their category layout, but colors, radius, spacing, shadows, checkboxes, arrows, and errors come from shared primitives/tokens.

---

### Task 1: Align login, home, apps, and pinned-app interactions

**Files:**
- Modify: `apps/demo/app/src/pages/login/index.tsx`
- Modify: `apps/demo/app/src/pages/login/index.module.scss`
- Modify: `apps/demo/app/src/pages/index/index.tsx` and local components/styles
- Modify: `apps/demo/app/src/pages/apps/index.tsx` and local styles
- Modify: `apps/demo/app/src/pages/apps/pinned/index.tsx`
- Modify: affected `apps/demo/app/tests/login.test.cjs`, `home.test.cjs`, `home-apps.test.cjs`

**Interfaces:**
- Consumes: foundation `Checkbox`, `FormError`, `LineIcon`, `ManagementSearchBar`, `ManagementFilterBar`, `ManagementStates`, `SurfaceCard`, `MetricCard`, and `ManagementCell.trailingAction`.
- Produces: login validation errors rendered inline; apps search/filter/list states rendered through shared components; pinned app actions rendered through `trailingAction`.

- [ ] **Step 1: Add/adjust failing source-contract assertions**

  Assert that login imports the shared `Checkbox` and `FormError`, home does not render a literal `›`, apps does not define a private search input, and pinned apps do not pass action buttons through `tag`.

- [ ] **Step 2: Run the focused tests**

  ```bash
  node --test apps/demo/app/tests/login.test.cjs apps/demo/app/tests/home.test.cjs apps/demo/app/tests/home-apps.test.cjs
  ```

  Expected: FAIL against the current private implementations.

- [ ] **Step 3: Migrate login behavior**

  Replace the custom checkbox with `Checkbox`; keep the label stacking exception and 16px label size. Store submit/validation failure in the existing form state and render `FormError` at the field/form boundary. Remove gray disabled blocks and replace literal colors with tokens.

- [ ] **Step 4: Migrate home/apps behavior**

  Wrap existing card groups with `SurfaceCard`/`MetricCard`, replace literal arrows with `LineIcon`, reuse the shared navigation-inset hook, and use `ManagementStates` for app loading/error/empty states. Preserve application icon mapping from `ApplicationIcon`.

- [ ] **Step 5: Migrate pinned actions**

  Pass each move action as `trailingAction`, stop propagation in the action control, and keep row click behavior unchanged.

- [ ] **Step 6: Run tests and commit**

  ```bash
  node --test apps/demo/app/tests/login.test.cjs apps/demo/app/tests/home.test.cjs apps/demo/app/tests/home-apps.test.cjs
  pnpm --filter @yishan/demo-app test
  git add apps/demo/app/src/pages/login apps/demo/app/src/pages/index apps/demo/app/src/pages/apps apps/demo/app/tests
  git commit -m "refactor(app): align login home and apps pages"
  ```

### Task 2: Align profile forms and settings pages

**Files:**
- Modify: `apps/demo/app/src/pages/mine/index.tsx` and styles
- Modify: `apps/demo/app/src/pages/security/index.tsx` and styles
- Modify: `apps/demo/app/src/pages/profile/edit/index.tsx`
- Modify: `apps/demo/app/src/pages/profile/password/index.tsx`
- Delete: local `PasswordRow` implementation where defined
- Modify: `apps/demo/app/tests/profile-forms.test.cjs`, `profile-sections.test.cjs`

**Interfaces:**
- Consumes: `ManagementList`, `ManagementCell`, `ActionSheet`, `FormError`, `SecretField`, `FormSubmitBar`, and foundation account/auth behavior.
- Produces: settings pages with management list rows; profile form failures kept inline and input preserved.

- [ ] **Step 1: Add failing assertions for shared controls and error placement**

  Assert no `SettingCell`, `SettingGroup`, `DangerAction`, `PasswordRow`, or failure `Taro.showToast` remains in the target pages; assert `FormError` and `SecretField` are present.

- [ ] **Step 2: Run focused profile tests**

  ```bash
  node --test apps/demo/app/tests/profile-forms.test.cjs apps/demo/app/tests/profile-sections.test.cjs
  ```

- [ ] **Step 3: Migrate settings rows and actions**

  Render settings with `ManagementList`/`ManagementCell`; put destructive or secondary actions in `ActionSheet`; keep existing navigation and permission checks.

- [ ] **Step 4: Migrate profile forms**

  Use `FormError` for validation/save failures, keep the modal/page open with entered values on failure, use `SecretField` for passwords, and close/reset only after a successful response.

- [ ] **Step 5: Run focused and app tests, then commit**

  ```bash
  node --test apps/demo/app/tests/profile-forms.test.cjs apps/demo/app/tests/profile-sections.test.cjs
  pnpm --filter @yishan/demo-app test
  git add apps/demo/app/src/pages/mine apps/demo/app/src/pages/security apps/demo/app/src/pages/profile/edit apps/demo/app/src/pages/profile/password apps/demo/app/tests
  git commit -m "refactor(app): align profile and settings pages"
  ```

### Task 3: Restore the contacts department tree

**Files:**
- Modify: `apps/demo/app/src/pages/contacts/index/index.tsx`
- Modify: `apps/demo/app/src/pages/contacts/index/index.module.scss`
- Modify: `apps/demo/app/src/pages/contacts/dept/index.tsx`
- Modify: `apps/demo/app/src/pages/contacts/dept/index.module.scss`
- Modify: `apps/demo/app/tests/contacts-dept.test.cjs`
- Modify: `apps/demo/app/tests/dept-tree.test.cjs` only when the public contract changes

**Interfaces:**
- Consumes: `DepartmentTreeNavigator`, `flattenDepts`, `hasChildren`, `ManagementPage`, `ManagementPageHeader`, `ManagementStates`, `ManagementList`, `ManagementCell`, `withAccountScope`.
- Produces: controlled `expandedIds` state, single initial load, and account-scoped department/member data.

- [ ] **Step 1: Write failing tree and request-count assertions**

  Add a fixture with root, child, and grandchild departments. Assert only roots are visible initially, toggling a parent reveals its child, clicking a department navigates, and first entry calls `getDeptTree` once.

- [ ] **Step 2: Run the focused contacts tests**

  ```bash
  node --test apps/demo/app/tests/contacts-dept.test.cjs apps/demo/app/tests/dept-tree.test.cjs
  ```

- [ ] **Step 3: Replace the flattened `ListItem` implementation**

  Keep the server tree as the source of truth, derive flat display rows with `flattenDepts`, and pass `depth`, `hasChildren`, `expanded`, `onToggle`, and `onClick` to `DepartmentTreeNavigator`/`ManagementTreeCell`. Use one effect or one `useDidShow` path for the first load; later shows only reload after an explicit refresh/session change.

- [ ] **Step 4: Add account/session protection**

  Capture the current account/session version before the request and apply the response through `withAccountScope`; clear `expandedIds`, data, and errors on account change. Use the page’s concrete module ID in `useRequireAuth`.

- [ ] **Step 5: Migrate the department member page and remove dead styles**

  Use `ManagementPageHeader`, `ManagementList`, `ManagementCell`, and `ManagementStates`; retain avatar/name/contact fields and navigation title. Delete `.dept__initial` and any unused flattened-node styles.

- [ ] **Step 6: Run focused tests and commit**

  ```bash
  node --test apps/demo/app/tests/contacts-dept.test.cjs apps/demo/app/tests/dept-tree.test.cjs
  pnpm --filter @yishan/demo-app test
  git add apps/demo/app/src/pages/contacts apps/demo/app/tests/contacts-dept.test.cjs apps/demo/app/tests/dept-tree.test.cjs
  git commit -m "fix(app): restore scoped contacts department tree"
  ```

### Task 4: Align demo pages and remove reverse dependency

**Files:**
- Modify: `apps/demo/app/src/pages/demo/health/index.tsx`
- Modify: `apps/demo/app/src/pages/demo/quickstart/index.tsx`
- Modify: `apps/demo/app/src/pages/demo/region/index.tsx`
- Modify: `apps/demo/app/src/pages/demo/todos/index.tsx`
- Modify: `apps/demo/app/src/pages/demo/todos/detail/index.tsx`
- Modify: `apps/demo/app/src/pages/demo/todos/form/index.tsx`
- Modify: local demo styles and `apps/demo/app/src/pages/system/_shared/AdminUI.tsx` consumers
- Modify: `apps/demo/app/tests/demo-pages.test.cjs`, `region-module-pages.test.cjs`

- [ ] **Step 1: Inventory reverse imports and add source-contract checks**

  ```bash
  rg -n "pages/system/_shared/AdminUI|AdminPage|AdminSelect|AdminNotice" apps/demo/app/src/pages/demo
  ```

  Add assertions that demo pages use public management/form/feedback exports and carry the “组件演示，非页面样板” header comment where specified.

- [ ] **Step 2: Migrate each demo page**

  Keep Todo CRUD behavior unchanged; use shared page headers and form atoms. Remove duplicate `.content` styles, correct `FormSection`/`DetailRow` semantics, remove duplicate health metrics, and move picker/date rows to `PickerRow`/`DateField`.

- [ ] **Step 3: Run demo tests and commit**

  ```bash
  node --test apps/demo/app/tests/demo-pages.test.cjs apps/demo/app/tests/region-module-pages.test.cjs
  pnpm --filter @yishan/demo-app test
  git add apps/demo/app/src/pages/demo apps/demo/app/tests/demo-pages.test.cjs apps/demo/app/tests/region-module-pages.test.cjs
  git commit -m "refactor(app): align demo page examples"
  ```

### Task 5: Remove system baseline tails and dead page

**Files:**
- Modify: `apps/demo/app/src/pages/system/dict/items/index.tsx`
- Modify: `apps/demo/app/src/pages/system/role/RoleEditor.tsx`
- Modify: `apps/demo/app/src/pages/system/dept/DepartmentForm.tsx`
- Modify: `apps/demo/app/src/pages/system/position/form/index.tsx`
- Delete: `apps/demo/app/src/pages/system/coming-soon/index.tsx` and its styles/config if present
- Modify: `apps/demo/app/tests/dictionary-pages.test.cjs`, `position.test.cjs`, `system-authorization.test.cjs`

- [ ] **Step 1: Add failing assertions for legacy exports and disabled propagation**

  Assert the target files no longer import `AdminPage`, `AdminSelect`, or `AdminNotice`; assert a disabled `FormField` passes disabled to its child control.

- [ ] **Step 2: Replace legacy wrappers with public management/form components**

  Preserve route paths, permissions, data loading, and submit behavior. In `FormField`, ensure the existing `disabled` prop reaches the actual input/select/picker in position forms.

- [ ] **Step 3: Remove the unreachable page only after reference check**

  ```bash
  rg -n "system/coming-soon|coming-soon" apps/demo/app/src apps/demo/app/tests
  ```

  Delete it only when the search confirms no registered route or test depends on it.

- [ ] **Step 4: Run system-focused tests and commit**

  ```bash
  node --test apps/demo/app/tests/dictionary-pages.test.cjs apps/demo/app/tests/position.test.cjs apps/demo/app/tests/system-authorization.test.cjs
  pnpm --filter @yishan/demo-app test
  git add apps/demo/app/src/pages/system apps/demo/app/tests
  git commit -m "refactor(app): remove remaining mobile management tails"
  ```

### Task 6: Run the complete page-line quality gate

**Files:**
- Test only: existing App test and browser suites

- [ ] **Step 1: Run mobile checks**

  ```bash
  pnpm typecheck:mobile
  pnpm --filter @yishan/demo-app test
  pnpm build:app
  pnpm check:taro
  pnpm check:boundaries
  ```

- [ ] **Step 2: Run the H5 browser suites at both narrow widths**

  Build the H5 app and run the existing browser scripts for home/apps, system/demo, and contacts at 320px and 390px. Record failures by page behavior, not by weakening assertions.

- [ ] **Step 3: Commit only verification updates**

  ```bash
  git status --short
  git diff --check
  ```

  Generated build output remains uncommitted.
