# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Yishan (移山通用管理系统) is a pnpm monorepo for a generic admin baseline used at zerocmf.com:

- `apps/yishan-admin` — React 19 + Ant Design Pro 6 + UmiJS 4 (`@umijs/max`) admin frontend
- `apps/yishan-api` — Fastify 5 + Drizzle + TypeBox + JWT backend
- `apps/yishan-app` — WeChat mini-program (Taro/uni-app style, see `apps/yishan-app/`)
- `apps/yishan-docs` — Docusaurus 3 docs site
- `apps/yishan-components/yishan-tiptap` — shared TipTap 3 React component library (Rollup, CJS/ESM/types/css)

Toolchain pinned in `.tool-versions` / root `package.json#packageManager`: Node 22.22.1, pnpm 8.15.9. Use asdf / mise / fnm to honor `.tool-versions` automatically.

## Common commands

All commands run from the repo root unless noted.

```bash
# Install
pnpm install

# Full build (order matters: tiptap → admin → docs)
pnpm build
# Equivalent to:
#   pnpm --filter yishan-tiptap build
#   pnpm --filter yishan-admin build
#   pnpm --filter yishan-docs build

# Per-app dev (run in separate terminals)
pnpm --filter yishan-tiptap build         # admin depends on built tiptap
pnpm --filter yishan-admin dev            # Umi dev server (port 8000 by default for preview)
pnpm --filter yishan-api dev              # TypeScript watch + Fastify auto-reload
pnpm --filter yishan-docs start           # Docusaurus dev

# Quality gate (matches CI)
pnpm lint      # admin (Biome + tsc) + docs (typecheck) + app + check-module-naming
pnpm test      # admin (Jest) + api (Vitest)

# Backend DB (Drizzle)
pnpm --filter yishan-api db:generate      # generate migrations from schema
pnpm --filter yishan-api db:migrate       # apply migrations
pnpm --filter yishan-api db:seed          # run seed scripts (builds TS first)
pnpm --filter yishan-api db:reset         # rebuild DB
```

### Admin-specific scripts (cd into `apps/yishan-admin`)
```bash
pnpm start              # alias for start:dev (UMI_ENV=dev, MOCK=none)
pnpm openapi            # regenerate API client from backend OpenAPI
pnpm test               # Jest
pnpm test:update        # update snapshots
pnpm test:coverage      # with coverage
pnpm analyze            # production build with bundle analyzer
pnpm preview            # build + serve on :8000
```
The `lint` script runs `max setup` (via `prelint`) then Biome + `tsc --noEmit`. Jest needs `.umi/` artifacts — `max setup` must run first; CI does this explicitly.

### API-specific scripts (cd into `apps/yishan-api`)
```bash
pnpm dev                # TS watch + fastify-cli start with watch
pnpm test               # vitest run
pnpm test:watch         # vitest watch
pnpm test:integration   # vitest run test/integration
pnpm build:ts           # build: gen-tsconfig + tsc + tsc-alias
```

## Architecture: the module system

The most distinctive thing in this repo is the business-module plugin system in `apps/yishan-api`. Read `apps/yishan-api/src/core/module-loader/module-loader.ts` and `apps/yishan-api/src/app.ts` for the full picture; `docs/module-onboarding.md` is the developer onboarding guide.

### Layout
- Each business capability lives at `apps/yishan-api/src/modules/<id>/`
- A module owns: `module.ts` (entry), `db/schema.ts` (Drizzle tables), `drizzle.config.ts`, `drizzle/0000_init.sql` + `drizzle/meta/{_journal,0000_snapshot}.json`, `repositories/`, `services/`, `schemas/`, `routes/`, `tests/`, `config/system-menu.json`, `permissions.ts`, optional `seed.ts`
- `module.ts` exports `meta = { id, enabled? }`. `enabled` is the pack/load switch (false → skip mount). Traffic uses `sys_module.enabled`.
- Current modules: `demo` (1 table, reference), `portal` (5 tables: categories/articles/pages/templates), `shop` (8 tables: categories/attributes/products/skus/orders)

### Lifecycle
1. **Boot scan** — `scanDiskModules()` reads each `module.ts` / `module.js`. `meta.enabled === false` modules are skipped (not synced, not mounted).
2. **DB sync** — upsert packed modules into `sys_module` (`name`, `table_prefix`, `version`). First insert sets traffic `enabled = 1`. Existing `enabled` is never overwritten.
3. **Mount** — `@fastify/autoload` registers packed modules' `routes/` under `/api/<id>`.
4. **Gate** — root `onRequest` checks `sys_module.enabled` (Redis + 1s memo) and returns 404 for traffic-disabled modules.

### Hard invariants (enforced by `scripts/check-module-naming.mjs` + review)
- `meta.id` is globally unique; lower-case + digits + underscores; ≤ 24 chars. Duplicates fail-fast at boot.
- Route prefix is hardcoded to `/api/${id}` — modules don't declare it.
- Module **table names must start with `<id>_`** (e.g. `demo_documents`). Cross-module duplicate table names also fail lint.
- **Core never imports module source. Modules never import each other.** Modules join across their own tables only; cross-module reads go through HTTP or Core extensions.
- **Routes never import drizzle tables or write SQL directly.** Only `repositories/` may import the Drizzle schema and execute queries. Services orchestrate; routes validate and shape.
- Don't create `sys_*` tables in modules; don't modify existing `sys_*` Core tables.
- Frontend menu paths use `/<id>/...` at root — **no `/modules/` prefix** in URLs (the `/modules/` segment is only a source directory convention).
- Pack/load: `meta.enabled` in `module.ts` (redeploy to change). Traffic: `sys_module.enabled` (toggle, no restart).

### Module enable/disable UX
Dev-only routes under `core/routes/_dev/` (mounted only when `NODE_ENV !== 'production'`) drive the runtime toggle and invalidate Redis cache + in-process memo. Production hides these routes and they ship without devDeps (`deploy/fc3/scripts/build-runtime-layer.sh` strips them).

## Architecture: admin / api / shared

- **Admin** uses Umi Max's `plugin.ts` to register Ant Design Pro blocks. `apps/yishan-admin/config/routes.ts` is intentionally lean — menu structure is **driven by backend `sys_menu.component`** (post July 2026 refactor; see root `TODO.md`).
- **Admin module pages** live under `apps/yishan-admin/src/modules/<id>/pages/<page>/index.tsx`. `plugin.ts` scans this directory at build time and generates `moduleComponentsMap` (key `./modules/<id>/<page>` → `@/modules/<id>/pages/<page>`). The `component` field in menu JSON must use this exact `./modules/<id>/<page>` form.
- **OpenAPI sync**: `pnpm --filter yishan-admin openapi` regenerates `src/services/generated/<module>.ts` from `apps/yishan-api/openapi.json`. The generated `typings.d.ts` (committed) provides the `API.*Params` ambient namespace. **Both files must be committed together** for fresh checkouts to compile. The backend also serves Swagger UI live at `/api/docs`.
- **JWT secret gate**: production refuses to boot with a default/weak `JWT_SECRET` (see `core/plugins/external/jwt-secret-validator.ts`). Dev/CI only warn.
- **Auth bypass codes**: `BYPASS_CODES` in admin allows local testing of specific routes; `auth:logout` was removed (bugfix in July 2026) — don't add it back.
- **TipTap**: builds to `dist/` with both CJS and ESM; admin imports it as `workspace:^` and **must rebuild tiptap after tipTap source changes** before re-running admin.

## Quality gate before commit

Per `CONTRIBUTING.md` and CI (`.github/workflows/yishan-fullstack-ci.yml`):

1. Run the lint/test/build for the apps you touched (root `pnpm lint`, `pnpm test`, `pnpm build`).
2. Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Husky + lint-staged are wired in `yishan-admin`.
3. Architecture-affecting changes must update root docs (TODO files, README, this file).
4. Don't stage scratch/plan docs in `tmp/` — they're gitignored.

Gates added in P1-A (`docs/verification/yishan-source-first-p1a/`):
- `pnpm check:toolchain` — Node/pnpm must match `.tool-versions` (machine default may be Node 24).
- `pnpm build` now includes the API (`build:ts`) and the App (`build:weapp`).
- `pnpm lint` runs `typecheck:baseline` (App and TipTap `tsc` ratchet against `scripts/baselines/tsc/*.json`: new errors fail, fixed errors must be removed from the baseline) and `check:boundaries` (`scripts/baselines/architecture-boundaries.json`: Core must not import or name business modules; new violations fail).
- `pnpm check:openapi <runtime.json>` compares the committed `apps/yishan-api/openapi.json` with a runtime dump (`apps/yishan-api/scripts/dump-openapi-from-build.mjs`); `scripts/openapi-diff.mjs` classifies every change and only accepts entries listed in `scripts/baselines/openapi-allowed-changes.json`.
- `pnpm test:integration` needs a disposable MySQL/Redis (`apps/yishan-api/test/integration/README.md`). Known migration defect R-01 is tracked there as `it.fails`; do not delete it — fix the mechanism in P4.

## Frontend page conventions (admin / Ant Design Pro 6)

These rules were hardened while iterating the `demo` module pages (`/demo/quickstart`, `/demo/health`, `/demo/todos`). New module pages should follow them by default.

### `PageContainer` header
- **Don't pass `header.breadcrumb: {}`**. `PageContainer` generates the route breadcrumb automatically; passing an empty object explicitly disables it and the page loses its breadcrumb. `system/user` is the reference — it omits `breadcrumb` entirely.
- **Avoid `header.subTitle`** unless the page genuinely needs a subtitle under the title (e.g. a doc-style landing page). For typical list/detail pages the title alone is enough; over-explaining in the header eats vertical space.
- Prefer placing action buttons in `ProTable.toolBarRender` (right side, consistent with `system/user`) rather than `PageContainer.extra`. Reserve `extra` for page-level actions outside any table.

### `ProTable` usage
- **Don't wrap `ProTable` in `ProCard`** when the page is fundamentally a table — `ProTable` already provides its own card chrome, header bar, search form, and toolbar. Wrapping it hides the layered structure (`headerTitle` + `search` + `toolbar` + `table`) and breaks visual parity with `system/user`.
- Set `headerTitle` to give the table a title (e.g. `"用户列表"` / `"Todo 列表"`).
- For status columns, prefer `valueEnum` (or `valueType: 'select'` + `fieldProps.options`) and let ProTable render the badge — don't hand-write `render: (_, r) => <Tag>...`. Hand-written renders add vertical padding and look out of place next to the system table.
- For date/time columns use `valueType: 'dateTime'`. If a non-default format is genuinely needed, keep `width` aligned with neighbouring date columns and see "Time formatting" below.
- Operation column: `dataIndex: 'option'`, `valueType: 'option'`, `fixed: 'right'`, `width: 160`, and wrap the action links in `<Space size={16}>` using `<a>` (not `<Button type="link">`). Match the `system/user` reference exactly.

### Time formatting
- Use `dayjs` (already in `apps/yishan-admin/package.json` dependencies, used by `system/user` and `account/center`). It's the project-standard formatter.
- For CN-locale pages, format with `dayjs(value).format('YYYY-MM-DD HH:mm:ss')`. dayjs defaults to the runtime's local timezone, which matches the user's expectation in CN deployments. Avoid `toLocaleString()` (browser default) and the raw `Intl.DateTimeFormat` boilerplate.
- `valueType: 'dateTime'` columns don't need any of the above — let ProTable render.

## Tracking ongoing work

- `TODO.md` is the index of `TODO-*.md` files at the repo root for known follow-ups (e.g. `TODO-admin-routes-factory.md`, `TODO-attachment-select-split.md`, `TODO-architecture-doc-sync.md`).
- `TODO-architecture-doc-sync.md` tracks that `README.md` and `CONTRIBUTING.md` reference `AGENTS.md` / `ARCHITECTURE.md` that don't yet exist — content has been folded into `docs/module-onboarding.md` and this file. Treat those doc references as pointing here.

## Other things worth knowing

- **Module naming lint**: `scripts/check-module-naming.mjs` parses each module's `db/schema.ts` with regex; runs as part of `pnpm lint`. Add new tables here and the linter will catch missing `<id>_` prefixes.
- **Drizzle per-module**: each module ships its own `drizzle.config.ts` + `drizzle/0000_init.sql` + `drizzle/meta/{_journal,0000_snapshot}.json`. To regenerate migrations after schema changes, `cd src/modules/<id> && npx drizzle-kit generate --config=./drizzle.config.ts`. Migrations are not auto-applied at boot — operators run them via `pnpm --filter yishan-api db:migrate`.
- **FC deploy**: `.github/workflows/yishan-fc-migrate.yml` and `yishan-fullstack-cd-fc.yml` deploy to Alibaba Function Compute. `apps/yishan-api/deploy/` and `apps/yishan-api/dockerfile` cover the prod image build (which excludes devDeps).
- **Cert rotation**: `yishan-cert-rotate-fc.yml` rotates FC certs.
- **No real credentials in repo**: demo creds intentionally not committed; per README, request from the maintainer.
- **sys_region seed data**: 省市区三级（~3400 条）由 `sys_region` 表承载，数据源是 modood/Administrative-divisions-of-China 的 `pca-code.json`，嵌在 `apps/yishan-api/src/scripts/seed/config/`。`pnpm --filter yishan-api db:seed` 自动跑 `system-region.ts` 把数据灌进 MySQL（INSERT ... ON DUPLICATE KEY UPDATE，幂等）。前端复用 `<ProFormRegionCascader name="area" />` 即可拿到三段级联选择器，无需另写 service。
