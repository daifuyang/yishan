/**
 * 迁移历史表的命名约定（P0 R-01 的根因修复）。
 *
 * Drizzle migrator 只执行 `folderMillis > max(created_at)` 的迁移；多条迁移流共用一张历史表时，
 * 时间戳较早的流会被静默跳过。因此：
 *   - Core + System 共用一条迁移流，沿用 drizzle 默认表 `__drizzle_migrations`（与已部署库兼容；
 *     两者的表同在 `drizzle/0000_init.sql` 中，拆分历史等于改写已执行的迁移）；
 *   - 每个模块一条独立迁移流，历史表为 `<id>_drizzle_migrations`（以模块前缀开头，归模块所有）。
 *
 * 模块的 drizzle.config.ts 与运行时迁移脚本（scripts/lib/module-migrations.ts）都从这里取表名，
 * `drizzle-kit migrate` 与 `pnpm db:migrate:modules` 因此读写同一张历史表。
 */
export const CORE_MIGRATIONS_TABLE = '__drizzle_migrations'

export function moduleMigrationsTable(moduleId: string): string {
  return `${moduleId}_drizzle_migrations`
}
