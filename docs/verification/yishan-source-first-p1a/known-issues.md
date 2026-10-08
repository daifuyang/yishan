# P1-A 之后仍未解决的问题

“状态”：KNOWN BASELINE FAILURE = 已记录在可执行基线中，新增同类问题会失败；BLOCKED = 依赖其他阶段；OPEN = 仅文档跟踪。编号沿用 P0 `risks.md`（R-xx），本轮新发现记为 N-xx。

## Critical

| ID | 问题 | 状态 | 跟踪方式 | 处理阶段 |
|---|---|---|---|---|
| R-01 | Core 与模块共用 `__drizzle_migrations`，Core 先迁移时模块迁移被静默跳过、退出码 0 | BLOCKED（P4） | `test/integration/module-migration.r01.test.ts`：`it.fails('BLOCKED BY R-01: demo_todos exists')` + 对照组；CI 临时库按“模块先于 Core”迁移并用 `check-module-tables.mjs` 证实模块表存在 | P4（需人工确认；先只读核对已部署库） |

## High

| ID | 问题 | 状态 | 说明 / 证据 | 处理阶段 |
|---|---|---|---|---|
| R-02 | `db:seed` 的模块入驻在任何平台失败（`import(fileUrl)` 被编译为 `require('file:///…')`） | BLOCKED（P4） | main 仍存在：`apps/yishan-api/src/scripts/onboard-modules.ts:52-53`。P1-A 不修改，修复它会把 R-01 的错误记账暴露为“成功”，必须与 R-01 同批 | P4 |
| R-04 | `GET /api/v1/me/api-tokens/available-scopes` 恒 500（分组字面量写死 system/shop/portal/special） | OPEN | main、all 均复现（P0）；对应 6 项边界基线 | P1-B |
| N-01 | App `pages/system/user/edit` 功能性损坏：`d163a32` 按不存在的组件/接口形态重写，表单无输入控件、加载与保存结果判断错误 | KNOWN BASELINE FAILURE | 44 个 tsc 错误记录在 `scripts/baselines/tsc/app.json`；`pnpm --filter yishan-app lint`（Biome + 原始 tsc）仍如实失败。修复需改 UI 与调用（约 150–200 行）或从 `932d40d` 恢复，属于产品行为变更 | 单独任务（需产品确认） |
| R-03 | all 已提交的 `openapi.json` 含 66 个运行时不存在的 CRM 路径 | OPEN | P1-A 按要求不修改 all | 由 all 维护者处理 |

## Medium

| ID | 问题 | 状态 | 说明 | 处理阶段 |
|---|---|---|---|---|
| N-02 | TipTap 同时安装两份 `@tiptap/core`（3.11.0 经 starter-kit，3.28.0 作为其余包的 peer），导致 4 个 TS 错误，且两份 core 都被打进 dist | KNOWN BASELINE FAILURE | `scripts/baselines/tsc/tiptap.json`；修复需要依赖/锁文件调整（改变打包产物），P1-A 不做 | 单独任务 |
| N-03 | TipTap Rollup 构建不传播 TS 错误（`@rollup/plugin-typescript` 默认 `noEmitOnError: false`） | OPEN（已补偿） | 由 `pnpm typecheck:baseline` 在 lint/CI 中拦截新错误；N-02 修复后应开启 `noEmitOnError` | N-02 之后 |
| N-04 | 运行时 OpenAPI 中 `appDashboardStats` 被两个操作共用（`GET /api/v1/app/stats`、`GET /api/v1/app/dashboard/stats`），违反 operationId 唯一性；生成客户端因此命名为 `appDashboardStats2` | OPEN | `openapi-diff` 只拦截新增重复；修复会改变 OpenAPI 与生成客户端 | P1-B |
| R-13 | `POST /api/v1/app/auth/{login,refresh}` 运行时匿名可用，但 OpenAPI 继承全局 bearer | OPEN | main 同样存在 | P1-B |
| R-11 | 被禁用用户的 JWT 请求返回 HTTP 200 + `success:false`（30003），锁定为 403 | OPEN | `app.e2e.test.ts` 按现状断言；是否改为 401/403 需人工决定 | 待决定 |
| J3 | main 未提交 Core `drizzle/meta`，CI 运行时 `db:generate` | OPEN（已加漂移检查） | CI 现校验生成 SQL 与已提交 `0000_init.sql` 一致（忽略行尾）；生成的 journal `when` 仍随运行时间变化 | P4 |
| J1 | demo 的 `0000_snapshot.json` 与 SQL 不一致（P0：`drizzle-kit generate` 报 malformed 仍退出 0） | OPEN | 未在 main 上重新验证生成行为（P1-A 未执行 demo generate） | P4 |
| N-05 | 新 CI 工作流尚未在 GitHub Actions 上运行过 | **RESOLVED** | PR #9 的 pull_request（run 37774486426）与 push（run 37774423525）运行全部步骤成功，结果与本地回放一致，见 p1a-acceptance.md §2 | — |
| N-10 | PR #9 上 GitGuardian Security Checks 失败：3 条“硬编码密码”告警（`migration-repro.sh:25` 实为读取环境变量；`api-baseline-probe.mjs:96` 与 main 既有 `app.auth.routes.test.ts:39` 为公开的开发种子默认密码 `admin123`） | OPEN | 均非真实凭据；消除需改写历史（禁止）。需维护者在 GitGuardian 标记为测试凭据/误报；后续新增脚本可改为从环境变量读取开发密码以减少噪音 | 维护者分诊 |

## Low

| ID | 问题 | 说明 |
|---|---|---|
| N-06 | 模块启停的 Redis 缓存键 `yishan:modules:enabled` 不区分数据库/环境；共用 Redis 的两个环境会在 60 秒 TTL 内看到彼此的启停状态 | 集成测试中实际触发过一次，测试已在启动后清除该键并在 `finally` 恢复 |
| N-07 | API `tsconfig.json` 与 `vitest.config.ts` 的 `@modules → src/plugins/modules` 别名指向不存在的目录，无人使用 | 边界守卫不解析该别名 |
| N-08 | API 测试文件不在 `tsconfig.json` 的 include 中，测试代码不做类型检查（P0 已记录） | 本轮新增测试同样只经 Vitest 执行 |
| N-09 | Core seed 配置导入无消费者的 `portal-*.json`；Admin 公共 locale 含 `menu.portal.*` | 已列入边界基线，P1-B 清理 |
| R-21 等 | P0 中只涉及 all 或 CRM 的其余项 | 见 P0 `risks.md` |

## P4 前置问题清单（数据库，P1-A 未改动任何迁移机制）

R-01、R-02、R-06（runner，仅 all 存在）、R-07（demo 快照）、J3（main Core journal 未提交）、M8（all 的 `0010_create-sys-enum.sql` 未登记且与 `0002_init` 重复）、已部署库只读核对（U2/U3）。在 P4 完成前：不得依赖 `db:seed`/onboard/runner 自动执行模块迁移来部署新的数据库变更；任何部署环境的模块表必须用 `apps/yishan-api/scripts/check-module-tables.mjs` 只读核对。
