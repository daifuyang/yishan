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
- `module.ts` exports `meta = { id, enabled? }` and a default `fastify-plugin` async function
- Current modules: `demo` (1 table, reference), `portal` (5 tables: categories/articles/pages/templates), `shop` (8 tables: categories/attributes/products/skus/orders)

### Lifecycle
1. **Boot scan** — `app.ts` calls `moduleLoader.scanDiskModules()`, reading `src/<id>/module.ts` (dev) or `dist/<id>/module.js` (prod)
2. **DB sync** — `syncModulesFromDisk` upserts each module into `sys_module` (`name`, `table_prefix`, `version`, `updated_at`). **`enabled` is never overwritten** — first sync uses `meta.enabled` (default `true`), subsequent runs preserve the runtime toggle.
3. **Mount** — `mountAllOnDisk` registers every on-disk module under prefix `/api/<id>` via `@fastify/autoload` on the module's `routes/` dir. This happens unconditionally — fastify's plugin tree is immutable after boot.
4. **Gate** — An `onRequest` hook on the root instance (registered before module routes) checks `sys_module.enabled` (with Redis cache + 5s in-process memo) and returns 404 for disabled modules. **This is how runtime enable/disable works — no hot-mount.**

### Hard invariants (enforced by `scripts/check-module-naming.mjs` + review)
- `meta.id` is globally unique; lower-case + digits + underscores; ≤ 24 chars. Duplicates fail-fast at boot.
- Route prefix is hardcoded to `/api/${id}` — modules don't declare it.
- Module **table names must start with `<id>_`** (e.g. `demo_documents`). Cross-module duplicate table names also fail lint.
- **Core never imports module source. Modules never import each other.** Modules join across their own tables only; cross-module reads go through HTTP or Core extensions.
- **Routes never import drizzle tables or write SQL directly.** Only `repositories/` may import the Drizzle schema and execute queries. Services orchestrate; routes validate and shape.
- Don't create `sys_*` tables in modules; don't modify existing `sys_*` Core tables.
- Frontend menu paths use `/<id>/...` at root — **no `/modules/` prefix** in URLs (the `/modules/` segment is only a source directory convention).
- Module enable/disable is the operator's decision; the `enabled` field is the source of truth, not `meta.enabled` after first sync.

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

## Tracking ongoing work

- `TODO.md` is the index of `TODO-*.md` files at the repo root for known follow-ups (e.g. `TODO-admin-routes-factory.md`, `TODO-attachment-select-split.md`, `TODO-architecture-doc-sync.md`).
- `TODO-architecture-doc-sync.md` tracks that `README.md` and `CONTRIBUTING.md` reference `AGENTS.md` / `ARCHITECTURE.md` that don't yet exist — content has been folded into `docs/module-onboarding.md` and this file. Treat those doc references as pointing here.
- `profiles/*.yaml` are module-catalog configs; consumed tooling emits to `artifacts/` (gitignored).

## Other things worth knowing

- **Profiles & release artifacts**: `profiles/core.yaml` / `official.yaml` / `template.yaml` drive a release pipeline that emits to `artifacts/` (gitignored). Don't commit outputs.
- **Module naming lint**: `scripts/check-module-naming.mjs` parses each module's `db/schema.ts` with regex; runs as part of `pnpm lint`. Add new tables here and the linter will catch missing `<id>_` prefixes.
- **Drizzle per-module**: each module ships its own `drizzle.config.ts` + `drizzle/0000_init.sql` + `drizzle/meta/{_journal,0000_snapshot}.json`. To regenerate migrations after schema changes, `cd src/modules/<id> && npx drizzle-kit generate --config=./drizzle.config.ts`. Migrations are not auto-applied at boot — operators run them via `pnpm --filter yishan-api db:migrate`.
- **FC deploy**: `.github/workflows/yishan-fc-migrate.yml` and `yishan-fullstack-cd-fc.yml` deploy to Alibaba Function Compute. `apps/yishan-api/deploy/` and `apps/yishan-api/dockerfile` cover the prod image build (which excludes devDeps).
- **Cert rotation**: `yishan-cert-rotate-fc.yml` rotates FC certs.
- **No real credentials in repo**: demo creds intentionally not committed; per README, request from the maintainer.
