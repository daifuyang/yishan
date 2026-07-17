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

## Engineering Constraints

- SQL migrations in `apps/yishan-api/drizzle/` are the DDL source of truth. Generated Drizzle schema files are not edited manually.
- Consumers use `drizzleDb` from `@/db`; reads use Drizzle query/select APIs and writes use Drizzle insert/update/delete APIs.
- API list endpoints expose `page`, `pageSize`, `sortBy`, and `sortOrder` only when their schemas, query implementation, and OpenAPI documentation agree. `sortBy` values use public lower-camel-case field names, never database column names.
- Optional pagination must be applied as a delta on top of a shared base query/config. Reviews should reject duplicated paginated/unpaginated query branches when the only change is `limit/offset`.

## Development Workflow

1. Define or update the TypeBox request/response schema first.
2. Add explicit boundary mappings in the model/service for every externally named field.
3. Add regression tests for default behavior and each supported dynamic field.
4. Build the API and regenerate admin OpenAPI services when the public contract changes.
5. Update the relevant Docusaurus module or API document when a convention or endpoint behavior changes.
6. When introducing or refactoring list queries, prefer a single shared Drizzle query/config plus conditional pagination over duplicated branches.

## Governance

This constitution supersedes local implementation preferences for API contract, boundary-mapping, and dynamic-query decisions. Amendments must update this document and affected developer documentation in the same change. Reviews must verify that public field names cannot be used as unchecked ORM or SQL identifiers.

**Version**: 1.2.0 | **Ratified**: 2026-07-12 | **Last Amended**: 2026-07-12
