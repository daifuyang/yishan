# P1-A 验收

## 总体结果：**PASS WITH WARNINGS**

本轮目标（让门禁真实、可重复、会失败）已经达到：main 的可修复失败已修复；根 `lint/test/build` 在锁定工具链下全部退出 0；CI 不再执行不存在的命令、不再掩盖锁文件问题、覆盖 API 与 App 构建、使用临时数据库；OpenAPI、生成客户端、架构边界、tsc 新增错误都有会失败的门禁（已做负向验证）；集成测试真实执行 30 个用例。
警告：新 CI 只在本机回放过，尚未在 GitHub Actions 上运行（N-05）；App 页面缺陷（N-01）与 TipTap 依赖问题（N-02）以基线形式保留；R-01/R-02 等数据库问题按要求未修复。

## 验收清单

| 标准 | 结果 | 证据 |
|---|---|---|
| main 的可修复测试与 lint 问题已经处理 | ✅ | API 5 个失败 → 0（断言按当前配置精确更新）；Admin Biome 2 errors → 0；TipTap 8 → 4（其余 4 个需依赖调整） — baseline-fixes.md |
| 工程构建错误不会静默通过 | ⚠️ 部分 | TS 错误由 `typecheck:baseline` 拦截（新增即失败）；TipTap 的 Rollup 构建本身仍以 0 退出（N-03，需先修 N-02） |
| CI 不再执行不存在的验证命令 | ✅ | 删除 `gen:plugin-routes` |
| API 构建进入完整验证流程 | ✅ | 根 `build` 与 CI 均含 `build:ts`；CI 另以构建产物启动 API 导出 OpenAPI，集成测试 `app.e2e` 也基于 dist |
| OpenAPI 对比机制可信 | ✅ | 分类 diff + 逐项 allow；P1-A 运行时 vs P0 基线 0 changes；负向验证退出 1 — openapi-validation.md |
| 集成测试不再因错误执行历史 SQL 而失败 | ✅ | journal 驱动 + 官方 migrator + 每文件独立库；5 文件 / 30 用例执行 — integration-tests.md |
| 核心认证测试实际运行 | ✅ | `app.e2e`：登录、JWT 会话、PAT、RBAC、禁用/锁定、模块启停均在真实装配上通过 |
| 公共与业务依赖有可执行的边界检查 | ✅ | `check:boundaries`，24 项现有违规基线，新增/回归均失败 — architecture-boundaries.md |
| P0 确认的数据库问题得到独立跟踪 | ✅ | R-01 `it.fails`；P4 前置清单 — known-issues.md |
| 没有对生产数据库或部署造成修改 | ✅ | 只使用标签 `purpose=yishan-p0-temp` 的 `--rm` 容器；CD/迁移/证书工作流未改动；未推送 |
| 没有改变任何现有 API 业务行为 | ✅ | 运行时 OpenAPI 与 P0 main 基线 0 差异；未修改 `apps/yishan-api/src` 下任何非测试文件 |
| 没有覆盖其他分支或工作区的修改 | ✅ | 新 worktree `.claude/worktrees/source-first-p1a`；P0 worktree 的未提交成果保留原处（仅复制） |

## 修复前后对比（main，Node 22.22.1）

| 检查 | 修复前 | 修复后 |
|---|---|---|
| `pnpm install --frozen-lockfile` | PASS | PASS |
| `pnpm lint` | FAIL（admin Biome） | **PASS**（含 app Biome、tsc 基线、模块命名、main 基线、边界守卫） |
| `pnpm test` | FAIL（API 5） | **PASS**（admin 63、API 313 + 30 skipped、scripts 9） |
| `pnpm build` | PASS（不含 API/App） | **PASS**（含 API、App） |
| `pnpm --filter yishan-app lint`（原始 tsc） | FAIL 44 | KNOWN BASELINE FAILURE 44（仍 FAIL，未修改脚本） |
| TipTap `tsc` | 8 errors（构建仍 0） | 4 errors，KNOWN BASELINE FAILURE |
| 集成测试 | NOT CONFIGURED（CI 不跑；P0 在 all 上 0 用例执行） | PASS 30/30（含 1 条 `it.fails` = BLOCKED BY R-01） |
| OpenAPI 已提交 vs 运行时 | FAIL 27 处（无检查） | PASS 0 处（CI 门禁） |
| 生成客户端 vs `openapi.json` | 不一致（无检查） | PASS（CI 门禁） |
| 架构边界 | NOT CONFIGURED | PASS（24 项已知基线） |
| 工具链一致性 | NOT CONFIGURED | PASS（Node 24 下 FAIL，符合预期） |
| GitHub Actions 实际运行 | — | NOT RUN（N-05） |

## P1-B 准入：**READY WITH RESTRICTIONS**

不妨碍 P1-B 的已知失败：
- N-01（App 页面）、N-02/N-03（TipTap 依赖与构建告警）：与 Core/业务隔离无关，已由棘轮基线隔离。
- R-11（禁用用户 HTTP 200）：现状已由测试固定，任何变化都会被发现。

P1-B 的限制条件：
1. **先在 GitHub Actions 上跑通新的 `yishan-fullstack-ci.yml` 一次**（推送本分支或开 PR），确认与本机回放一致（N-05）。这是唯一需要在 P1-B 前完成的事项。
2. P1-B 处理 R-04、N-04、R-13、Swagger tag 时，每一项契约变化必须写入 `scripts/baselines/openapi-allowed-changes.json`；其余 OpenAPI 与 `app.e2e` 结果必须零变化。
3. 清理边界违规后同步从 `scripts/baselines/architecture-boundaries.json` 删除对应条目（门禁会强制）。
4. 不触碰迁移机制、SQL、journal、seed/onboard（R-01/R-02 属 P4）。
5. 合入 main 前人工确认本轮提交范围（本轮未提交、未推送）。
