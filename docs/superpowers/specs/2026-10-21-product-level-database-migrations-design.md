# Product-Level Database Migration Chain

## Status

Design approved in chat; awaiting user review before implementation planning.

## Context

Database migrations are currently distributed across `packages/core/system-api/drizzle/`
and each business module's `drizzle/` directory. Each owner contributes a separate
journal and history table through `ApiModule.migrations`; the Demo API combines the
installed modules into one explicit migration command. Core Database validates and
executes these independent histories, including legacy-ledger reconciliation.

This preserves module ownership, but the final product schema and migration history
are fragmented across packages. The requested direction is one coherent migration
history per product API.

## Goals

- Give each product API one authoritative migration directory, journal, and ledger.
- Keep table schemas and repositories owned by their existing System/business modules.
- Make the product composition root own the schema snapshot and SQL history for the
  modules it installs.
- Replace the Demo API's existing fragmented history with a clean baseline.
- Keep database writes explicit and prevent migration commands from dropping databases.
- Keep independent products' migration histories independent.

## Non-goals

- Preserve compatibility with the existing per-module migration ledgers.
- Automatically migrate or reconcile existing production databases.
- Automatically drop tables when a module is removed from the runtime manifest.
- Change business schemas, seed data, or application database contents as part of
  ordinary startup.
- Re-squash all history on every schema change.

## Proposed architecture

Each product API owns one migration chain for its composed database. For Demo, the
authoritative chain lives under `apps/demo/api/drizzle/`, with one Drizzle journal,
one SQL history, and the single `__drizzle_migrations` ledger.

The Demo API maintains a product-level schema aggregate from System and the business
modules in its installed schema set. Individual `db/schema.ts` files remain with
their owning modules; the aggregate exists for migration generation and does not move
table or repository ownership. A new product creates its own aggregate and migration
chain rather than importing Demo's migration files.

The initial product journal contains one `0000_baseline` migration representing the
complete current schema for System and the Demo API's installed modules. Subsequent
schema changes append product-level migrations. The product schema aggregate must
retain schemas needed by the product's historical database; removing a runtime module
does not silently generate or apply table drops. Table removal requires an explicit,
reviewed migration.

The migration runner consumes one product manifest. Core Database retains its
database lock, ordered journal validation, hash/history checks, inspection, dry-run,
and explicit apply behavior. Legacy shared-ledger inspection and reconciliation are
removed because the old migration histories are retired rather than adopted.

## Historical cutover

The old per-module SQL, journals, published-hash metadata, and history-check baseline
are replaced by the new product baseline. `ApiModule.migrations` is removed from the
module contract; modules no longer package migration SQL. `@yishan/core-system-api`
continues to own System schemas and behavior but no longer ships a standalone SQL
history. Module-local Drizzle migration configuration is retired in favor of the
product-level generator configuration.

Existing databases are not upgraded in place. Before applying the new chain, an
operator must arrange a separately reviewed backup/data-retention decision and
rebuild the target product database as an empty database. The runner will not drop,
truncate, or reset any database, and there will be no implicit destructive reset
command. The migration command remains explicit:

1. `db:migrate --check` validates local migration files and journal.
2. `db:migrate --dry-run` inspects the target database without writes.
3. `db:migrate --apply` applies pending SQL only after explicit operator invocation.

Seed execution remains a separate command and is not folded into the baseline.

## Generation and change workflow

1. Update the schema in the module that owns the table.
2. Ensure the product schema aggregate includes that schema.
3. Generate a product-level migration into `apps/demo/api/drizzle/`.
4. Review generated SQL and journal changes; do not edit the database automatically.
5. Run migration checks and dry-run against the intended database.
6. Apply only through the explicit migration command.

When a module is added, its schema must be represented by a product migration before
the module is enabled against databases that do not already contain its tables.
Removing a module from the runtime manifest does not drop its historical tables.
Any later physical removal is an explicit schema migration.

## Documentation and validation

Update API V2 and database-ownership documentation, module migration instructions,
the migration-history check, and package scripts to describe product ownership and
the empty-database cutover. Remove obsolete reconciliation instructions and module
ledger references.

Validation should cover:

- Product schema aggregation and Drizzle generation produce the expected baseline.
- Baseline SQL and journal are checked into the product migration directory.
- Runner check/dry-run/apply operate on the single product ledger.
- Missing, changed, or out-of-order migration history fails before SQL writes.
- Existing Core Database SQL parsing, lock, and failure-handling tests remain valid.
- API build/typecheck, migration checks, and focused migration tests pass.

Any live MySQL validation must use an explicitly disposable database; never use
production or an unspecified developer database for destructive verification.
