# ADR-001：重构分支策略与发行线

- 状态：Proposed（baseline-v2 阶段 A 起生效）
- 日期：2026-07-19
- 取代：`scripts/arch/check-all-sync.mjs` + 3 个 workflow 中的 "all includes main" 步骤
- 影响：CI、根脚本、AGENTS.md

## Context

main 与 all 已经分叉（INVENTORY §1）。当前模型要求 all 必须通过 `git merge-base --is-ancestor origin/main HEAD` 证明包含 main，每次 main 改动都需要 cherry-pick/merge 回 all 才能发版。本次重构分 6 个阶段，每个阶段都会同时触碰 main 与 all 的语义边界（plugin 目录、API 前缀、OpenAPI 路径、Drizzle 表），沿用 ancestry 模型会要求 all 每步保持"包含 main 全部提交"，工作量翻倍且易出错。

## Decision

1. **新长生命周期分支** `refactor/baseline-v2`：从 main 拉，承载 6 个阶段所有破坏性变更；阶段 F 末尾打 `v2.0.0` tag 后合并回 main 与 all。合并策略：fast-forward 不强制，squash merge。
2. **取消 ancestry 检查**：删除 `scripts/arch/check-all-sync.mjs`；删除 `.github/workflows/yishan-fullstack-ci.yml:53`、`.github/workflows/yishan-fullstack-cd-fc.yml:48`、`.github/workflows/yishan-fc-migrate.yml:41` 三处 "Verify all includes main" 步骤。
3. **跨线同步改为显式记录**：新增 `sync-manifest/<date>.md`，记录"来源 commit / 目标分支 / 冲突结论 / 是否影响插件边界"，与 cherry-pick/merge 一起提交。
4. **main 与 all 维持现状**：main = Core + hello；all = Core + portal + shop。两条线均使用同一 profile / catalog / verify 体系；只通过 profile 区分（`core` vs `official`）。
5. **阶段 F 前的过渡期**：refactor 分支的 CI 矩阵允许 main 与 all 都跑，但均按各自 profile 跑 verify；不再以 ancestry 作为发布正确性证据。

## Consequences

正向：

- 阶段 A–E 可以独立在 `refactor/baseline-v2` 上推进，不需要每步同步 all。
- CI 矩阵不再因 ancestry 不匹配而红，业务线 (all) 可继续按当前节奏发布。
- 跨线同步的争议点（plugin 边界、DDL 冲突、permission 命名）落到具体 PR 评论而不是隐式通过 merge-base 验证。

负向 / 风险：

- main 与 all 长时间不发版会合流风险更高；阶段 F 末尾合并时冲突面比当前模型大。
- 删除 ancestry 检查短期内会让"all 落后于 main"的状态更难被自动发现；缓解：sync-manifest 必须在每次跨线提交时新增条目，否则 PR 检查会 fail。
- "sync-manifest" 流程的纪律性需要团队约定；建议阶段 A 同时引入 PR 检查：要求改动跨线文件时 PR 模板带 sync 字段。

## 验收

- `rg "merge-base|is-ancestor" .github/workflows scripts/` 零命中；
- `git branch --merged main` 不再以 `all` 为子集为发布前置；
- refactor/baseline-v2 的 README 增加 "本分支是 v2 唯一开发线，所有破坏性变更先合到本分支"。