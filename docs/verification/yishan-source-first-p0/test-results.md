# 测试结果

## 1. 已有自动化测试

| 套件 | 命令 | all `e4a08d3` | main `6a5c62a` |
|---|---|---|---|
| API Vitest（DB 全局 mock） | `pnpm --filter yishan-api test` | 62 passed / 4 skipped files；565 passed / 21 skipped tests | 29 passed / 1 failed / 3 skipped files；289 passed / **5 failed** / 20 skipped |
| API 集成（真实 MySQL，默认跳过） | 见下 | **FAIL**：3/3 文件 setup 失败，0 用例执行 | 未执行 |
| Admin Jest | `pnpm --filter yishan-admin test` | 26 suites / 199 tests passed | 6 suites / 63 tests passed |
| App | — | NOT CONFIGURED | NOT CONFIGURED |
| Docs | — | NOT CONFIGURED（仅 typecheck） | 同左 |
| TipTap | — | NOT CONFIGURED（仅 `verify:package`，PASS） | NOT CONFIGURED |
| 根脚本 `node --test scripts/*.test.mjs` | `pnpm test:scripts` | 2 passed | NOT CONFIGURED |

### 认证/权限/模块相关的已有测试（all，全部通过）

`auth.routes`（17）、`app.auth.routes`（4）、`rbac.pat`（25）、`pat.lifecycle`（13）、`me.api-tokens.routes`（12）、`api-token.service`（30）、`auth.password-upgrade`（1）、`jwt-secret-validator`（8）、`user.service`（20）、`system.routes`（5）、`not-found.routes`（4）、`business-error-response`（4）、`module-loader.pack`（1）、`module-pack`（3）、`admin-crud`（2）。这些测试通过 `vi.spyOn` 替换 Service/Repository，验证的是**路由与机制层**行为，不覆盖真实数据库与完整插件装配。

### API 集成测试（隔离 MySQL）

命令：每个文件单独、每次使用新建的 `p0_integration` 库：
`YISHAN_RUN_INTEGRATION=1 YISHAN_TEST_MYSQL_URL=mysql://root:<temp>@127.0.0.1:33796/p0_integration npx vitest run test/integration/<file>.test.ts`

| 文件 | 结果 | 首个错误 |
|---|---|---|
| `rbac.test.ts` | FAIL（0 用例执行） | `Duplicate key name 'idx_sys_enum_type_enabled_sort'` |
| `pat-lifecycle.test.ts` | FAIL（0 用例执行） | 同上 |
| `user.lifecycle.test.ts` | FAIL（0 用例执行） | 同上 |

原因：`test/integration/_setup.ts` 按文件名执行 `drizzle/*.sql` 全部文件；未登记 journal 的 `0010_create-sys-enum.sql` 重复创建 `0002_init.sql` 已建的索引（M8）。三个文件并行跑同一个库时还会出现 `Duplicate key name 'idx_api_token_user_id'`（共享库竞争）。日志：[`evidence/checks/api-test-integration-*.log`](evidence/checks/)。

## 2. 本次新增的回归测试

两个文件，均只新增、不修改任何产品代码或已有测试。API 的 `tsconfig.json` 只包含 `src/**`，测试文件（含已有测试）不参与 `tsc` 类型检查。

### 2.1 `apps/yishan-api/test/auth.jwt-session.baseline.test.ts`（7 tests）

补齐 `authenticate` 的 JWT 会话分支（PAT 分支已有 `pat.lifecycle`）：无 token、header/cookie 两种来源、拒绝 refresh_token、会话已注销、禁用用户、锁定用户。禁用用户当前返回 HTTP 200 + `success:false`（30003），锁定用户返回 403，均按观测值固定（见 risks.md R-11）。

### 2.2 `apps/yishan-api/test/module-lifecycle.baseline.test.ts`（6 tests，使用真实 `ModuleLoader`、真实 `@fastify/autoload`、真实 Fastify 实例；只为 `syncModulesFromDiskPure` 提供一个记录写入的最小 DB 替身）：

| 用例 | 锁定的既有行为 |
|---|---|
| route prefix is hard-wired to /api/<id> | `moduleRoutePrefix` |
| sync inserts unseen modules with traffic enabled = 1 | 首次同步写 `enabled: 1`、默认 `tablePrefix`/`version` |
| sync never writes `enabled` for an existing module | 已存在模块只更新 `name/tablePrefix/version/updatedAt` → 重启不覆盖运行时开关 |
| mounts packed module routes under /api/<id> … | 扫描跳过 `meta.enabled=false`，挂载到 `/api/<id>`，`listModuleIds` 只含已挂载模块 |
| an install with no modules still boots core routes | 无模块时 scan 为空、mount 空集合、Core 路由可用 |
| current baseline: meta.id format is not validated at scan time (P1 scope) | 记录现状：`Bad-Id` 会被接受。P1 引入 `meta.id` 校验时此用例应按设计改为拒绝 |

结果：两文件 13/13 通过；纳入全量后 API **64 passed / 4 skipped files，578 passed / 21 skipped tests**（新增前 62 / 565）。

## 3. 真实启动探针（行为基线）

[`scripts/api-baseline-probe.mjs`](scripts/api-baseline-probe.mjs) 以 CI 相同方式（`fastify start dist/app.js`）启动构建产物，连接临时 MySQL/Redis，记录 65 个探针的 HTTP 状态、业务码与响应键：dev（含重启）、pat、prod 三个阶段。结果：[`evidence/smoke/all-e4a08d3.json`](evidence/smoke/all-e4a08d3.json)、[`evidence/smoke/main-6a5c62a.json`](evidence/smoke/main-6a5c62a.json)。逐项解读见 [module-baseline.md](module-baseline.md)、[auth-baseline.md](auth-baseline.md)。

`node scripts/p0-compare.mjs smoke evidence/smoke/main-6a5c62a.json evidence/smoke/all-e4a08d3.json` 只有 1 项差异：`portal-categories-admin`（main 无 portal 模块，404/25005）。

## 4. 需要人工验证（无自动化条件）

- Admin 页面：登录、动态菜单、模块页面（demo/portal/shop）渲染；模块被禁用后的前端表现。
- App（小程序）：无测试脚本；`tsc` 失败但 `build:weapp` 成功，需在开发者工具中人工验证 `system/user/edit` 页面。
- FC 部署与迁移工作流：P0 不触发部署。
