# ADR-004：`pnpm verify --profile X` 的数据库策略

- 状态：Proposed（阶段 E 起生效）
- 日期：2026-07-19
- 取代：当前 verify 不验证 DDL；integration tests 由 `YISHAN_RUN_INTEGRATION=1` 手动 gating
- 影响：CI matrix、根脚本、CI workflow 的 service container、AGENTS.md 命令说明

## Context

方案 §7.1 要求 `pnpm verify` 在干净环境独立重现。现状（INVENTORY §4、§6）：

- Drizzle 迁移只生成 schema + 自检 `tsc --noEmit`，不实际跑 SQL。
- `apps/yishan-api/test/integration/*` 三个 integration 测试由 `YISHAN_RUN_INTEGRATION=1 + YISHAN_TEST_MYSQL_URL` gating，默认跳过。
- main 上 DDL 只有 29 个 Core 表（INVENTORY §6），不存在 portal_/shop_——阶段 D 在 main 上的 DDL 风险主要是"profile 内插件的新迁移能被干净跑通"。

## Decision

1. **默认在干净环境跑一个 ephemeral MySQL**：CI 使用 `services: mysql:8` 容器，container 自动建库、tear down；本地通过 `pnpm verify:db:up`（依赖 docker compose）拉起。
2. **迁移 dry-run 必跑**：`pnpm verify --profile <name>` 必须先 `pnpm migrate:dry-run --profile <name> --target shadow`：
   - 用 catalog 生成的 `migration-plan.json` 与 DB 当前 `sys_migrations` 表的 `version/checksum` 对比；
   - 若新迁移 checksum 与 plan 不一致 → 退出非 0；
   - 若 plan 与已应用集合存在版本漂移 → 退出非 0。
3. **integration tests 不再单独 gating**：`pnpm verify --profile <name>` 主动用 ephemeral MySQL 跑 `apps/yishan-api/test/integration/*`；老的 `YISHAN_RUN_INTEGRATION=1` flag 在 v2.0.0 删除。
4. **Core 自身的 integration 测试**（用户生命周期、rbac、pat）必须在 `core` profile 中通过；与 plugin 无关的 fixture 写到 `apps/yishan-api/test/fixtures/` 而不是散落在测试里。
5. **不用 SQLite 兼容层**：Drizzle MySQL 方言与 SQLite 在 JSON、fulltext、decimal scale 上差异较大，shadow 用 SQLite 会假阳性绿。

## Consequences

正向：

- `pnpm verify` 真正能挡掉"DDL 生成 OK 但 SQL 跑不通"的回归。
- migration checksum 在 verify 与 release:build 之间形成闭环，避免"本地能跑、线上挂"。
- 删除手动 gating flag，CI 矩阵少一类特殊环境。

负向 / 风险：

- CI 启动时间 +30–60s（MySQL container boot），需要在 `actions/setup-node` 阶段并行准备。
- 客户项目若本地无 docker，verify 退化成 "skip migration dry-run" 模式——必须在 README 显式说明。
- ephemeral MySQL 与生产 MySQL 版本必须严格对齐（CI 固定 `mysql:8.x`，与 FC3 的 `custom.debian12` 内部 MySQL driver 兼容）；版本漂移需在 stage F 末尾做一次 staging 全流程校验。

## 验收

- `pnpm verify --profile core` 在 PR CI 中通过；
- 删除 `YISHAN_RUN_INTEGRATION` 相关文档与 gating 代码；
- `pnpm migrate:dry-run --profile core` 在干净 MySQL 容器内通过；
- 故意篡改 `drizzle/0000_initial.sql` 的 checksum，`pnpm verify --profile core` 失败并指出漂移的文件与版本号。