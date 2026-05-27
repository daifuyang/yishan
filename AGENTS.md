# AGENTS.md — Yishan Monorepo

## Stack
- **Admin** (yishan-admin): Umi 4 + Ant Design Pro, React 19, Biome lint, Jest test
- **API** (yishan-api): Fastify 5, Prisma 7, TypeBox, JWT, `type: commonjs`
- **Docs** (yishan-docs): Docusaurus 3
- **Components** (yishan-tiptap): TipTap 3, Rollup, workspace dependency of admin

## Developer Commands

```bash
pnpm --filter yishan-admin dev        # Admin dev (MOCK=none by default)
pnpm --filter yishan-api dev          # API dev (build:ts + watch)
pnpm --filter yishan-admin lint       # biome:lint + tsc --noEmit
pnpm --filter yishan-admin test        # Jest
pnpm --filter yishan-api test          # Vitest
pnpm --filter yishan-tiptap build      # Must build before admin dev/build
```

## Build Order (critical for workspace dependency)
yishan-tiptap → yishan-admin → (for deploy) copy admin/dist → yishan-api

Admin `dist/` is copied to `yishan-api/public/admin/` before FC3 deployment. Do not assume admin is independently served.

## CI Order
1. `pnpm install --no-frozen-lockfile`
2. `pnpm --filter yishan-tiptap build`
3. `pnpm --filter yishan-admin lint`
4. `pnpm --filter yishan-admin build`
5. `pnpm --filter yishan-api db:generate`
6. `pnpm --filter yishan-api build:ts`
7. `pnpm --filter yishan-api test`

## FC3 Deployment (yishan-api/deploy/fc3/)
- Runtime: custom.debian12 with Node 22.14.0
- Pre-deploy: installs deps, prisma generate, build:ts, copies admin dist + .env to dist/
- Entrypoint: `node ./server.js` via customRuntimeConfig
- Admin static served from `public/admin/` inside the API package

## API Entry
Compiled to `dist/app.js` (commonjs). `dist/server.js` is the start script. Not `app.ts`.

## Lint Note
Admin uses Biome only (no ESLint/Prettier). Biome config: single quotes, reactClassic jsxRuntime.

## Prisma / DB
- Schema: `apps/yishan-api/prisma/schema/*.prisma`
- `db:seed` requires compiled output (`node dist/scripts/seed.js`)
- API `.env` is NOT in git; use `.env.example` as reference

## OpenAPI
Admin: `pnpm --filter yishan-admin openapi` generates types/services from the API spec.
