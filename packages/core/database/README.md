# @yishan/core-database

Explicit MySQL/Drizzle database construction and safe migration execution. Importing this package does not read environment variables, create a pool, or run migrations.

```ts
import { createDatabase, migrateDatabase } from '@yishan/core-database'

const database = createDatabase({ connection: databaseUrl, schema })
await database.connect()
await migrateDatabase(database.db, [
  { id: 'system', folder: systemMigrationFolder, historyTable: '__drizzle_migrations' },
  { id: 'crm', folder: crmMigrationFolder, historyTable: '__drizzle_migrations_crm' },
])
// Queries and transaction callbacks retain the supplied schema's Drizzle types.
await database.close()
```

The application owns configuration, logging, shutdown hooks, and the migration folders. Migrations only run through the explicit `migrateDatabase` call. This package contains no application SQL resources; a package providing migrations must copy its SQL and `meta/_journal.json` into its own build output.

`readMigrationPlan(manifests)` validates manifests and MySQL journals, reads each SQL file, and returns journal indexes, tags, unchanged timestamps, SHA256 hashes, and parsed statements. Execution follows strictly increasing journal indexes; unique timestamps may decrease. SQL parsing preserves quoted semicolons and breakpoint text, supports comments, and rejects `DELIMITER` directives.

The manifest owning `__drizzle_migrations` retains it; modules use `__drizzle_migrations_<id>`. Ownership follows the history table declaration, not a hardcoded module ID. Applied rows ordered by insertion ID must match an unchanged, continuous journal prefix by hash and timestamp. Include every installed owner when shared history exists. Unknown, duplicate, edited, or skipped-prefix histories fail before writes.

`inspectMigrationHistory(db, manifests)` returns `{ plan, pending }[]` using SELECTs only. It checks every ledger and pending `CREATE TABLE` target before migration starts. An existing target without matching applied history is ambiguous even with `IF NOT EXISTS`; it is never adopted. Dry runs do not execute pending SQL, so they cannot prove pending ALTER statements are semantically valid.

`migrateDatabase` pins one mysql2 connection for inspection and execution, uses `GET_LOCK('yishan:migrations:'+database, 10)` (hashed for long names), and releases the lock and pooled connection in `finally`. A lock-release failure destroys the session. Each whole migration is recorded after its statements succeed. MySQL DDL may persist after failure; a failed migration is not recorded and retry requires explicit operator reconciliation of partial DDL.

Mixed old shared history requires the explicit `inspectLegacyMigrationHistory` / `reconcileLegacyMigrationHistory` workflow. Inspection returns `{ plan, migrations }[]` of missing module-ledger rows without writes. Reconciliation checks exact unique hash/timestamp ownership and continuous prefixes for all manifests, checks pending CREATE targets, then copies only missing proven module rows under the same migration lock, retaining their original hashes. It preserves the original shared ledger and business data, and is repeatable after an interrupted copy. Normal migration never copies history automatically. Non-monotonic legacy runs that skipped journal entries cannot be reconciled automatically; their missing operations require manual investigation.

Published migrations may include `meta/_published-hashes.json` with version 1, the original commit, and a tag-keyed `migrations` object containing `sha256` and an optional audited `windowsSha256`. SQL must match its canonical published hash; the Windows variant must equal only the CRLF conversion of those exact bytes. The single audited mixed-newline file also specifies sorted, one-based `windowsCrLfLines` positions; other line endings stay LF. Both hashes identify the same historical journal operation; unknown hashes fail, recorded hashes remain untouched, and new execution records the canonical hash. Migrations without explicit published metadata receive no automatic newline compatibility. Git attributes preserve migration SQL bytes across platforms.

Lifecycle methods are `connect`, `close`, `healthCheck`, `transaction`, and `getConnectionStatus`. Closing is idempotent. The legacy status shape is retained; `queryCount` remains zero because query instrumentation is not provided, and `uptime` is milliseconds since construction.

Run `pnpm --filter @yishan/core-database test`, `typecheck`, and `build`. `pnpm --filter @yishan/core-database test:mysql` runs live integration tests against the repository's local MySQL using random `yishan_v2_test_*` databases; each is dropped in `finally`. It does not load application credentials or access application databases.
