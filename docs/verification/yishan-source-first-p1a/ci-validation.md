# P1-A2 / A6 / A7 构建与 CI 门禁

## 1. 修改

### 根 `package.json`

| 脚本 | 修复前 | 修复后 |
|---|---|---|
| `build` | tiptap → admin → docs（**不含 API**） | tiptap → admin → **api `build:ts`** → **app `build:weapp`** → docs |
| `lint` | admin lint、docs typecheck、`yishan-app lint`、module naming、main baseline | admin lint、docs typecheck、app **Biome**、**`typecheck:baseline`**（app/tiptap tsc 棘轮）、module naming、main baseline、**`check:boundaries`** |
| `test` | admin、api | admin、api、**`test:scripts`** |
| 新增 | — | `typecheck:baseline`、`check:boundaries`、`check:toolchain`、`check:openapi`、`test:scripts`、`test:integration` |

### `scripts/check-main-baseline.mjs`

新增最高优先级的 `YISHAN_BASELINE_TARGET`；P0 R-12 指出它按分支名跳过，从 main 拉出的功能分支（如本分支）永远不被检查。CI 中对非 all 目标设为 `main`。

### `.github/workflows/yishan-fullstack-ci.yml`（验证工作流）

| 项 | 修复前 | 修复后 |
|---|---|---|
| 安装 | `pnpm install --no-frozen-lockfile --force --prod=false`，另对 tiptap 再装一次 | `pnpm install --frozen-lockfile`（锁文件不一致即失败） |
| 不存在的命令 | `pnpm --filter yishan-admin gen:plugin-routes`（脚本不存在，退出码 0） | 删除；`max setup` 是实际生成步骤 |
| 工具链 | 只由 `setup-node` 读取 `.tool-versions` | 另加 `pnpm check:toolchain` |
| 触发路径 | 只含 admin/api/tiptap、锁文件、根配置 | `apps/**`、`packages/**`、`scripts/**`、`docs/verification/**`、`.tool-versions`、锁文件、根配置 |
| 数据库 | `environment: YISHAN_API` + 仓库 secrets 中的数据库凭据写入 `.env`，只执行 `db:generate` | 工作流内临时 MySQL/Redis service；不再使用任何数据库 secrets、不再引用 environment |
| 覆盖 | admin lint/build/test、main 基线、API build/test | 见下表全部步骤 |

步骤顺序：toolchain → frozen install → TipTap build → Admin setup → `pnpm lint`（含全部守卫）→ script tests → Admin test → Admin build → API build → API test → App build → Docs build → Core schema 漂移 → 迁移临时库（模块先于 Core，见 §4）→ 模块表只读诊断 → 导出运行时 OpenAPI → `check:openapi` → 契约 vs P0 基线 → 生成客户端一致性 → 集成测试。每一步都是普通命令，没有 `continue-on-error`、`|| true` 或忽略退出码。

### 未修改

`yishan-fullstack-cd-fc.yml`（仍只在 push 到 `all` 时部署）、`yishan-fc-migrate.yml`、`yishan-cert-rotate-fc.yml`、部署脚本与目标均未改动。验证工作流不部署、不触发 CD（main 上的 CD 文件只监听 `all`）。

## 2. 本地回放结果

GitHub Actions 未运行（未推送，N-05）。以 `tmp/p1a/ci-local.sh` 按工作流同样的命令与顺序在本机回放（Windows 11 + Git Bash，Node 22.22.1，临时容器替代 service），日志 `tmp/p1a/logs/ci-local/`：

| 步骤 | 退出码 | 关键输出 |
|---|---|---|
| toolchain | 0 | `ok (node 22.22.1, pnpm 8.15.9)` |
| install (frozen) | 0 | — |
| tiptap-build | 0 | 4 条已知 TS 诊断（告警） |
| admin-setup | 0 | — |
| lint | 0 | Admin Biome 0 errors；app Biome 0 errors；`app: ok (KNOWN BASELINE FAILURE: 44 …)`；`tiptap: ok (KNOWN BASELINE FAILURE: 4 …)`；`check-module-naming ok`；`check-main-baseline ok (main baseline: demo)`；`boundaries ok (24 known …)` |
| script-tests | 0 | 9/9 |
| admin-test | 0 | 6 suites / 63 tests |
| admin-build | 0 | — |
| api-build | 0 | — |
| api-test | 0 | 31 passed / 5 skipped files，300 passed / 30 skipped（回放时尚未迁入 P0 的 2 个测试文件；迁入后 33 / 313，见 baseline-fixes.md） |
| app-build | 0 | — |
| docs-build | 0 | — |
| core-schema-drift | 0 | `db:generate` 生成 `0000_<random>.sql`，与已提交 `0000_init.sql` 内容一致（忽略行尾） |
| migrate-ci-db | 0 | demo → Core |
| module-tables | 0 | `demo: 1/1 present` |
| dump-openapi | 0 | — |
| check-openapi | 0 | `0 change(s)` |
| contract-vs-p0 | 0 | `0 change(s), 0 allowed` |
| generated-client | 0 | 重新生成后与工作区一致（本地以快照目录比较，CI 用 `git diff --exit-code`） |
| integration | 0 | 5 files / 30 tests |

第一次回放时 `core-schema-drift` 失败（`cmp`：`differ: byte 31, line 1`）：Windows 工作区中已提交文件为 CRLF，生成文件为 LF（P0 在 `git archive` 导出中确认两者字节相同）。改为 `diff -q --strip-trailing-cr` 后通过；该修改只忽略行尾，不放宽内容比较。

## 3. 负向验证（门禁确实会失败）

`tmp/p1a/mutation-check.cjs` 注入违规 → 运行门禁 → 按原字节恢复文件并校验（`tmp/p1a/logs/mutation-check.log`）：

| 注入 | 门禁 | 退出码 | 输出 |
|---|---|---|---|
| App 新增一个类型错误文件 | `check-tsc-baseline app` | 1 | `1 NEW type error(s)` |
| TipTap 基线中多一条已不存在的错误 | `check-tsc-baseline tiptap` | 1 | `1 recorded error(s) no longer occur` |
| Core 文件 import `../modules/demo/module` | `check-architecture-boundaries` | 1 | `NEW violation: core-imports-module|…` |
| Core 文件写入字面量 `'crm'` | 同上 | 1 | `NEW violation: business-literal|…|crm:crm` |
| 删除 `openapi.json` 中 `/api/health` | `openapi-diff` | 1 | `1 unapproved` |
| main 上新增 `src/modules/shop` | `check-main-baseline`（`YISHAN_BASELINE_TARGET=main`） | 1 | `发现非法模块目录: shop` |
| 默认 PATH 的 Node 24.20.0 | `check-toolchain` | 1 | `node 24.20.0 != .tool-versions 22.22.1` |

## 4. 数据库风险隔离（A6）

- 未修改任何迁移 SQL、journal、迁移表、seed/onboard/runner；未连接任何真实数据库。
- `apps/yishan-api/scripts/check-module-tables.mjs`：只读查询 `information_schema`，核对每个已装载模块在 `db/schema.ts` 声明的表是否存在；空库上 `demo: 0/1 present; MISSING: demo_todos`，退出码 1；demo 迁移后 `1/1`，退出码 0。
- CI 临时库刻意“模块先于 Core”迁移，以得到可用的临时库，并用上面的诊断证明模块表真实存在——迁移退出码 0 不再被当作成功证据。R-01 本身由集成测试 `it.fails` 持续暴露，不被这个顺序掩盖（integration-tests.md §4）。
- main 的 CI 仍需运行时 `db:generate`（Core journal 未提交，J3）；新增的漂移检查保证生成内容与已提交迁移一致。生成文件只存在于 CI 工作区。
- 在 P4 完成前不应依赖 `db:seed`/onboard 自动执行模块迁移来部署新的数据库变更（known-issues P4 前置清单）。

## 5. 工具链（A7）

`.tool-versions`：`node 22.22.1`、`pnpm 8.15.9`；`package.json#packageManager`：`pnpm@8.15.9`。本机 PATH 默认 Node 24.20.0，本轮全部命令显式使用 22.22.1。P0/P1-A 中没有发现因 Node 版本引起的错误（P0 也全部使用 22.22.1 执行）；`check:toolchain` 让版本不一致在执行任何检查前即失败。CI 继续由 `setup-node` 读取 `.tool-versions`，未修改团队工具链。
