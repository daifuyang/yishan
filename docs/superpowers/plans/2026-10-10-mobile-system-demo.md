# Mobile system and demo implementation plan

> **For agentic workers:** Use subagent-driven-development. Work in the existing checkout, preserve all pre-existing changes, and do not commit unrelated files.

**Goal:** Replace system placeholders with working mobile management flows and expose all four installed demo pages.

**Architecture:** Product-owned Taro pages use the existing authenticated request client and server permissions. Reuse FormField, feedback and layout components; share only repeated page chrome and controls. Keep Web and API semantics intact.

**Spec:** The approved mobile mapping in this conversation, narrowed by the user to system and demo modules.

## Constraints
- No CRM/shop/portal implementation, dependency changes or backend redesign.
- Read Web implementation and API schemas before each corresponding mobile flow.
- Real queries, pagination, visible actions, input retention on failure, permission checks, submission locks, and useful error feedback.
- No new any/as any; do not show implementation instructions as product UI.
- All existing workspace edits are preserved. Current branch is `all`; no branch/commit/push requested.

## Tasks
- [x] Shared mobile page controls: `apps/demo/app/src/pages/system/_shared/AdminUI.tsx` and stylesheet. Reuse current atoms/molecules; provide page header, picker, feedback and content layout.
- [x] Organization/dictionaries/logs: department list/detail/CRUD/member context, dictionary types/items CRUD, login-log query/detail/delete if supported. Own corresponding pages/API files and focused tests.
- [x] Authorization: role CRUD and existing grants/data scopes, position CRUD, menu CRUD and workbench group/entry management. Own corresponding pages/API files and focused tests.
- [x] Configuration/resources: region, site, storage, attachments, module-management. Implement supported Web operations with typed API contracts. Own corresponding pages/API files and focused tests.
- [x] Demo: quickstart, real health check, todo CRUD/toggle and region cascading selection. Register installed demo entries and new system pages centrally.
- [x] Review and integrate: verify route/permission mapping, stale requests, failure recovery, pagination, system-default protections, and cross-platform controls.
- [x] Verify: App tests, mobile typecheck, App lint, boundaries, Taro consistency, weapp build, H5 build and browser checks. Report unavailable live-server/device validation honestly.

## Verification method
Write focused tests for request contracts and nontrivial business transformations first, run and observe failures, then implement and re-run. Existing App suite baseline: 81 passing tests. Use `pnpm --filter @yishan/demo-app test`, `pnpm typecheck:mobile`, `pnpm --filter @yishan/demo-app lint`, `pnpm check:boundaries`, `pnpm check:taro`, `pnpm build:app`, and `pnpm --filter @yishan/demo-app build:h5`.
