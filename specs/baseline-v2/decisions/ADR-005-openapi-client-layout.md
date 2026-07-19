# ADR-005：OpenAPI spec 与 admin client 的 per-profile 布局

- 状态：Proposed（阶段 E 起生效）
- 日期：2026-07-19
- 取代：`apps/yishan-api/openapi.json` + `apps/yishan-admin/src/services/generated/` 单树布局
- 影响：生成物路径、CI 矩阵、`pnpm openapi:check` 语义、`max openapi` 配置

## Context

方案 §5.2 要求每个 profile 单独生成 spec，并把 admin client 放到 `<profile>/` 子目录。当前（INVENTORY §2、§3）：

- OpenAPI 单文件 `apps/yishan-api/openapi.json`，所有 plugin 的 tag/path 都堆在一起；
- Admin client 单目录 `apps/yishan-admin/src/services/generated/`，CI 用 `git diff --exit-code` 守护生成物。

如果按方案原文直接做"每个 profile 一棵树"，会出现三个具体问题：

1. `src/` 目录会同时有 `services/generated/core/` 与 `services/generated/official/` 两个 client 树，git diff 噪音翻倍；客户项目 monorepo 接入时需要二选一而非切换。
2. CI 必须为每个 PR 决定要跑哪几个 profile 的 openapi:check；矩阵随 profile 数量线性增长。
3. `git diff --exit-code` 守护的是"生成物与代码同步"，但如果生成物本身按 profile 拆分，单一工作区没法表示"core profile 是 X、official profile 是 Y"两种真相。

## Decision

1. **OpenAPI spec 走 artifacts 目录**，不进 src：

   ```text
   artifacts/openapi/<profile>.json
   ```

   通过 `pnpm openapi:generate --profile <name>` 重新生成；`.gitignore` 忽略该目录；release artifact 携带它。
2. **Admin client 走 `apps/yishan-admin/src/services/generated/<profile>/`**，但**只把当前构建 profile 的 client tree 提交到 src**：
   - 默认开发 profile（`core`）的 client 在 `src/services/generated/`（即当前形态），保持现有 import 路径零迁移；
   - 其他 profile 的 client 在 `artifacts/admin-clients/<profile>/`，**不进 src**，通过 `tsconfig.paths` 运行时 alias 切换。
3. **`pnpm openapi:check --profile <name>` 行为**：
   - 重新生成 `artifacts/openapi/<profile>.json` 与 `apps/yishan-admin/src/services/generated/<profile>/`；
   - 对 `src/services/generated/<profile>/` 做 `git diff --exit-code`；
   - 对 `artifacts/openapi/<profile>.json` 与 committed OpenAPI 快照做 checksum diff（committed 在 `apps/yishan-api/openapi-snapshots/<profile>.json`，作为审计而非 build 阻断）。
4. **`max openapi` 的 schemaPath** 由 profile resolver 注入；admin `config/config.ts:186` 的硬编码路径删掉。
5. **CI 矩阵**：PR 触动 plugin 时跑"包含该 plugin 的最小 profile + core profile"两个 openapi:check；触动 Core 时只跑 core profile；`main` 与 `all` 的 release tag 跑各自完整 profile 集合。

## Consequences

正向：

- core profile 工作区不再携带 official profile 的 client 噪音。
- "core 的 spec 不能包含 portal/shop tag" 由 catalog → openapi exporter 单向生成保证，不再依赖 git diff 提醒。
- artifact 与 src 分开，符合方案 §6.1 的 release artifact 抽象。

负向 / 风险：

- 阶段 E 需要把现有 `apps/yishan-admin/src/services/generated/` 重新组织为 `<profile>/` 子目录；客户项目的 fork 在合 baseline-v2 时需要一次性重导入路径。
- OpenAPI snapshot 文件提交量增加；缓解：snapshot 只在 release tag 时更新，PR 阶段不写。
- TS path alias 切换需要 admin dev 脚本支持 `--profile` 参数；阶段 E 同时改造。

## 验收

- `artifacts/openapi/core.json` 不包含 `tags: ['portal']` / `tags: ['shop']` 任何一项；
- `apps/yishan-admin/src/services/generated/official/` 不存在于 src 树；
- `pnpm openapi:check --profile core` 与 `pnpm openapi:check --profile official` 在干净工作区都通过 `git diff --exit-code`；
- 篡改 `apps/yishan-api/openapi-snapshots/core.json` 的 checksum 在 release:build 阶段失败。