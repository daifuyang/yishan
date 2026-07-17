# Yishan Constitution

## Core Principles

### I. Contract-First API Design

API request and response schemas are the public contract. TypeBox schemas, route declarations, OpenAPI output, generated admin services, and implementation behavior must agree. Contract changes require matching documentation and generated-client updates.

### II. Explicit Boundary Mapping

External API names, database column names, and TypeScript/Drizzle property names are separate representations. Public JSON fields and query parameters use lower camel case; MySQL columns use snake case; TypeScript/Drizzle properties use lower camel case. Code crossing these boundaries must map fields explicitly; it must not use external input as an ORM property name or SQL identifier.

For example, an API `sortBy=sortOrder` must be mapped to the Drizzle column reference `table.sortOrder` through a fixed allowlist, while Drizzle maps that property to the MySQL `sort_order` column.

### III. Safe Dynamic Queries

Any dynamic filter, sort, projection, or update field must be selected from a closed, typed allowlist of ORM column references. Never interpolate client-provided field names into SQL or access a Drizzle table object with an unchecked request string. Unknown values must be rejected by the request schema or handled with a safe default.

### IV. Regression Coverage at the Persistence Boundary

Route tests that mock services do not replace model-level tests. Any query with runtime-selectable fields must have coverage for its default and every supported public value, including the API-to-ORM name mapping.

### V. Documentation Stays Executable

Documentation must describe the active stack and runnable contracts. Database guidance uses Drizzle and checked-in SQL migrations; API examples use the published OpenAPI names, not internal implementation names.

### VI. Single-Source List Queries

List-query implementations must keep shared query shape in one place. When paginated and unpaginated branches differ only by `limit/offset`, define the common Drizzle query config or builder once and conditionally apply pagination. Do not duplicate full `findMany()` or `select()` branches just to switch between `pageSize === 0` and paginated mode.

### VII. Release-Time Plugin Composition

Business plugins are compiled and delivered as part of a release artifact; they are not production runtime code uploads. `main` is the plugin-free Core baseline, while `all` is the full official-plugin distribution and the only branch that triggers CD. Plugin code, Admin assets, migrations, permissions, menus, seed data, and tests must be independently identifiable so a release can include or strip a plugin as a unit.

The runtime may enable or disable a plugin that is already present in the deployed artifact, and may synchronize its menus and permission catalog. It must not load arbitrary TypeScript/JavaScript, execute unreviewed migrations, or alter the deployed plugin set in production. Adding, removing, or upgrading plugin code requires a build, verification, deployment, and process restart/rollout.

`main` and `all` have a one-way synchronization contract: Core changes land in `main` first, then `main` is merged into `all`; `all` must never be merged back into `main`. Business-plugin changes land only in `all`. `all` must contain the current `main` tip before it can be released. CI verifies both Core and full-plugin distributions independently.

## Engineering Constraints

- SQL migrations in `apps/yishan-api/drizzle/` are the DDL source of truth. Generated Drizzle schema files are not edited manually.
- Consumers use `drizzleDb` from `@/db`; reads use Drizzle query/select APIs and writes use Drizzle insert/update/delete APIs.
- API list endpoints expose `page`, `pageSize`, `sortBy`, and `sortOrder` only when their schemas, query implementation, and OpenAPI documentation agree. `sortBy` values use public lower-camel-case field names, never database column names.
- Optional pagination must be applied as a delta on top of a shared base query/config. Reviews should reject duplicated paginated/unpaginated query branches when the only change is `limit/offset`.
- Core code must not import a concrete business-plugin implementation. A plugin owns its manifest, backend/frontend implementation, migrations, permissions, menus, seed data, and tests; Core owns the plugin runtime and `/system/plugins` control plane.
- Plugin data removal is an explicit, audited migration operation. Disabling or stripping a plugin from a release must not implicitly delete its persisted business data.
- `main` may contain only plugin-platform code (runtime, contracts, migration/build composition, and control plane); it must not contain concrete business-plugin implementations or their generated business schema.

## Development Workflow

1. Define or update the TypeBox request/response schema first.
2. Add explicit boundary mappings in the model/service for every externally named field.
3. Add regression tests for default behavior and each supported dynamic field.
4. Build the API and regenerate admin OpenAPI services when the public contract changes.
5. Update the relevant Docusaurus module or API document when a convention or endpoint behavior changes.
6. When introducing or refactoring list queries, prefer a single shared Drizzle query/config plus conditional pagination over duplicated branches.
7. For a plugin change, update the plugin-owned manifest, migrations, permissions, menus, seed data, Admin assets, and tests together; verify both the intended distribution (`all` or a stripped edition) and the Core boundary.

## Governance

This constitution supersedes local implementation preferences for API contract, boundary-mapping, and dynamic-query decisions. Amendments must update this document and affected developer documentation in the same change. Reviews must verify that public field names cannot be used as unchecked ORM or SQL identifiers.

**Version**: 1.4.0 | **Ratified**: 2026-07-12 | **Last Amended**: 2026-07-17
