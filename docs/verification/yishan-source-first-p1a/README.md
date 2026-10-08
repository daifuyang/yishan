# Yishan Source-First 重构 · P1-A 工程基线修复与安全门禁

执行日期 2026-10-08。依据 P0（`docs/verification/yishan-source-first-p0/`，PASS WITH WARNINGS）。

- **结论：PASS WITH WARNINGS；P1-B 准入 READY WITH RESTRICTIONS**（[p1a-acceptance.md](p1a-acceptance.md)）。
- 分支 `refactor/source-first-p1a`（自 `main@6a5c62a`），独立 worktree `.claude/worktrees/source-first-p1a`。**未提交、未推送**。
- 未修改 API 业务代码、URL、响应、数据库 Schema、迁移 SQL、journal、部署工作流；未连接任何真实数据库；`all` 未改动。
- P0 目录作为基线一并带入本分支（`docs/verification/yishan-source-first-p0/`，内容与 P0 worktree 中的版本相同）。

| 文档 | 内容 |
|---|---|
| [baseline-fixes.md](baseline-fixes.md) | A1：main 既有失败的分类、修复与遗留 |
| [ci-validation.md](ci-validation.md) | A2/A6/A7：根脚本、CI 工作流、本地回放、负向验证、数据库隔离、工具链 |
| [openapi-validation.md](openapi-validation.md) | A3：运行时/静态/生成产物的区分，分类 diff，main 生成产物更新 |
| [integration-tests.md](integration-tests.md) | A4：集成测试装置修复，30 个用例，R-01 跟踪 |
| [architecture-boundaries.md](architecture-boundaries.md) | A5：边界守卫规则与 24 项现有违规基线 |
| [known-issues.md](known-issues.md) | 未解决问题（按严重程度）与 P4 前置清单 |
| [p1a-acceptance.md](p1a-acceptance.md) | 验收清单、前后对比、P1-B 准入 |

证据：`evidence/`（检查汇总 before/after、CI 本地回放结果与脚本、负向验证、OpenAPI 对比报告）。

## 新增 / 修改的门禁一览

| 命令 | 作用 |
|---|---|
| `pnpm check:toolchain` | Node/pnpm 与 `.tool-versions` 一致 |
| `pnpm lint` | 现含 `typecheck:baseline`（App/TipTap tsc 棘轮）与 `check:boundaries` |
| `pnpm test` | 现含 `test:scripts`（门禁脚本自身的测试） |
| `pnpm build` | 现含 API `build:ts` 与 App `build:weapp` |
| `pnpm check:openapi <runtime.json>` | 已提交 `openapi.json` 与运行时分类对比 |
| `node scripts/openapi-diff.mjs <P0基线> <runtime> --allow scripts/baselines/openapi-allowed-changes.json` | 重构契约门禁 |
| `pnpm test:integration` | 需要一次性 MySQL/Redis；见 `apps/yishan-api/test/integration/README.md` |
| `node apps/yishan-api/scripts/check-module-tables.mjs` | 只读核对模块表是否真实存在 |
