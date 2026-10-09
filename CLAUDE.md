# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Yishan (移山通用管理系统) is a pnpm monorepo for a generic admin baseline used at zerocmf.com:

- `apps/yishan-admin` — React 19 + Ant Design Pro 6 + UmiJS 4 (`@umijs/max`) admin frontend
- `apps/demo/api` — Fastify 5 + Drizzle + TypeBox + JWT backend
- `apps/yishan-app` — WeChat mini-program (Taro/uni-app style, see `apps/yishan-app/`)
- `apps/yishan-docs` — Docusaurus 3 docs site
- `apps/yishan-components/yishan-tiptap` — shared TipTap 3 React component library (Rollup, CJS/ESM/types/css)
- `packages/shared-config` — monorepo-shared config constants (e.g. `API_TARGET`); source-only workspace package, no build step

Toolchain pinned in `.tool-versions` / root `package.json#packageManager`: Node 22.22.1, pnpm 8.15.9. Use asdf / mise / fnm to honor `.tool-versions` automatically.

## Common commands

All commands run from the repo root unless noted.

```bash
# Install
pnpm install

# Full build (API packages → tiptap → admin → docs)
pnpm build
# Equivalent to:
#   pnpm --filter yishan-tiptap build
#   pnpm --filter yishan-admin build
#   pnpm --filter yishan-docs build

# Per-app dev (run in separate terminals)
pnpm --filter yishan-tiptap build         # admin depends on built tiptap
pnpm --filter yishan-admin dev            # Umi dev server (port 8000 by default for preview)
pnpm dev:api              # TypeScript watch + Fastify auto-reload
pnpm --filter yishan-docs start           # Docusaurus dev

# Quality gate (matches CI)
pnpm lint      # admin (Biome + tsc) + docs (typecheck) + app + check-module-naming
pnpm test      # admin (Jest) + api (Vitest)

# Backend DB (Drizzle)
pnpm --filter @yishan/demo-api db:generate      # generate migrations from schema
pnpm --filter @yishan/demo-api db:migrate --dry-run # inspect only
pnpm --filter @yishan/demo-api db:migrate --apply   # explicit writes
pnpm --filter @yishan/demo-api db:seed          # explicit seed; build API first
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

### API-specific scripts (cd into `apps/demo/api`)
```bash
pnpm dev:api            # run from root; watch all Core + Demo sources
pnpm test               # vitest run
pnpm test:watch         # vitest watch
pnpm test:integration   # disposable local MySQL fixtures
pnpm build              # tsc + tsc-alias + resource copy
```

## Architecture: API V2

Read docs/architecture/api-v2.md, package-boundaries.md and database-ownership.md.
Demo owns configuration, a static manifest and product modules. Four public Core packages
provide contracts, connection/migration infrastructure, Fastify lifecycle and System services.
Imports have no connection/startup side effects. Resources, JWT settings, RBAC/catalog and
module caches belong to an explicitly created runtime. Scoped legacy facades throw without it.

Module definitions implement ApiModule with contractVersion 2, metadata, register, optional
dependencies and lifecycle/seed/migration contributions. Core validates and topologically sorts
them; it does not scan an app directory. Runtime traffic uses sys_module.enabled.
Routes → services → repositories → schema remains the business layer direction.
Only repositories execute SQL; modules cannot access private System repos or sys_* tables.
Public userDirectory and controlled user extensions support independent product profile tables.

## Architecture: admin / api / shared

- **Admin** uses Umi Max's `plugin.ts` to register Ant Design Pro blocks. `apps/yishan-admin/config/routes.ts` is intentionally lean — menu structure is **driven by backend `sys_menu.component`** (post July 2026 refactor; see root `TODO.md`).
- **Admin module pages** live under `apps/yishan-admin/src/modules/<id>/pages/<page>/index.tsx`. `plugin.ts` scans this directory at build time and generates `moduleComponentsMap` (key `./modules/<id>/<page>` → `@/modules/<id>/pages/<page>`). The `component` field in menu JSON must use this exact `./modules/<id>/<page>` form.
- **OpenAPI sync**: `pnpm --filter yishan-admin openapi` regenerates `src/services/generated/<module>.ts` from `apps/demo/api/openapi.json`. The generated `typings.d.ts` (committed) provides the `API.*Params` ambient namespace. **Both files must be committed together** for fresh checkouts to compile. The backend also serves Swagger UI live at `/api/docs`.
- **JWT secret gate**: production refuses to boot with a default/weak `JWT_SECRET` (see System API `src/core/plugins/external/jwt-secret-validator.ts`). Dev/CI only warn.
- **Auth bypass codes**: `BYPASS_CODES` in admin allows local testing of specific routes; `auth:logout` was removed (bugfix in July 2026) — don't add it back.
- **TipTap**: builds to `dist/` with both CJS and ESM; admin imports it as `workspace:^` and **must rebuild tiptap after tipTap source changes** before re-running admin.

## Quality gate before commit

Per `CONTRIBUTING.md` and CI (`.github/workflows/yishan-fullstack-ci.yml`):

1. Run the lint/test/build for the apps you touched (root `pnpm lint`, `pnpm test`, `pnpm build`).
2. Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Husky + lint-staged are wired in `yishan-admin`.
3. Architecture-affecting changes must update root docs (TODO files, README, this file).
4. Don't stage scratch/plan docs in `tmp/` — they're gitignored.

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

### CRM drawer 共享原子

`apps/yishan-admin/src/modules/crm/components/drawer/_shared/` 下放线索 / 客户两个 drawer
的共享 UI 原子。新建 drawer 或扩展现有 drawer 时**先查这里**，避免重写：

| 原子 | 职责 |
|---|---|
| `DrawerChrome.tsx` | antd `<Drawer>` 统一外壳（resizable + destroyOnClose + closable=false） |
| `useResizableDrawer.ts` | size state hook + clamp（`MIN_DRAWER_SIZE=1100`） |
| `DrawerCloseButton.tsx` | 右上角 × text icon button |
| `DrawerNewWindowButton.tsx` | 右上角 ↗ 新窗口 button |
| `DrawerMetaRow.tsx` | 标题下分隔线 join 的二级元数据行 |
| `DrawerStatusTag.tsx` | status → antd Tag color 映射 |
| `DrawerFilterBar.tsx` | filter 按钮组 + 可选 DateRange Popover |
| `DrawerDeletePopconfirm.tsx` | 删除 Popconfirm 包装（线索 / 客户共用） |
| `groupByDate.ts` | 按日期分组的纯函数（今天 / 昨天 / YYYY年MM月DD日） |
| `crmDialogZIndex.ts` | `CRM_DIALOG_Z_INDEX=1200`（弹窗在抽屉里的统一 z 基准） |

调用方保留各自的视觉差异（线索 vs 客户的 Activity Timeline、tag 块、metric 卡），
仅复用以上原子保证交互模式一致。

跨页打开客户 Drawer：navigate 到 `/crm/customers?customerId=N`，`useCustomerDrawer` 会
自动打开。新建客户 / 编辑全屏模式尚未实现，Phase 3 接入 `customer-edit` 路由后接入。

## Tracking ongoing work

- `TODO.md` is the index of current follow-ups. Completed or obsolete TODO records live under `docs/archive/todos/`.
- The former architecture-doc-sync TODO is archived: `ARCHITECTURE.md` is superseded by docs/architecture/; AGENTS.md contains current engineering rules, and the relevant guidance is in `docs/module-onboarding.md` and this file.

## Other things worth knowing

- **Module naming lint**: `scripts/check-module-naming.mjs` parses each module's `db/schema.ts` with regex; runs as part of `pnpm lint`. Add new tables here and the linter will catch missing `<id>_` prefixes.
- **Drizzle per-module**: each module ships its own `drizzle.config.ts` + `drizzle/0000_init.sql` + `drizzle/meta/{_journal,0000_snapshot}.json`. To regenerate migrations after schema changes, `cd src/modules/<id> && npx drizzle-kit generate --config=./drizzle.config.ts`. Migrations are not auto-applied at boot — operators run them via `pnpm --filter @yishan/demo-api db:migrate`.
- **FC deploy**: `.github/workflows/yishan-fc-migrate.yml` and `yishan-fullstack-cd-fc.yml` deploy to Alibaba Function Compute. `apps/demo/api/deploy/` and `apps/demo/api/dockerfile` cover the prod image build (which excludes devDeps).
- **Cert rotation**: `yishan-cert-rotate-fc.yml` rotates FC certs.
- **No real credentials in repo**: demo creds intentionally not committed; per README, request from the maintainer.
- **sys_region seed data**: 省市区三级（~3400 条）由 `sys_region` 表承载，数据源是 modood/Administrative-divisions-of-China 的 `pca-code.json`，嵌在 `packages/core/system-api/src/scripts/seed/config/`。`pnpm --filter @yishan/demo-api db:seed` 自动跑 `system-region.ts` 把数据灌进 MySQL（INSERT ... ON DUPLICATE KEY UPDATE，幂等）。前端复用 `<ProFormRegionCascader name="area" />` 即可拿到三段级联选择器，无需另写 service。

## Cross-app config: `API_TARGET`

`packages/shared-config` 导出 `API_TARGET`（后端 base URL），admin 的 `config/proxy.ts`、app 的 `config/dev.ts` 和 `config/index.ts` 统一从这里 import。默认 `http://localhost:3100`，与 `apps/demo/api/.env` 的 `PORT` 对齐。

- 改后端端口：同步 `apps/demo/api/.env` 的 `PORT` 和 `packages/shared-config/src/index.ts` 的 `DEFAULT_API_TARGET`
- 需要指向非默认 host/port：设 `YISHAN_API_TARGET=http://host:port`（完整 URL 最高优先级）
- **禁止** 在 admin/app 的 config 里再次硬编码默认 URL——统一走 `API_TARGET`
