# P1-A 验收

## 总体结果：**PASS WITH WARNINGS**

P1-A 的目标（让门禁真实、可重复、会失败）已经达到，并已在 GitHub Actions 上实际验证：`yishan-fullstack-ci` 在 PR 与 push 两次运行中全部步骤成功，结果与本地回放一致。
警告：PR 上的第三方检查 **GitGuardian Security Checks 失败**（3 条“硬编码密码”告警，经核对均非真实凭据，需维护者在 GitGuardian 中分诊，见 §4）；App 页面缺陷（N-01）与 TipTap 依赖问题（N-02）以基线保留；R-01/R-02 等数据库问题按要求未修复。

## 1. 交付信息

| 项 | 值 |
|---|---|
| PR | https://github.com/daifuyang/yishan/pull/9 （`refactor/source-first-p1a` → `main`，未合并） |
| 被验证的提交 | `6988583776c1bd5654be85313e3e84984e21dd40` |
| 提交列表 | `57d9d82` fix: repair stale demo menu test, admin media lint and tiptap returns<br>`a6bab39` test(api): run integration tests from the recorded migration history<br>`aee6277` ci: add toolchain, tsc ratchet, boundary and OpenAPI gates<br>`957146e` chore(api): sync openapi.json and admin client with the runtime spec<br>`6988583` docs(verification): add Source-First P0 baseline and P1-A reports |
| CI（pull_request） | https://github.com/daifuyang/yishan/actions/runs/37774486426 — success（12:05:53Z → 12:11:46Z） |
| CI（push） | https://github.com/daifuyang/yishan/actions/runs/37774423525 — success（12:05:21Z → 12:10:58Z） |

本报告随后以一个仅含文档的提交更新（不改代码）；该提交触发的运行见 PR 的 Checks 页。

## 2. GitHub Actions 实际执行的检查（run 37774486426，日志逐项核对）

| # | 检查 | 结果 | 日志中的证据 |
|---|---|---|---|
| 1 | Node 22.22.1 / pnpm 8.15.9 | PASS | `[toolchain] ok (node 22.22.1, pnpm 8.15.9)` |
| 2 | 冻结依赖安装 | PASS | `pnpm install --frozen-lockfile` → `Lockfile is up to date` |
| 3 | TipTap 构建 | PASS | 步骤成功（4 条已知 TS 诊断为告警） |
| 4 | Admin lint / test / build | PASS | lint 在 “Lint and guards” 中；`Tests: 63 passed`；`Built in 5611ms` |
| 5 | API `build:ts` | PASS | 步骤成功 |
| 6 | API 单元测试 | PASS | `Test Files 33 passed \| 5 skipped`，`Tests 313 passed \| 30 skipped`（跳过的 5 个文件/30 个用例是集成测试，在 #7 中执行） |
| 7 | API 真实数据库集成测试 | PASS | 临时 `mysql:8.4`/`redis:7-alpine` service；`Test Files 5 passed`，`Tests 30 passed`；含 `app.e2e` 7 条与 R-01 文件 3 条 |
| 8 | App 已知错误基线 | PASS（KNOWN BASELINE FAILURE） | `[tsc-baseline] app: ok (KNOWN BASELINE FAILURE: 44 recorded errors…)`；App Biome 通过；`build:weapp` `Compiled successfully` |
| 9 | Docs 构建 | PASS | `[SUCCESS] Generated static files in "build"`；docs typecheck 在 lint 中 |
| 10 | OpenAPI 一致性 | PASS | 已提交 vs 运行时：`0 change(s)`；运行时 vs P0 基线：`0 change(s), 0 allowed`；生成客户端 `git diff --exit-code` 无差异 |
| 11 | 架构边界 | PASS | `[boundaries] ok (24 known violation(s) …)`；`[check-main-baseline] ok (main baseline: demo)`（`YISHAN_BASELINE_TARGET: main`，未被跳过） |
| 12 | root lint / test / build | PASS（等价拆分执行） | `pnpm lint` 原样执行；`pnpm test` 的三部分（admin、api、`test:scripts` 10/10）与 `pnpm build` 的五部分（tiptap、admin、api、app、docs）在 CI 中逐个作为独立步骤执行，均成功 |
| — | Core schema 漂移 | PASS | 运行时生成 `drizzle/0000_lying_sphinx.sql`，与已提交 `0000_init.sql` 一致 |
| — | 模块表只读诊断 | PASS | `[module-tables] demo: 1/1 present` |

未触发 / 未运行：无。push 与 pull_request 两个事件都触发了同一工作流（触发路径覆盖本次全部改动）。仅修改 `docs/verification/**` 以外的文档时工作流不会触发（路径过滤，符合预期）。

## 3. 数据库测试（CI）

- 只使用工作流内的临时 MySQL/Redis；未引用任何数据库 secrets 或 `environment`；未执行生产迁移；未改 SQL/journal。
- **实际通过**：`rbac`（2）、`pat-lifecycle`（16）、`user.lifecycle`（2）、`app.e2e`（7：登录、JWT 会话、未登录、PAT、RBAC、禁用/锁定、模块启停+重启）、R-01 文件中的 2 条普通断言（“两次迁移无异常且 Core 表存在”、对照组“模块先于 Core 时表都存在”）。
- **Expected failure**：`it.fails('BLOCKED BY R-01: demo_todos exists')`——R-01 在 GitHub 环境同样复现（Vitest 计为通过即表示该断言如预期失败）。
- **未执行**：无。
- **仍被真实问题阻断**：R-01、R-02（P4）。

## 4. PR 上的其他检查

| 检查 | 结果 | 说明 |
|---|---|---|
| Vercel / Vercel Preview Comments | success | 仓库已有的集成，非本 PR 引入 |
| **GitGuardian Security Checks** | **failure** | 3 条告警：①`docs/verification/yishan-source-first-p0/scripts/migration-repro.sh:25` “Generic Password”——该行从环境变量读取密码（`${P0_MYSQL_ROOT_PASSWORD:?…}`），无字面量；②`…/api-baseline-probe.mjs:96` “Username Password”——`admin/admin123`，即仓库公开的开发种子默认密码（`apps/yishan-api/src/scripts/seed/config.ts:116`，生产环境不设置 `SEED_ADMIN_PASSWORD` 时拒绝种子）；③同一 incident 在 main 已有提交 `cb31dec`（`test/app.auth.routes.test.ts:39`）中的既有出现。均非真实凭据，无需轮换。告警绑定在已推送的提交上，消除它需要改写历史（强推，本任务禁止），因此需维护者在 GitGuardian 中标记为测试凭据/误报 |

`main` 未启用分支保护，GitGuardian 失败不阻止合并，但 PR 状态为 `UNSTABLE`。

## 5. 本地与 CI 的差异

| 项 | 本地（Windows + Git Bash） | GitHub（ubuntu-latest） |
|---|---|---|
| 各步骤结论与计数 | admin 63、API 313/30 skipped、集成 30、scripts 10、OpenAPI 0 changes、boundaries 24 | 相同 |
| Core 漂移检查 | 首次因 CRLF 工作区失败，改为忽略行尾后通过 | 直接通过（LF） |
| 运行时生成的 Core 迁移文件名 | 随机（如 `0000_early_impossible_man.sql`） | 随机（`0000_lying_sphinx.sql`），比较的是内容 |
| 服务 | 临时容器（tmpfs、`--rm`） | Actions service 容器 |

结论：没有本地通过而 CI 失败（或相反）的检查。

## 6. 审查中发现并修正的问题（推送前）

`check-tsc-baseline.mjs` 原先只解析带文件位置的诊断；`error TS5023: …` 这类无位置诊断（如 tsconfig 配置错误）在已有基线错误存在时可能被漏掉。已改为同样计入（`<global>|TSxxxx|…`），并补测试。其余脚本复核结论：
- `check-architecture-boundaries.mjs`：新增违规、已修复未删除的违规、缺少 reason 的条目都会失败；无全局关闭开关。
- `openapi-diff.mjs`：任何未逐项批准的差异与未使用的批准条目都失败；`$ref` 展开后比较。
- `check-main-baseline.mjs`：只有显式 `YISHAN_BASELINE_TARGET` 或分支名为 main 时检查；CI 中以 `all` 为目标（push 到 all 或 PR 到 all）时为 `all` 并跳过。局限：从 all 拉出、又包含本工作流文件的功能分支在**无 PR 的 push** 时会按 main 检查——当前 all 的工作流是独立文件，不受影响。

## 7. 验收清单

| 标准 | 结果 |
|---|---|
| main 的可修复测试与 lint 问题已经处理 | ✅ |
| 工程构建错误不会静默通过 | ⚠️ TS 错误由 `typecheck:baseline` 拦截；TipTap 的 Rollup 构建本身仍以 0 退出（N-03） |
| CI 不再执行不存在的验证命令 | ✅ |
| API 构建进入完整验证流程 | ✅ |
| OpenAPI 对比机制可信 | ✅（CI 实测 0 changes；本地负向验证退出 1） |
| 集成测试不再因错误执行历史 SQL 而失败 | ✅（CI 30/30） |
| 核心认证测试能够实际运行 | ✅（CI `app.e2e` 7/7） |
| 公共与业务依赖有可执行的边界检查 | ✅ |
| P0 确认的数据库问题得到独立跟踪 | ✅（R-01 在 CI 中按预期失败） |
| 没有对生产数据库或部署造成修改 | ✅（CD/迁移/证书工作流未改；未触发部署） |
| 没有改变任何现有 API 业务行为 | ✅（运行时契约 0 差异） |
| 没有覆盖其他分支或工作区的修改 | ✅（未改 main/all；无强推；P0 worktree 原样保留） |

## 8. P1-B 准入：**READY WITH RESTRICTIONS**

满足：PR 的 `yishan-fullstack-ci` 实际执行并全部通过；无新引入的 lint/测试/构建/契约失败；边界门禁有效；数据库问题被隔离且未被掩盖；工作区与现有功能未被破坏。

未满足 READY 的原因：
1. PR 上 GitGuardian 检查失败（误报，需维护者分诊）。
2. PR 尚未经人工审查与合并；P1-B 应基于合并后的 main 开始。

P1-B 的约束：契约变化逐项写入 `scripts/baselines/openapi-allowed-changes.json`；修复的边界违规同步从基线删除；不触碰迁移机制、SQL、journal、seed/onboard（P4）。
