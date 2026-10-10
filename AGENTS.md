# Yishan Project Guide for AI Agents

> **业务优先，简单直接；就近组织，适度抽象。**
>
> **能用一层解决的问题，不增加第二层。**
>
> **不要为了架构而架构，不要为了复用而复用，不要为了规范而规范。**

This is a `pnpm` monorepo. Apply the rules for the app being changed; do not
force the admin frontend, API modules, mini-program, docs site, and shared
packages into one structure.

## Read First
Before modifying code, MUST read the target implementation and the closest
similar feature. Also check the API contract, existing types, and local tests
when they are relevant.

- Admin CRM: inspect `apps/demo/admin/src/modules/crm/`,
  `apps/demo/admin/src/services/crm.ts`, and existing drawer primitives.
- API business modules: inspect the module's `README.md`, `module.ts`, schema,
  route, service, repository, migration, and tests.
- Do not replace an established local pattern with a generic pattern from
  memory. Reuse an existing capability when it materially reduces work.
- Keep the diff limited to the requested behavior. Do not perform unrelated
  refactors, dependency upgrades, or design-system changes.

When an explicit breaking-change task exposes a wrong model, duplicate state,
or obsolete interface, correct the affected design rather than preserving the
mistake. Its scope is still limited to the requested business area.

## Repository Map
- `apps/demo/admin`: `@yishan/demo-admin`, Umi Max, React 19, Ant Design 6, Ant Design Pro; product configuration, composition and business UI.
- `apps/demo/api`: Fastify 5, Drizzle, TypeBox, JWT; business modules live
  under `src/modules/<id>/`.
- `apps/demo/app`: mini-program application. Follow its local conventions.
- `apps/demo/docs`: `@yishan/demo-docs`, Demo product documentation; `apps/portal/docs`: `@yishan/portal-docs`, platform developer documentation. Both consume `@yishan/docs-kit`; root `docs/` owns architecture, ADR and engineering governance.
- `packages/yishan-tiptap`: `@yishan/tiptap`, independent Rollup component package.
- `packages/core/app`: `@yishan/core-app`, injected Taro request/auth/storage/env/hooks.
- `packages/core/docs-kit`: `@yishan/docs-kit`, content-free shared Docusaurus configuration, theme and components.
- `packages/ui`: shared mobile components through `@yishan/ui/mobile`.
- `apps/demo/config`: source-only Demo product configuration, consumed by Demo Admin and its companion mini-program. Other products own their configuration; Core must not depend on it.
- `packages/core/admin`: public Admin runtime, module composition and Umi build plugin.
- `packages/core/system-admin`: system management pages and module contributions.

Use `pnpm`, honoring the pinned package manager and Node version in the root
configuration. Do not commit generated release artifacts.

## Admin and CRM

### Admin V2 Boundaries
Products own their Admin configuration, explicit module manifest, API clients
and business pages under `apps/<product>/admin`. Core Admin and System Admin
are source-only public packages: import only declared package exports, never
another package's relative/private/source path. Core does not depend on any
product; products do not import another product's internals. Shared runtime
capabilities receive product dependencies through the public composition API.
Backend runtime packages are not frontend dependencies.

The product manifest determines installed page contributions. Backend menus
select from the installed component registry; they do not install missing
frontend code. Preserve menu component keys, permission semantics and online
`/admin/` paths. Check `pnpm check:boundaries` after changing composition.

### Organization
Admin module pages are resolved from:

```text
apps/demo/admin/src/modules/<id>/pages/<page>/index.tsx
```

For CRM, keep business-specific UI near
`apps/demo/admin/src/modules/crm/`:

```text
pages/<business>/index.tsx       page composition
components/<business>/           business UI with local behavior
components/drawer/               customer/detail drawer system
domain/                          stable CRM status and business mappings
utils/                           small pure CRM helpers
```

SHOULD add files only when the feature needs them. Do not manufacture empty
`types.ts`, `constants.ts`, hooks, providers, or generic folders for symmetry.

The current CRM request types and API calls are in `@/services/crm.ts`; CRM's
uninstalled snapshot lives under `@/modules/crm/services/generated/` (`CrmAPI`).
Installed product clients live under `@/services/generated/` (`API`), and shared
System clients belong to `@yishan/core-system-admin` (`SystemAPI`). Do not add a
per-page `service.ts` merely to mirror a generic frontend convention. When an
API contract changes, regenerate the admin OpenAPI client and commit generated
client code and typings together.

### Pages and Lists
`index.tsx` SHOULD describe page composition: `PageContainer`, `ProTable`,
columns, filters, toolbar actions, and business component composition. Keep
modal form state and submit details inside the modal component.

- For standard lists, use the existing `ProTable` `request`, `columns`,
  `actionRef`, and `toolBarRender` pattern.
- Do not duplicate server data in local `dataSource` state when `request` can
  own it. After a successful mutation, use `actionRef.current?.reload()`.
- Prefer `valueEnum` for normal status columns and `valueType: 'dateTime'` for
  standard timestamps. Use `dayjs` for custom Chinese date-time formatting.
- Do not wrap a table-first page in `ProCard`. Do not pass an empty
  `header.breadcrumb` to `PageContainer`.
- Keep the action column consistent with the project: `valueType: 'option'`,
  right-fixed when needed, and compact action links.

### Forms, Modals, and Drawers
Default CRM interaction model:

```text
create / edit / simple operation -> ModalForm / ProForm
detail                         -> Drawer
complex detail                 -> Drawer or dedicated page
```

An `XxxFormModal` or existing save component MUST own its open/close state,
form instance, initialization, validation, submit loading, success notice,
reset, and failure handling. The parent supplies an entry point, necessary
business context, and completion callback. Avoid props that expose internal
state such as `open`, setters, `form`, and loading flags.

Combine create and edit into one business form when their flow is materially
the same. Use `initialValues` or `id` to choose the operation; do not maintain
near-identical create/edit forms.

Use vertical forms and straightforward `Row` / `Col` layout. CRM modal widths
normally fall around 640--760 px; choose a stable width suited to the fields,
not a percentage width. A modal is already a container: avoid nested cards,
decorative panels, heavy borders, and background blocks unless information
hierarchy genuinely requires them.

Forms collect only data required for the current action. MUST derive known
context such as current user, current customer, tenant, organization, or
default stage rather than asking the user to enter it again.

On failure, retain input, keep the modal open, and show a useful error. On
success, show feedback, close/reset the form, and refresh the server-backed
list or detail view.

### Existing CRM Primitives
Before extending CRM detail drawers, inspect
`components/drawer/_shared/`. Reuse its shared chrome, close/delete controls,
filter bar, status tag, z-index, and resize behavior where applicable. Keep
entity-specific visual content in the calling drawer or tab; do not turn every
small variation into a new global abstraction.

Keep the principal business chain understandable across pages and APIs:

```text
customer -> opportunity -> quotation -> contract -> payment -> fulfillment
```

Before adding a field or object, check its upstream entity and available
context. Do not collect duplicate business concepts without a clear source of
truth.

### UI and State
MUST use existing Ant Design and Pro Components for standard controls,
validation, pagination, loading, modal lifecycle, tables, selects, and dates.
The admin UI is restrained and information-first: use clear hierarchy and
normal whitespace; avoid decorative gradients, large rounded cards, excessive
shadow, nested cards, ornamental icons, and unrequested animation.

State priority is:

```text
component local state -> parent/child props -> business context -> global state
```

Do not introduce a store for state owned by one form, modal, or drawer. Do not
add `useMemo`, `useCallback`, or `memo` by default; use them only for a measured
cost or a real stable-reference requirement.

## API Business Modules
API modules have a deliberately different, enforced organization:

```text
routes/v1 -> services -> repositories -> db/schema
```

- Routes register endpoints, validate TypeBox schemas, enforce access, and
  shape HTTP responses. They MUST NOT import Drizzle tables or execute SQL.
- Services express business operations and coordinate repositories. They MUST
  NOT use the concrete `drizzleDb` instance directly.
- Repositories are the only module layer that imports the Drizzle schema or
  executes database queries. Preserve constructor/test injection patterns where
  the local service already uses them.
- Schemas own request/response validation and inferred API types. Permissions
  stay centralized in the module's existing permissions schema.
- Module tables MUST use the `<module-id>_` prefix. Modules do not alter
  `sys_*` Core tables, import each other, or join another module's tables.

Use the existing API module layout (`module.ts`, `db/schema.ts`, `drizzle/`,
`repositories/`, `services/`, `schemas/`, `routes/`, `tests/`, and optional
seed/menu configuration). Add a migration whenever a schema change requires
one; migrations are not automatically applied at application boot.

For API changes consumed by admin, preserve the end-to-end contract:

```text
TypeBox schema -> Fastify route -> OpenAPI -> generated admin client -> UI
```

## Types, Names, and Abstraction
MUST preserve strict, readable TypeScript in handwritten code. Prefer concrete
business names such as `OpportunityFormModal`, `CustomerDetail`,
`createOpportunity`, and `ContractStatus`.

- AVOID new `any` and `as any`. Generated code and legacy boundary exceptions
  exist; contain them locally, explain non-obvious reasons, and do not spread
  them through business code.
- AVOID type gymnastics. A business type should be understandable where it is
  opened; introduce complex generics or conditional types only for a concrete
  problem.
- Inline short one-use logic. Extract a function when it has substantial logic,
  repeat use, or clear business meaning.
- Abstract only after real repetition (normally two or three uses), a complex
  independent behavior, or a consistency requirement. An abstraction must make
  the business flow easier to understand.
- Use comments only for non-obvious business rules, compatibility constraints,
  or reasons. Do not narrate obvious code or add long AI-style commentary.

## Verification and Handoff
Run the narrowest relevant checks first, then expand for changes with broader
impact. Do not claim a command passed unless it was run successfully.

```bash
# Admin: formatting/lint and strict typecheck
pnpm --filter @yishan/demo-admin lint
pnpm typecheck:admin
pnpm --filter @yishan/demo-admin test
pnpm build:admin

# API
pnpm test:api
pnpm build:api

# Full repository gates when the task spans apps or changes shared behavior
pnpm lint
pnpm test
pnpm build
```

Run relevant focused Jest or Vitest tests when they exist. For new or changed
API contracts, run `pnpm --filter @yishan/demo-admin openapi` when appropriate and
verify the generated output. State plainly when a relevant test command is not
configured or could not be run.

Final task summaries MUST be concise: changed behavior, primary files,
compatibility impact, and actual verification results. Do not provide a long
development diary.

## Default Decision
For small choices, follow the closest existing code and proceed. Reconsider
architecture only when faced with real cross-module sharing, repeated behavior,
complex state, long-running asynchronous work, difficult permissions, a long
workflow, concurrency, performance evidence, or testing pain.

The purpose of these rules is to reduce maintenance-time cognitive load while
keeping business code close to the business it serves.

## Core App and mobile UI boundaries

`packages/core/app` / `@yishan/core-app` owns generic Taro request/session/storage/env/hooks. Each product injects its API methods, URLs, storage keys and navigation; Core never imports an app or a backend/Admin runtime. UI is exported by `@yishan/ui/mobile`, with original tokens/styles. Product pages, business services, module registration and navigation remain in the full App. Never capture the uninitialized Taro default object in a storage adapter; delegate to live API methods at call time.

Run `pnpm typecheck:mobile`, `pnpm --filter @yishan/demo-app test`, `pnpm build:app`, and H5/browser checks when shared mobile behavior changes. Root test/build now include App tests/weapp; H5, independent TipTap example and device validation remain separate. `pnpm check:boundaries` includes mobile public exports and dependency direction. Keep Core App private/source-first, client/store instances paired, HTTP 401 mandatory, and Demo legacy session keys unchanged. New products use `createSessionStorageKeys(productId)` and scoped auth clear/logout, never origin-wide storage.clear() for logout. Run `pnpm check:taro`; for editor distribution changes also run `pnpm verify:tiptap`. Detailed contracts: [Core App README](packages/core/app/README.md).
