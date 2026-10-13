# Mobile Page Alignment Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one compatible management page foundation and one account-scope utility before migrating business pages.

**Architecture:** Extend the existing `ManagementPageHeader` in `ManagementPage.tsx` until it is behaviorally compatible with `PageHeader`, then migrate production imports and remove the old component. Keep `PageContainer` as the session/permission shell while management pages use `ManagementPage` for visual layout and explicit `useRequireAuth`. Add only the four shared atoms justified by the approved spec.

**Tech Stack:** Taro 4, React, TypeScript, SCSS tokens, existing CommonJS source tests.

**Spec:** `docs/superpowers/specs/2026-10-13-mobile-page-alignment-design.md`

## Global Constraints

- `PageContainer` remains a reusable session/permission shell; it is not deleted or converted into a provider.
- Existing routes, permissions, account switching, and H5/weapp behavior remain unchanged.
- All colors, spacing, radius, and shadows use existing `apps/demo/app/src/styles/tokens.scss` tokens.
- Do not add dependencies or introduce a global store.

---

### Task 1: Make `ManagementPageHeader` compatible with `PageHeader`

**Files:**
- Modify: `apps/demo/app/src/components/management/ManagementPage.tsx`
- Modify: `apps/demo/app/src/components/management/ManagementPage.module.scss`
- Test: `apps/demo/app/tests/management-page-header.test.cjs`

**Interfaces:**
- Consumes: current `ManagementPageHeaderProps` and `navigateBack`.
- Produces: `ManagementPageHeaderProps` with `title: ReactNode`, `subtitle?: ReactNode`, `action?: ReactNode`, `bordered?: boolean`, `className?: string`, `onBack?: () => void`, and `showBack?: boolean`.

- [ ] **Step 1: Add failing compatibility assertions**

  Load `ManagementPage.tsx` with the existing test loader and assert that `action`, `subtitle`, `bordered`, `className`, and `showBack` are represented in the returned tree. Assert that no back control is rendered when `showBack` is false.

- [ ] **Step 2: Run the focused test**

  Run:

  ```bash
  node --test apps/demo/app/tests/management-page-header.test.cjs
  ```

  Expected: FAIL because the current header lacks `bordered`, `className`, and the old title/right compatibility.

- [ ] **Step 3: Implement the compatible header**

  Preserve the current `action` prop name. Add the missing optional props, make the title/subtitle `ReactNode`, apply the sticky/safe-area/border classes from the old header, and map the old `right` behavior only at migration call sites rather than adding a second public prop.

- [ ] **Step 4: Run the focused test and mobile typecheck**

  Run the focused test again, then:

  ```bash
  pnpm typecheck:mobile
  ```

  Expected: PASS with no new TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/demo/app/src/components/management/ManagementPage.tsx apps/demo/app/src/components/management/ManagementPage.module.scss apps/demo/app/tests/management-page-header.test.cjs
  git commit -m "refactor(app): align management page header contract"
  ```

### Task 2: Migrate `PageHeader` imports and remove the duplicate

**Files:**
- Modify: all production `.tsx` files returned by `rg -l "PageHeader" apps/demo/app/src`
- Modify: `apps/demo/app/src/pages/system/_shared/MenuFormScaffold.tsx`
- Modify: `apps/demo/app/src/pages/system/_shared/MenuDetailScaffold.tsx`
- Modify: affected `apps/demo/app/tests/*.cjs` mocks
- Modify: `apps/demo/app/README.md`
- Delete: `apps/demo/app/src/components/molecules/PageHeader/PageHeader.tsx`
- Delete: `apps/demo/app/src/components/molecules/PageHeader/PageHeader.module.scss`

**Interfaces:**
- Consumes: compatible `ManagementPageHeader` from Task 1.
- Produces: no production import of `PageHeader` from `@/components/molecules`; all old `right` props become `action`.

- [ ] **Step 1: Inventory and classify every production use**

  Run:

  ```bash
  rg -l "PageHeader" apps/demo/app/src --glob '*.tsx'
  rg -n "<PageHeader|right=|bordered=|subtitle=" apps/demo/app/src --glob '*.tsx'
  ```

  Record every use in the task commit and map `right` to `action`, keeping H5-only rendering and weapp native navigation behavior.

- [ ] **Step 2: Update source and tests**

  Replace imports with `@/components/management`, replace `<PageHeader ... right={...} />` with `<ManagementPageHeader ... action={...} />`, and update test mocks to expose `ManagementPageHeader`.

- [ ] **Step 3: Run residual-reference checks**

  ```bash
  rg -n "PageHeader|@/components/molecules.*PageHeader|right=" apps/demo/app/src apps/demo/app/tests
  ```

  Expected: no old production component imports; remaining `right` matches must be unrelated props and be reviewed individually.

- [ ] **Step 4: Delete the old component and run tests**

  Delete both files under `components/molecules/PageHeader/`, then run:

  ```bash
  pnpm --filter @yishan/demo-app test
  pnpm typecheck:mobile
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add apps/demo/app/src apps/demo/app/tests apps/demo/app/README.md
  git commit -m "refactor(app): remove duplicate mobile page header"
  ```

### Task 3: Move account-scope helpers without changing semantics

**Files:**
- Create: `apps/demo/app/src/utils/account-scope.ts`
- Modify: current source file defining `withAccountScope` and `errorMessage` under `apps/demo/app/src/pages/system/_shared/`
- Modify: all production imports found by `rg -n "withAccountScope|errorMessage" apps/demo/app/src`
- Modify: `apps/demo/app/tests/account-scope.test.cjs`

**Interfaces:**
- Consumes: current helper implementations and session-version APIs.
- Produces: identical exported helper signatures from `@/utils/account-scope`.

- [ ] **Step 1: Copy the existing tests to the new module path**

  Change only the loader path/import path in `account-scope.test.cjs`; keep assertions for account ID, session version, stale results, and error conversion unchanged.

- [ ] **Step 2: Run the focused test to verify the new path fails**

  ```bash
  node --test apps/demo/app/tests/account-scope.test.cjs
  ```

- [ ] **Step 3: Move the implementation and update imports**

  Move the implementation into `utils/account-scope.ts`, preserve named exports and function signatures, and replace all system-page imports. Do not add a compatibility re-export unless an existing public import outside `apps/demo/app/src` requires it.

- [ ] **Step 4: Run focused and app tests**

  ```bash
  node --test apps/demo/app/tests/account-scope.test.cjs
  pnpm --filter @yishan/demo-app test
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add apps/demo/app/src/utils/account-scope.ts apps/demo/app/src apps/demo/app/tests/account-scope.test.cjs
  git commit -m "refactor(app): centralize account scope helpers"
  ```

### Task 4: Add the shared atoms and `ManagementCell` action slots

**Files:**
- Create: `apps/demo/app/src/components/management/PickerRow.tsx`
- Create: `apps/demo/app/src/components/management/DateField.tsx`
- Create: `apps/demo/app/src/components/management/SurfaceCard.tsx`
- Create: `apps/demo/app/src/components/management/MetricCard.tsx`
- Modify: `apps/demo/app/src/components/management/ManagementList.tsx`
- Modify: `apps/demo/app/src/components/management/index.ts`
- Create: `apps/demo/app/src/components/management/ManagementAtoms.module.scss`
- Test: `apps/demo/app/tests/management-atoms.test.cjs`

**Interfaces:**
- `PickerRowProps`: `label`, `value`, `placeholder`, `disabled?`, `arrow?`, `onClick?`.
- `DateFieldProps`: `value`, `placeholder?`, `disabled?`, `onChange(value: string)`.
- `ManagementCellProps`: optional `selection?: ReactNode` and `trailingAction?: ReactNode`; order is content, tag, selection, trailingAction, arrow.

- [ ] **Step 1: Write focused behavior tests**

  Assert PickerRow placeholder/value rendering, DateField date extraction, disabled click behavior, and ManagementCell slot order plus action click propagation.

- [ ] **Step 2: Run focused tests and confirm failure**

  ```bash
  node --test apps/demo/app/tests/management-atoms.test.cjs
  ```

- [ ] **Step 3: Implement the minimum atoms and slots**

  Reuse `LineIcon`, existing form tokens, and Taro `Picker`; do not duplicate picker/date parsing logic outside these atoms. Add the new exports to `management/index.ts`.

- [ ] **Step 4: Run focused tests and the boundary checks**

  ```bash
  node --test apps/demo/app/tests/management-atoms.test.cjs
  pnpm typecheck:mobile
  pnpm check:boundaries
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add apps/demo/app/src/components/management apps/demo/app/tests/management-atoms.test.cjs
  git commit -m "feat(app): add shared management page atoms"
  ```

### Task 5: Update documentation and verify the foundation

**Files:**
- Modify: `apps/demo/app/src/components/management/ManagementList.tsx`
- Modify: `docs/design/mobile-form-spec.md`
- Modify: `apps/demo/app/README.md` if the page-header ownership text changed during migration

- [ ] **Step 1: Replace the JSDoc example**

  Describe a single structured description and state column; remove the `@账号 · 手机` example.

- [ ] **Step 2: Add card-page and H5-header rules**

  Document tokenized card surfaces, shared controls, and the H5/weapp header rule without duplicating the full implementation spec.

- [ ] **Step 3: Run the foundation quality gate**

  ```bash
  pnpm typecheck:mobile
  pnpm --filter @yishan/demo-app test
  pnpm build:app
  pnpm check:taro
  pnpm check:boundaries
  git diff --check
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add apps/demo/app/src/components/management/ManagementList.tsx docs/design/mobile-form-spec.md apps/demo/app/README.md
  git commit -m "docs(app): document aligned mobile page rules"
  ```
