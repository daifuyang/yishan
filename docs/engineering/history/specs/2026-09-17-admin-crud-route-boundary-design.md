# Admin CRUD Route Boundary

## Goal

Reduce repeated admin route plumbing without making `createCrudHandlers` a second router or a data-model-to-API generator.

## Boundary

`createCrudHandlers` owns only the four uniform resource actions:

- `list`: `GET /`, paginated response, list permission and list success message.
- `create`: `POST /`, create permission and success message.
- `update`: `PUT /:id`, update permission, ID parsing and success message.
- `delete`: `DELETE /:id`, delete permission, ID parsing and success message.

Each migrated route module declares and registers the four corresponding permissions at module load through `declareCrudPermissions`, then supplies that declaration to `createCrudHandlers` for route binding. The factory does not own detail lookup, trees, grants, uploads, streams, state transitions, or arbitrary HTTP methods.

`RouteRegistrar` remains the sole API for every non-standard endpoint. A custom route reuses an already declared CRUD permission when appropriate:

```ts
route.get('/:id', {
  access: { permission: crud.permissions.list },
  schema,
}, handler)
```

This preserves one route abstraction, prevents method-name collisions with `create`, `update`, and `delete`, and keeps domain-specific behavior visible in its module.

## Migration Scope

Migrate only the uniform CRUD portions of these admin resources:

- `users`: list, create, update, and delete. The callbacks retain the existing
  self-protection and super-admin protection checks.
- `menus`: list, create, update, and delete. ID validation remains in the
  configured ID parser.
- `roles`: list and delete only. Create and update remain on `route` because
  they require the additional `system:role:grant` permission.
- `dicts`: the types and data subresources each use the same factory instance
  for their list, create, update, and delete endpoints, with explicit paths.

Keep detail, tree, authorization, status, or other domain endpoints on `route`.

The following stay hand-written in this work:

- `attachments`: uploads, streaming, and batch lifecycle operations.
- `permissions`: catalog-only endpoint.
- `system/*`: configuration and operations APIs rather than resource CRUD.
- `enums`: its list response is an object containing `items`, `total`, `page`,
  and `pageSize`, rather than the factory's paginated-list response contract.

`positions` and `departments` serve as the established examples of the final boundary.

## Implementation Rules

- Preserve HTTP paths, operation IDs, OpenAPI schemas, permissions, response envelopes, localized messages, and business errors.
- Keep CRUD permission declarations at module load so import-only catalog consumers can discover them; route binding reuses the predeclared permission record.
- Each migrated resource declares one `crud` instance and uses `crud.permissions` for custom endpoints that share a standard action's permission.
- Use `@/` aliases for imports touched by the migration. The existing `tsc-alias` build step rewrites aliases in `dist`.
- Do not add custom-route APIs to `createCrudHandlers`.

## Verification

- Maintain or add focused route regression coverage for every migrated resource.
- Run the focused route tests and CRUD factory test after each migration.
- Run `pnpm --dir apps/yishan-api exec tsc --noEmit` and the API test suite before completion.
- Run `pnpm --dir apps/yishan-api run build:ts` once to confirm alias rewriting in emitted CommonJS output.
