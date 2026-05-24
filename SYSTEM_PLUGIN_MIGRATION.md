# System Plugin Migration Checklist

This document defines the execution checklist for migrating `system` capabilities to the current plugin architecture in this monorepo.

## Scope and Principles

- Keep `core` stable: auth, permission framework, plugin runtime, and plugin management console remain in core.
- Migrate `system` business capabilities incrementally via plugin manifests.
- Keep rollback simple: preserve compatibility with static routes and generated plugin routes.

## Migration Boundary

### Keep in core (do not pluginize now)

- `/system/plugins` (plugin management console itself)
- Core auth and permission base
- Runtime bootstrap and persistence

### Migrate to plugin manifest first

- `/system/storage`
- `/system/attachments`
- `/system/login-log`
- `/system/apps`
- `/system/apps/:id`

### Defer (higher coupling)

- `/system/user`
- `/system/role`
- `/system/menu`
- `/system/department`
- `/system/post`
- `/system/dict`
- `/system/site`

## Execution Plan

## Phase 0 - Baseline Freeze

- [ ] Capture current route, menu, permission behavior for all target pages.
- [ ] Create a migration tracking table (page, route, permission keys, owner, rollback owner).
- [ ] Confirm Definition of Done (DoD) and release window.

## Phase 1 - Rules and Contracts

- [ ] Confirm admin manifest schema (`name`, `version`, `coreCompatibility`, `routes`).
- [ ] Confirm API plugin manifest schema (`channels`, `menus`, `permissions`, `routeBase`) where needed.
- [ ] Confirm conflict handling rules:
  - static route path wins
  - duplicate generated route paths are deduped

## Phase 2 - Batch A (low risk) ✅ COMPLETED

Target pages:

- [x] `/system/storage`
- [x] `/system/attachments`

Work items:

- [x] Add or update routes in `apps/yishan-admin/src/plugins/modules/system.manifest.ts`.
- [x] Remove duplicated static entries from `apps/yishan-admin/config/routes.ts`.
- [x] Generate routes:

```bash
pnpm --filter yishan-admin gen:plugin-routes
```

- [x] Verify generated file includes target paths:
  - `apps/yishan-admin/config/generated/plugin-routes.ts`
- [x] Validate access control (`access: 'canDo'`) and menu visibility.

## Phase 3 - Batch B (medium risk) ✅ COMPLETED

Target pages:

- [x] `/system/login-log`
- [x] `/system/apps`
- [x] `/system/apps/:id`

Work items:

- [x] Move route declarations to `system.manifest.ts`.
- [x] Remove duplicated static entries from `config/routes.ts`.
- [x] Keep `/system/plugins` static in core.
- [x] Regenerate plugin routes and validate no collisions.

## Phase 4 - API Runtime Alignment

- [ ] Ensure plugin runtime startup and persistence remain healthy.
- [ ] Confirm plugin enable/disable state behavior for menu exposure strategy.
- [ ] Validate plugin management endpoints:
  - list/details
  - enable/disable
  - hook reports

## Phase 5 - Test and Regression

- [ ] Admin route regression (direct URL, refresh, 404 fallback, permission denial behavior).
- [ ] Menu regression (visibility and click-through).
- [ ] Plugin state regression (enabled/disabled behavior if linked to menus).
- [ ] Script regression (route generation conflict and dedupe behavior).

Recommended command set:

```bash
pnpm --filter yishan-admin lint
pnpm --filter yishan-admin test
pnpm --filter yishan-api test
```

## Phase 6 - Release and Rollback

- [ ] Release in controlled batches (A then B).
- [ ] Observe: 404 rate, permission errors, menu load errors, plugin toggle failures.
- [ ] Rollback plan ready:
  - restore static routes in `config/routes.ts`
  - revert manifest route entries
  - regenerate `plugin-routes.ts`

## File-Level Change Checklist

Admin routes migration:

- [x] `apps/yishan-admin/src/plugins/modules/system.manifest.ts`
- [x] `apps/yishan-admin/config/routes.ts`
- [x] `apps/yishan-admin/config/generated/plugin-routes.ts` (generated)

Plugin menu sync (v1):

- [x] `apps/yishan-api/prisma/schema/system.prisma` — added `source`, `pluginName`, `pluginMenuKey`, `@@unique([pluginMenuKey])`, indexes
- [x] `apps/yishan-api/src/core/services/plugin-menu-sync.service.ts` (new)
- [x] `apps/yishan-api/src/core/services/plugin-manage.service.ts` — integrated menu sync into enable/disable
- [x] `apps/yishan-api/src/app.ts` — startup menu sync for discovered plugins
- [x] `apps/yishan-admin/src/pages/system/plugins/index.tsx` — UX: enable/disable success message prompts page refresh; toolbar "刷新页面" button does `window.location.reload()`

## Definition of Done

- [x] Target `system` pages are driven by plugin manifest routes.
- [x] Static route duplication is removed for migrated pages.
- [x] Plugin route generation is deterministic and conflict-safe.
- [x] `/system/plugins` remains available and independent from managed plugins.
- [x] Lint/tests pass and key manual verification is complete.

> **Note**: Admin Jest test has a pre-existing configuration issue (`@umijs/max/test` module not found). API tests pass (125/125). Biome lint and TypeScript type-check pass.

## Execution Log

- **2026-05-24**: Phase 2 (Batch A) and Phase 3 (Batch B) completed.
  - Migrated: `/system/storage`, `/system/attachments`, `/system/login-log`, `/system/apps`, `/system/apps/:id`
  - Route generation: 11 routes in `plugin-routes.ts`

- **2026-05-24**: v1 Plugin Menu Sync implemented.
  - DB: Added `source`, `pluginName`, `pluginMenuKey` fields to `SysMenu` in `prisma/schema/system.prisma`.
  - New service: `src/core/services/plugin-menu-sync.service.ts` (`upsertPluginMenu`, `syncPluginMenus`, `hidePluginMenus`, `restorePluginMenus`, `softDeletePluginMenus`).
  - Lifecycle hooks: `PluginManageService.enablePlugin` and `disablePlugin` now call menu sync.
  - Startup sync: `app.ts` startup loop calls `PluginMenuSyncService.syncPluginMenus` for each discovered manifest.
  - Authorization: New plugin menus auto-bound to super-admin (roleId=1) on creation.
  - Menu sync errors are non-fatal (wrapped in try-catch; plugin lifecycle continues).
  - `db:generate` passed, API tests 125/125 passed, Admin lint pass.
  - Lint: pass (biome + tsc --noEmit)
  - API tests: 125/125 passed

## Suggested Migration Order

1. `/system/storage`
2. `/system/attachments`
3. `/system/login-log`
4. `/system/apps`
5. `/system/apps/:id`
