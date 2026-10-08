# P0-2 构建与检查结果

运行器：[`scripts/run-checks.sh`](scripts/run-checks.sh)（逐条执行仓库已有命令，记录退出码与耗时）。原始汇总：[`evidence/checks/summary-all-e4a08d3.tsv`](evidence/checks/summary-all-e4a08d3.tsv)、[`evidence/checks/summary-main-6a5c62a.tsv`](evidence/checks/summary-main-6a5c62a.tsv)。Node 22.22.1 / pnpm 8.15.9，Windows + Git Bash。

结果口径：PASS / FAIL / NOT CONFIGURED（项目无该脚本）/ NOT MEANINGFUL（命令成功但不验证目标）。

| 检查 | 命令 | all `e4a08d3` | main `6a5c62a` |
|---|---|---|---|
| 冻结依赖 | `pnpm install --frozen-lockfile` | PASS | PASS |
| TipTap 构建 | `pnpm --filter yishan-tiptap build` | PASS（退出码 0，但 Rollup 输出 **10 条 TypeScript 诊断**：TS2322×2、TS2339×2、TS7030×4、TS2769×2，未阻断构建） | PASS（8 条诊断：TS2339×2、TS2769×2、TS7030×4；无 all 的 TS2322 tooltip 两条） |
| TipTap 包校验 | `pnpm --filter yishan-tiptap verify:package` | PASS | NOT CONFIGURED |
| CI 步骤 | `pnpm --filter yishan-admin gen:plugin-routes` | NOT MEANINGFUL（脚本不存在，退出码 0） | 同左 |
| Admin setup | `pnpm --filter yishan-admin exec max setup` | PASS | PASS |
| Admin lint（Biome + `tsc --noEmit`） | `pnpm --filter yishan-admin lint` | PASS（Biome 31 warnings） | **FAIL**：Biome 2 errors（`a11y` “Provide a track for captions…”，现有源码） |
| Admin 测试 | `pnpm --filter yishan-admin test` | PASS 26 suites / 199 tests | PASS 6 suites / 63 tests |
| Admin 构建 | `pnpm --filter yishan-admin build` | PASS | PASS |
| API 类型检查 + 构建 | `pnpm --filter yishan-api build:ts` | PASS（编译 demo、portal、shop；跳过 crm） | PASS |
| API 单元测试 | `pnpm --filter yishan-api test` | PASS 62 files / 565 tests，4 files / 21 tests skipped（集成测试默认跳过） | **FAIL**：1 file / 5 tests（`src/modules/demo/tests/system-menu.test.ts` 断言与 `config/system-menu.json` 不一致，例如 `expected 12 to be 10`、`'region:list'` 不匹配 `/^demo:/`；all 已由 `3f5980f` 修正） |
| API 集成测试（隔离 MySQL） | `YISHAN_RUN_INTEGRATION=1 … vitest run test/integration/<file>` | **FAIL**：3 个文件在各自 setup 阶段失败，0 用例执行（见 test-results.md） | 未执行 |
| App lint（Biome + `tsc`） | `pnpm --filter yishan-app lint` | **FAIL**：Biome 16 warnings；`tsc` **44 errors**，全部在 `src/pages/system/user/edit/index.tsx`（27）与 `hooks/useUserEditForm.ts`（17） | **FAIL**（相同 44 个错误） |
| App 构建 | `pnpm --filter yishan-app build:weapp` | PASS | PASS |
| App 测试 | — | NOT CONFIGURED | NOT CONFIGURED |
| Docs typecheck | `pnpm --filter yishan-docs typecheck` | PASS | PASS |
| Docs 构建 | `pnpm --filter yishan-docs build` | PASS | PASS |
| 模块命名 | `node scripts/check-module-naming.mjs` | PASS（4 模块 39 张表） | PASS |
| main 基线守卫 | `node scripts/check-main-baseline.mjs` | 跳过（非 main 分支名）；以 `GITHUB_REF_NAME=main` 执行 → 报错 crm/portal/shop | 以 `GITHUB_REF_NAME=main` 执行 → PASS |
| 脚本单测 | `pnpm test:scripts` | PASS（2） | NOT CONFIGURED |
| OpenAPI 漂移 | `pnpm check:openapi` | NOT MEANINGFUL（未 dump 时恒为 in sync）；实际运行时对比 → **FAIL**（见 api-contract.md） | NOT CONFIGURED |
| 根 lint | `pnpm lint` | **FAIL**（退出码 2，停在 app lint） | **FAIL**（停在 admin lint） |
| 根 test | `pnpm test` | PASS | **FAIL**（API 5 个失败） |
| 根 build | `pnpm build` | PASS（不含 API） | PASS（不含 API） |

## 失败归类

| 失败 | 分类 | 说明 |
|---|---|---|
| App `tsc` 44 errors（两分支） | 现有源码问题 | 文件来自 `932d40d`/`d163a32`；工作区干净，非未提交修改引起。CI 不运行 app lint，所以未被发现；根 `pnpm lint` 因此在 all 上必然失败 |
| main API `system-menu` 5 个测试 | 现有源码问题（仅 main） | all 的 `3f5980f` 已改为逻辑契约断言 |
| main Admin Biome 2 errors | 现有源码问题（仅 main） | — |
| API 集成测试 setup 失败 | 现有源码问题 + 需要数据库（已用隔离库提供） | 测试 setup 执行 `drizzle/` 下全部 SQL，`0010_create-sys-enum.sql` 与 `0002_init.sql` 重复建索引（M8） |
| TipTap 10 条 TS 诊断 | 现有源码问题（非阻断） | Rollup typescript 插件仅告警 |

无依赖/版本问题导致的失败；无“缺少环境配置”导致的阻断（数据库类检查均由临时容器提供）。
