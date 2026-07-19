# Tasks: yishan-app 品牌基线与驾驶舱 MVP

**Input**: Design documents from `/specs/002-app-ui-upgrade/`
- plan.md (required)
- spec.md (required, 7 user stories)
- data-model.md (DashboardStats entity)
- contracts/dashboard-api.md (1 new endpoint)
- research.md (8 research decisions)
- quickstart.md (acceptance checklist)

**Tests**: Vitest tests included for the new API aggregation endpoint (per FR-010 + constitution Type Safety gate). Admin/App have no mandatory tests; manual lint + tsc checks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. P1 user stories form the MVP (US1, US2, US3, US4, US6, US7). US5 (Apps Tab) is P2 and requires only verification, no implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, …)
- Include exact file paths in descriptions

## Path Conventions

Monorepo with 4 packages: `apps/yishan-api` (Fastify + Prisma), `apps/yishan-app` (Taro 4 + React 18), `apps/yishan-admin` (Umi 4 + Antd 6), `apps/yishan-docs` (Docusaurus 3).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare directories and module scaffolds for the new feature. No new packages are added.

- [ ] T001 Create dashboard route directory `apps/yishan-api/src/core/routes/api/v1/app/dashboard/`
- [ ] T002 [P] Create API service directory `apps/yishan-api/src/services/` (verify it exists for `dashboard.service.ts`)
- [ ] T003 [P] Create mobile app dashboard component directories `apps/yishan-app/src/components/organisms/DashboardHero/`, `…/StatCard/`, `…/DashboardGrid/`
- [ ] T004 [P] Create mobile app skeleton component directory `apps/yishan-app/src/components/feedback/DashboardSkeleton/`
- [ ] T005 [P] Create mobile app SVG icon directory `apps/yishan-app/src/components/icons/svg/`
- [ ] T006 [P] Verify Prisma schema `apps/yishan-api/prisma/schema/` contains `sysUser`, `sysDept`, `sysLoginLog` (read-only check; no schema changes)

---

## Phase 2: Foundational — User Story 1: 品牌识别一致（跨端） (Priority: P1) 🎯 MVP

**Goal**: Establish a unified brand baseline (主色、Logo 占位、品牌名) across admin / app / docs. App uses system default font (no font subset download needed).

**Independent Test**: Open admin, app, and docs in parallel; verify brand name is 「移山」, primary color is `#1677FF`, app uses system default font, and `⛰` character mark appears. Use a screenshot color-picker to confirm `#1677FF` matches across all three ends.

### Implementation for User Story 1

- [ ] T007 [P] [US1] Add gradient + shadow tokens (`--color-primary-gradient-from/to`, `--shadow-tabbar`, `--tab-bar-floating-height/bottom`) to `apps/yishan-app/src/styles/tokens.scss`
- [ ] T008 [P] [US1] Update admin antd theme token `colorPrimary: '#1677FF'` in `apps/yishan-admin/config/config.ts` (antd.configProvider.theme.token block)
- [ ] T009 [P] [US1] Update admin default settings `colorPrimary: '#1890ff'` → `'#1677FF'` and `title: '移山后台管理系统'` → `'移山'` in `apps/yishan-admin/config/defaultSettings.ts`
- [ ] T010 [P] [US1] Update docs brand `title: '移山'` and tagline `tagline: '简单可依赖的后台基座'` in `apps/yishan-docs/docusaurus.config.ts`
- [ ] T011 [US1] Verify `navigationBarTitleText: '移山'` is present in `apps/yishan-app/src/app.config.ts` (window block, should already be '移山')
- [ ] T012 [US1] Create admin logo override component using `⛰` character mark in `apps/yishan-admin/src/components/BrandLogo/index.tsx` (returns View with `⛰` + 「移山」, sized 18-22px) and export from `apps/yishan-admin/src/components/BrandLogo/index.ts` barrel
- [ ] T013 [US1] Wire `BrandLogo` into admin ProLayout title area in `apps/yishan-admin/config/defaultSettings.ts` (set `logo` to a data URL or component reference that renders `⛰`)

**Checkpoint**: Brand name, color, and logo are consistent across admin / app / docs. App uses system default font (no AlibabaSans). US1 acceptance scenarios 1-5 pass.

---

## Phase 3: User Story 2: 登录页品牌呈现 (Priority: P1) 🎯 MVP

**Goal**: 登录页顶部展示三段式品牌区（⛰ + 「移山」+ 品牌主张），表单视口严格垂直居中。

**Independent Test**: 录屏从打开 app 到完成登录的全过程。验证：登录页顶部有 48-64px `⛰` 字符标、「移山」24-28px 产品名、「简单可依赖的后台基座」14px 副标题；输入框聚焦时边框变为 `#1677FF`；登录按钮 loading 态正常；登录成功后平滑跳转首页。

### Implementation for User Story 2

- [ ] T016 [P] [US2] Create brand area component `apps/yishan-app/src/components/organisms/LoginBrand/index.tsx` + `LoginBrand.module.scss` (props: none; renders `⛰` 48-64px + 「移山」 + slogan, vertical centered)
- [ ] T017 [US2] Rewrite login page with brand area + viewport vertical centering in `apps/yishan-app/src/pages/login/index.tsx` (flex column, min-height 100vh, justify-content center, LoginBrand on top, form on bottom)
- [ ] T018 [US2] Update login form input focus state to use `--color-primary` border in `apps/yishan-app/src/pages/login/index.module.scss`
- [ ] T019 [US2] Verify login page `navigationBarTitleText: '登录'` in `apps/yishan-app/src/pages/login/index.config.ts` (system default nav bar, white bg)

**Checkpoint**: Login page brand area is fully visible and centered, form is viewport-centered, focus/loading states use `#1677FF`. US2 acceptance scenarios 1-3 pass.

---

## Phase 4: User Story 6: 底部 TabBar 圆角悬浮胶囊 (Priority: P1) 🎯 MVP

**Goal**: 重做 TabBar 为圆角悬浮胶囊形态，距底部 8-12px、左右贴边圆角 12-16px、白色背景 + 阴影、激活态 36×36 主色淡色 chip。

**Independent Test**: 在 3 个 Tab 之间切换，验证 TabBar 距底部 8-12px、左右圆角 12-16px、激活态有 36×36 主色 chip、切换 200ms 过渡无闪烁；iPhone 模拟器不与 Home Indicator 重叠。

### Implementation for User Story 6

- [ ] T020 [P] [US6] Add floating tab bar styles (position fixed, bottom 8-12px, left/right 12px, border-radius 16px, background `#FFFFFF`, `--shadow-md`, padding-bottom safe-area) in `apps/yishan-app/src/components/organisms/TabBar/TabBar.module.scss`
- [ ] T021 [P] [US6] Add active state chip (36×36 background `--color-primary-bg`, border-radius full, icon color `#1677FF`, text `--color-primary` semibold) in `apps/yishan-app/src/components/organisms/TabBar/TabBar.module.scss`
- [ ] T022 [US6] Update tab switch transition (background-color + icon color + text color `transition: 200ms linear`) in `apps/yishan-app/src/components/organisms/TabBar/TabBar.module.scss`
- [ ] T023 [US6] Update active tab icon to render inside chip wrapper in `apps/yishan-app/src/components/organisms/TabBar/TabBar.tsx` (wrap `<IconFont>` in `<View className={styles.activeChip}>` when active)
- [ ] T024 [US6] Add iPhone Home Indicator safe area padding via `env(safe-area-inset-bottom)` + 12-16px in `apps/yishan-app/src/components/organisms/TabBar/TabBar.module.scss`
- [ ] T025 [US6] Verify TabBar mounted on all 3 Tab pages (`pages/index/index.tsx`, `pages/apps/index.tsx`, `pages/mine/index.tsx`) and `currentPath` passed correctly

**Checkpoint**: TabBar is floating capsule, has active chip, switches smoothly. US6 acceptance scenarios 1-6 pass.

---

## Phase 5: User Story 3: 首页看板驾驶舱（大气体感） (Priority: P1) 🎯 MVP

**Goal**: 管理员首页展示顶部主色品牌渐变带 + 大号欢迎语 + 4 张统计卡 + 最近登录；普通用户隐藏 4 张统计卡但保留渐变带 + 欢迎语。聚合接口 `GET /api/v1/app/dashboard/stats` 仅管理员可访问。

**Independent Test**: 录屏管理员/普通用户进入首页的 1.5 秒。验证：80-120px 渐变带（`#1677FF` → `#0958D9`）、`Hi, 姓名` ≥ 32px、4 张卡片数字 32-40px 主色加粗、卡片圆角 12-16px、下拉刷新、加载/错误/空三态；普通用户隐藏 4 张卡。

### API Implementation for User Story 3

- [ ] T026 [P] [US3] Create `DashboardStats` TypeBox schema (`Type.Object` with `userTotal/deptTotal/todayLogin/online` Integer ≥ 0) in `apps/yishan-api/src/core/schemas/dashboard.ts`
- [ ] T027 [US3] Create `requireAdmin` preHandler middleware (check `request.currentUser.roles` includes `admin` or `super_admin`, throw 403 if not) in `apps/yishan-api/src/core/middleware/require-admin.ts`
- [ ] T028 [US3] Create `DashboardService.getStats()` in `apps/yishan-api/src/services/dashboard.service.ts` (Promise.all 4 queries: `prisma.sysUser.count`, `prisma.sysDept.count`, `prisma.sysLoginLog.count` today, distinct userId in 5min) + Redis cache `dashboard:stats` TTL 30s
- [ ] T029 [US3] Create dashboard route `GET /stats` in `apps/yishan-api/src/core/routes/api/v1/app/dashboard/index.ts` (preHandler `[fastify.authenticate, requireAdmin]`, schema tag `app-dashboard`, response `DashboardStatsResp`)
- [ ] T030 [US3] Register dashboard route in `apps/yishan-api/src/core/routes/api/v1/app/index.ts` (import dashboard plugin and register with prefix)
- [ ] T031 [P] [US3] Create Vitest test for dashboard service aggregation logic in `apps/yishan-api/test/dashboard.service.test.ts` (mock Prisma, verify 4 counts called, verify Redis cache key/TTL)
- [ ] T032 [P] [US3] Create Vitest test for dashboard route + admin permission in `apps/yishan-api/test/app.dashboard.routes.test.ts` (build Fastify app, request with admin token → 200, non-admin token → 403, no token → 401)

### Mobile App API Client for User Story 3

- [ ] T033 [US3] Add `DashboardStats` interface to `apps/yishan-app/src/api/types.ts` (`userTotal: number; deptTotal: number; todayLogin: number; online: number`)
- [ ] T034 [US3] Create dashboard API client in `apps/yishan-app/src/api/dashboard.ts` (`dashboardApi.getStats: () => request.get<DashboardStats>('/api/v1/app/dashboard/stats')`)
- [ ] T035 [US3] Export `dashboardApi` from `apps/yishan-app/src/api/index.ts`

### Mobile App UI Components for User Story 3

- [ ] T036 [P] [US3] Create `DashboardHero` component in `apps/yishan-app/src/components/organisms/DashboardHero/index.tsx` + `DashboardHero.module.scss` (props: `{ user: User, dateText: string }`; renders 80-120px linear-gradient 135deg `#1677FF` → `#0958D9` band with `⛰` 32px white + 「移山」+ slogan, 32-36px `Hi, 姓名` with `--color-primary` + 600 weight name + 13-14px subtitle)
- [ ] T037 [P] [US3] Create `StatCard` component in `apps/yishan-app/src/components/organisms/StatCard/index.tsx` + `StatCard.module.scss` (props: `{ icon, value, label, onClick? }`; three-section: top 24×24 icon container with `--color-primary-bg` + `#1677FF` icon, middle 32-40px primary-color bold value, bottom 12-13px tertiary text label; 12-16px radius)
- [ ] T038 [P] [US3] Create `DashboardGrid` component in `apps/yishan-app/src/components/organisms/DashboardGrid/index.tsx` + `DashboardGrid.module.scss` (props: `{ stats, loading, error, onRetry }`; 2×2 grid of StatCard for users/depts/todayLogin/online; click → drill into routes)
- [ ] T039 [P] [US3] Create `DashboardSkeleton` component in `apps/yishan-app/src/components/feedback/DashboardSkeleton/index.tsx` + `DashboardSkeleton.module.scss` (4 placeholder cards with shimmer animation; render inside DashboardGrid when loading=true)
- [ ] T040 [US3] Export new components from `apps/yishan-app/src/components/organisms/index.ts` (DashboardHero, StatCard, DashboardGrid + types)
- [ ] T041 [US3] Export DashboardSkeleton from `apps/yishan-app/src/components/feedback/index.ts`

### Mobile App Page Rewrite for User Story 3

- [ ] T042 [US3] Rewrite home page `apps/yishan-app/src/pages/index/index.tsx` as dual-view dashboard: read `useAuthStore.user.roles`, render `<DashboardHero user={user} dateText={todayStr} />` always; if admin render `<DashboardGrid stats={stats} loading={loading} error={error} onRetry={refetch} />` with three-state logic; render recent login list (up to 5 entries) using `GET /api/v1/app/users/me/login-logs`; pull-to-refresh via Taro `onPullDownRefresh`
- [ ] T043 [US3] Wire up error retry on dashboard failure: catch error from `dashboardApi.getStats()`, set local error state, render "数据加载失败，点击重试" + retry button in `apps/yishan-app/src/pages/index/index.tsx`
- [ ] T044 [US3] Wire up click drill-down routes from stat cards to `/pages/system/user/index`, `/pages/system/dept/index`, `/pages/system/login-log/index` in `apps/yishan-app/src/components/organisms/DashboardGrid/index.tsx`
- [ ] T045 [US3] Verify home page section spacing uses `--space-4` to `--space-5` (16-20px) between DashboardHero, DashboardGrid, and recent-login list in `apps/yishan-app/src/pages/index/index.module.scss`

**Checkpoint**: Admin home shows 4 stat cards with live data; normal user home shows hero + recent logins; loading/error/empty three-state all work; pull-to-refresh works. US3 acceptance scenarios 1-11 pass.

---

## Phase 6: User Story 4: 我的页面最核心 3 项 (Priority: P1) 🎯 MVP

**Goal**: 我的页面仅展示个人信息 + 3 项核心菜单（个人资料、修改密码、登录日志）+ 底部「退出登录」卡片按钮。管理员额外显示「系统管理」入口。

**Independent Test**: 进入「我的」页面，验证只出现 3 项菜单 + 退出登录卡片；管理员额外看到「系统管理」入口；点击菜单路由到 PC 端已有等价页；点击退出弹出确认 Dialog。

### Implementation for User Story 4

- [ ] T046 [US4] Rewrite my page `apps/yishan-app/src/pages/mine/index.tsx` to render top profile card (avatar, name, dept, position) + 3 menu items (个人资料 → `/pages/profile/edit/index`, 修改密码 → `/pages/profile/password/index`, 登录日志 → `/pages/profile/login-log/index`) + bottom logout card button
- [ ] T047 [US4] Add admin-only「系统管理」entry card in my page (check `useAuthStore.user.roles` for `admin`/`super_admin`, link to `/pages/system/...` index) in `apps/yishan-app/src/pages/mine/index.tsx`
- [ ] T048 [US4] Add logout confirmation dialog (Taro `showModal`, on confirm: clear token via auth store, call `POST /api/v1/app/auth/logout`, navigate to `/pages/login/index`) in `apps/yishan-app/src/pages/mine/index.tsx`
- [ ] T049 [US4] Verify `navigationBarTitleText: '我的'` in `apps/yishan-app/src/pages/mine/index.config.ts` (system default nav bar)
- [ ] T050 [P] [US4] Add styles for 3 menu items + logout card (use `--color-primary` accent, `--radius-lg` 8-12px, `--space-4` padding) in `apps/yishan-app/src/pages/mine/index.module.scss`

**Checkpoint**: My page shows exactly 3 items + logout; admin sees extra system entry; navigation works. US4 acceptance scenarios 1-5 pass.

---

## Phase 7: User Story 7: 全局视觉与交互规范（微信小程序 + 标题栏 + 表单 + Icon） (Priority: P1) 🎯 MVP

**Goal**: 严格遵循微信小程序设计规范：子页系统默认导航栏、轻表单视口垂直居中、复杂表单顶部对齐、Icon 圆角线性 1.5-2px stroke + 主色淡色背景容器、跨页面基础元素 100% 一致。

**Independent Test**: 任意打开 5 个子页面（个人资料/修改密码/系统管理任意一个/任意详情页），验证标题栏统一白底黑字 + 返回箭头 + 标题居中；同一类元素跨页面像素级一致；icon 全为 1.5-2px 圆角线性风格。

### Icon Library for User Story 7

- [ ] T051 [P] [US7] Create 8-10 SVG icon files (home, apps, user, bell, settings, arrowRight, chevronRight, check, close, search) with 1.5-2px rounded stroke in `apps/yishan-app/src/components/icons/svg/*.svg` (24×24 viewBox, stroke-linecap round, stroke-linejoin round)
- [ ] T052 [US7] Create `IconFont.tsx` SVG-based component (accepts `name`, `size`, `color` props; imports SVG as React component via `import { ReactComponent as HomeIcon } from '../svg/home.svg'`; renders with currentColor) in `apps/yishan-app/src/components/icons/IconFont.tsx`
- [ ] T053 [US7] Update `apps/yishan-app/src/components/icons/icons.ts` to map IconName → SVG component (replace unicode chars from `ICONS` const; keep `ICONFONT_NAMES` for backward compat)
- [ ] T054 [US7] Update icon container style (24×24 wrapper with `--color-primary-bg` background, 8px radius) for stat cards / tab / menu items in `apps/yishan-app/src/components/icons/IconFont.module.scss`

### Subpage Standards for User Story 7

- [ ] T055 [P] [US7] Audit all subpage `index.config.ts` files in `apps/yishan-app/src/pages/**/*.config.ts` and confirm each has `navigationBarTitleText` (system default nav bar, no `navigationStyle: 'custom'`)
- [ ] T056 [US7] Verify complex form (e.g., `pages/system/user/edit/index.tsx`) is top-aligned (not vertical centered) with form fields starting below nav bar
- [ ] T057 [US7] Audit base components (button, Tag, list item, input) for consistent style across pages — fix any inline `hex/px/shadow` literals in `apps/yishan-app/src/components/{atoms,molecules,organisms}/**/*.module.scss` to use design tokens

**Checkpoint**: All subpages use system default nav bar; forms layout correctly per field count; all icons are rounded linear 1.5-2px stroke with consistent style. US7 acceptance scenarios 1-9 pass.

---

## Phase 8: User Story 5: 应用 Tab 复用（保持现状） (Priority: P2)

**Goal**: 应用 Tab 保持现有 `WorkbenchGrid` 渲染逻辑（从 API 拉菜单树 → 按目录分组渲染），本期不做视觉/功能升级。

**Independent Test**: 验证「应用」Tab 现有功能不受影响，菜单可正常点击跳转，三态（Loading/Error/Empty）正常。

### Verification for User Story 5

- [ ] T058 [US5] Verify `pages/apps/index.tsx` still uses `WorkbenchGrid` and `StateView` unchanged (read-only check; no code change)
- [ ] T059 [US5] Manually test apps tab in WeChat dev tools and H5: click each menu item, confirm route to corresponding page works; verify loading/error/empty three states via mocked network failure

**Checkpoint**: Apps tab functions identically to before, no regression. US5 acceptance scenarios 1-3 pass.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final lint, typecheck, test, and cross-end validation.

- [ ] T060 [P] Run `pnpm --filter yishan-app lint` and fix any Biome lint or `tsc --noEmit` errors in `apps/yishan-app/src/`
- [ ] T061 [P] Run `pnpm --filter yishan-admin lint` and fix any Biome lint or `tsc --noEmit` errors in `apps/yishan-admin/`
- [ ] T062 [P] Run `pnpm --filter yishan-api test` and verify all Vitest tests pass (including new `dashboard.service.test.ts` and `app.dashboard.routes.test.ts`)
- [ ] T063 [P] Run `pnpm --filter yishan-api db:generate` to refresh Prisma client (no schema changes expected, but verify) in `apps/yishan-api/prisma/`
- [ ] T064 Cross-end screenshot comparison: capture admin, app (H5 + WeChat dev tools), docs home; verify brand name (移山) + primary color (#1677FF) + logo (⛰) are consistent; app uses system default font
- [ ] T065 Verify TabBar floating capsule visual + 200ms transition in WeChat dev tools and H5
- [ ] T066 Verify dashboard data: admin user with seed data → 4 stat cards show real numbers; normal user → 4 cards hidden, only hero + recent logins
- [ ] T067 Verify dashboard failure: kill API or mock 500 → "数据加载失败，点击重试" + retry button works
- [ ] T068 Verify pull-to-refresh on dashboard: scroll down, see loading indicator, numbers update after API call
- [ ] T069 Performance check: dashboard P95 ≤ 500ms (cached ≤ 100ms) via DevTools network panel; cold start to interactive ≤ 2s
- [ ] T070 Run quickstart.md validation: walk through every acceptance item in `specs/002-app-ui-upgrade/quickstart.md` and tick off
- [ ] T071 [P] Update `apps/yishan-docs/docusaurus.config.ts` tagline to include brand slogan, deploy docs site

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2 = US1)**: Depends on Setup completion — BLOCKS all user stories (brand tokens must exist before any page work)
- **User Story 2 (Phase 3)**: Depends on Phase 2 — US1 brand tokens needed
- **User Story 6 (Phase 4)**: Depends on Phase 2 — US1 brand tokens needed
- **User Story 3 (Phase 5)**: Depends on Phase 2 + Phase 4 — US1 brand tokens + TabBar component
- **User Story 4 (Phase 6)**: Depends on Phase 2 — US1 brand tokens needed
- **User Story 7 (Phase 7)**: Depends on Phase 2 — icon library builds on design tokens
- **User Story 5 (Phase 8)**: Depends on Phase 1 only — verification only, no real implementation
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories (Foundational)
- **US2 (P1)**: Depends on US1 only — brand tokens
- **US6 (P1)**: Depends on US1 only — brand tokens
- **US3 (P1)**: Depends on US1 + US6 — uses TabBar and brand tokens
- **US4 (P1)**: Depends on US1 only — uses brand tokens
- **US7 (P1)**: Depends on US1 only — uses design tokens
- **US5 (P2)**: No dependencies — verification only

### Within Each User Story

- API schemas before service before route before tests
- API tests written and PASS after implementation
- Mobile types before API client before components before page
- Components before page integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001-T006)
- All Foundational tasks (US1) marked [P] can run in parallel within Phase 2
- T031 + T032 (Vitest tests) can be parallelized
- T036, T037, T038, T039 (4 dashboard components) can all be built in parallel
- T051 (10 SVG icons) can be created in parallel
- Once US1 completes, US2, US4, US6, US7 can proceed in parallel (different files, no code conflicts); US3 starts after US6
- T060, T061, T062 (lint/test) can run in parallel at the end

---

## Parallel Example: User Story 1 (Foundational)

```bash
# Launch all US1 config updates in parallel:
Task: "T008 [US1] Update admin antd theme token colorPrimary #1677FF in apps/yishan-admin/config/config.ts"
Task: "T009 [US1] Update admin default settings colorPrimary + title in apps/yishan-admin/config/defaultSettings.ts"
Task: "T010 [US1] Update docs brand config in apps/yishan-docs/docusaurus.config.ts"

# Launch all US1 SCSS work in parallel:
Task: "T007 [US1] Add gradient + shadow tokens to apps/yishan-app/src/styles/tokens.scss"
```

## Parallel Example: User Story 3 (Dashboard)

```bash
# Launch all dashboard component scaffolds in parallel (different files):
Task: "T036 [US3] Create DashboardHero component"
Task: "T037 [US3] Create StatCard component"
Task: "T038 [US3] Create DashboardGrid component"
Task: "T039 [US3] Create DashboardSkeleton component"

# Launch Vitest tests in parallel:
Task: "T031 [US3] Create Vitest test for dashboard service in apps/yishan-api/test/dashboard.service.test.ts"
Task: "T032 [US3] Create Vitest test for dashboard route in apps/yishan-api/test/app.dashboard.routes.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US6 + US3 + US4 + US7 — all P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational = US1 brand baseline (CRITICAL — blocks all stories)
3. Complete Phase 3: US2 login page brand
4. Complete Phase 4: US6 TabBar floating
5. Complete Phase 5: US3 dashboard (depends on US6)
6. Complete Phase 6: US4 my page
7. Complete Phase 7: US7 global guidelines
8. **STOP and VALIDATE**: Test all P1 stories independently
9. Deploy / demo

### Incremental Delivery

1. Setup + US1 (brand baseline) → Foundation ready, visual identity unified
2. Add US2 (login page) → Brand impression improved
3. Add US6 (TabBar) → Navigation interaction improved
4. Add US3 (dashboard) → "大气" home view achieved
5. Add US4 (my page) → Profile and key menus
6. Add US7 (global guidelines) → All subpages standardized
7. Verify US5 (apps tab no regression) → Final smoke test
8. Phase 9 Polish → Ship

### Parallel Team Strategy

With multiple developers:

1. Team completes Phase 1 (Setup) and Phase 2 (US1 brand baseline) together
2. Once US1 done:
   - Developer A: US2 login page + US4 my page (both pages)
   - Developer B: US6 TabBar + US3 dashboard (depends on US6)
   - Developer C: US7 icon library + global subpage standards
3. US5 verification can be done by anyone in parallel
4. Phase 9 lint/test/validate is team-wide

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests pass after implementing (Vitest for API; manual for app/admin/docs)
- Commit after each task or logical group (use `/speckit.git.commit` optional hook)
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
- Out of scope (per spec): dark mode, micro-animations, full Skeleton/Empty/Error three-state upgrade, address book, system management mobile optimization, theme switcher
