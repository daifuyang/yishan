# P0 发现的问题（按严重程度）

“状态”沿用 database-migration-audit.md 的口径。“阶段”指建议处理的阶段；P0 未修复任何问题。

## Critical

| ID | 问题 | 状态 | 影响 | 证据 | 阶段 |
|---|---|---|---|---|---|
| R-01 | 模块迁移被静默跳过且显示成功：Core 与各模块共用 `__drizzle_migrations`，migrator 只执行晚于最大 `created_at` 的迁移；Core 先迁移时所有模块 `0000_init` 被跳过，模块之间也互相跳过；随后 `sys_module_migration` 按 tag 跨模块去重，记录“已迁移” | CONFIRMED（all、main） | 新环境按 CI/文档顺序初始化后模块表缺失而命令全部成功；新模块或下游模块在已有库上同样会被跳过；记账失真。CI 不执行模块迁移，无法发现 | database-migration-audit.md M1–M5、M3′ | P4（需人工确认；修复前先只读核对已部署库） |

## High

| ID | 问题 | 状态 | 影响 | 证据 | 阶段 |
|---|---|---|---|---|---|
| R-02 | `db:seed` 的模块入驻步骤在任何平台都失败：`import(fileUrl)` 被 CJS 编译为 `require('file:///…')` | CONFIRMED（all、main） | 文档化的初始化入口退出码 1；模块迁移、模块 seed、`sys_module` 首次同步均不执行。修复它会把 R-01 的错误状态暴露为“成功”，两者必须一起处理 | audit O1；`dist/scripts/onboard-modules.js:51-52` | P4（与 R-01 同批） |
| R-03 | all 已提交的 `openapi.json` 含 66 个已不存在的 `/api/crm` 路径（HEAD `e4a08d3` 关闭 CRM 打包后未重新 dump） | CONFIRMED（本地按 CI 相同比较逻辑） | CI “Verify OpenAPI spec is in sync” 在该提交应失败；CD 的 `ci-gate` 等待 CI 成功 → all 的下一次自动部署可能被阻塞（GitHub 上的实际运行未观察）；Admin 生成客户端仍含 CRM 契约 | api-contract.md §6 | P1 前（重新 dump 并核对生成客户端） |
| R-04 | `GET /api/v1/me/api-tokens/available-scopes` 恒返回 500：响应 Schema 把 `system` 限定为 `system|shop|portal|special`，服务对模块/其他 group 原样输出 | CONFIRMED（all、main，dev 与 prod） | PAT 管理页无法获取可授予范围 | auth-baseline.md §2；`core/schemas/api-token.ts:131-144`、`core/services/api-token.service.ts:233-345` | P1（即 V2 的“PAT 权限分组”） |
| R-05 | 现有 API 集成测试全部无法运行：setup 执行 `drizzle/` 下全部 SQL，`0010_create-sys-enum.sql` 与 `0002_init.sql` 重复建索引 | CONFIRMED | 认证/RBAC/PAT 没有真实数据库回归，P3 的安全网只剩 mock 单测 + 本次启动探针 | test-results.md | P3 前（改测试 setup，不改已发布 SQL） |

## Medium

| ID | 问题 | 状态 | 证据 | 阶段 |
|---|---|---|---|---|
| R-06 | FC 迁移 runner 不可用：查询不存在的 `__drizzle_migrations.name`，且用 tag 对比 hash；dry-run 与 apply 都先执行该查询 | CONFIRMED | audit M7、S5 | P4（修复或弃用） |
| R-07 | demo 快照与 SQL/schema 不一致（`demo_documents` vs `demo_todos`），`drizzle-kit generate` 输出 malformed 但退出码 0、不生成迁移 | CONFIRMED | audit J1 | P4 |
| R-08 | main 的 Core journal 未提交；CI 每次 `db:generate` 生成随机名、以当前时间为 `when` 的迁移 → 各环境 Core 历史不可复现，且与 all 的 `0000_init` 不兼容；main CI 从仓库 secrets 写数据库凭据 | CONFIRMED（导出副本） | audit J3；environment.md §5 | P1（CI）/ P4（journal） |
| R-09 | 根 `pnpm lint` 在两分支都失败：App `tsc` 44 个错误（`src/pages/system/user/edit/*`）；CI 不跑 App lint | CONFIRMED | build-results.md | P1 前或列入已知失败白名单 |
| R-10 | main 自身基线不绿：API 5 个测试失败（demo `system-menu` 断言过期）、Admin Biome 2 errors；已提交 `openapi.json` 与运行时 26 处差异且无漂移检查 | CONFIRMED | build-results.md；api-contract.md §6 | P1 若以 main 为目标分支则需先处理 |
| R-11 | 被禁用用户的 JWT 请求返回 **HTTP 200**（`success:false, code:30003`）；锁定用户为 403。客户端若按 HTTP 状态判断会误判为成功（访问本身仍被拒绝） | CONFIRMED（单测基线） | `test/auth.jwt-session.baseline.test.ts`；`constants/business-codes/index.ts:150` | 需要人工决定是否修改（P3 之后，属行为变更） |
| R-12 | CI 质量门禁失真：`gen:plugin-routes` 不存在但退出码 0；`--no-frozen-lockfile --force` 掩盖锁文件漂移（当前冻结安装可通过）；paths 未覆盖 `packages/**`、`scripts/**`、App、Docs、`.tool-versions`；`check:openapi` 单独运行恒为通过；`check-main-baseline` 依赖分支名 | CONFIRMED | environment.md §5 | P1 |
| R-13 | `POST /api/v1/app/auth/{login,refresh}` 运行时匿名可用，但 OpenAPI 未声明 `security: []`（继承全局 bearer）；security 注入依赖 preHandler 函数名 | CONFIRMED | api-contract.md §4；`app.ts:97-105` | P1 |
| R-14 | 无测试覆盖的应用：App 无测试；Admin 页面无 E2E；JWT 会话路径用户状态此前无测试（本次已补单测） | CONFIRMED | test-results.md | 持续 |

## Low

| ID | 问题 | 证据 |
|---|---|---|
| R-15 | TipTap 构建有 10 条（main 8 条）TypeScript 诊断，只作为 Rollup 告警 | build-results.md |
| R-16 | `meta.id` 格式未校验（`Bad-Id` 会被接受） | `test/module-lifecycle.baseline.test.ts` |
| R-17 | Swagger 全局 tags 硬编码 `crm` 等未使用 tag，且缺少 portal/shop 等已使用 tag；`BYPASS_CODES` 含 `crm:public-quote:view` | api-contract.md §6；auth-baseline.md §1 |
| R-18 | 模块响应不使用 Core 信封；portal/shop 54 个操作没有 operationId | api-contract.md §3 |
| R-19 | crm 在运行时被跳过依赖“`module.ts` 在 CJS 下导入失败”，而不是读取 `meta.enabled` | environment.md §6 |
| R-20 | 种子库中超管无法签发模块 scope 的 PAT（模块 seed 不绑定角色权限） | auth-baseline.md §2 |
| R-21 | CRM journal `when` 非单调、10 个 SQL 未登记（CRM 当前未打包） | audit J2 |
| R-22 | DB URL 拼接逻辑分散在 10 个文件，默认库名不一致 | audit M9 |
| R-23 | 本机 PATH 默认 Node 24.20.0，与锁定的 22.22.1 不一致；需显式切换 | environment.md §2 |

## 未能验证（需要人工或外部资源）

| 项 | 原因 | 建议 |
|---|---|---|
| 已部署库的迁移历史与模块表（U2/U3/U8） | P0 禁止连接真实库，且无只读凭据 | 维护者用只读账号执行 audit §4 的 SQL |
| GitHub Actions 上 all@`e4a08d3` 的 CI 实际结论 | 未访问远端 | `gh run list --branch all` 确认 R-03 |
| `apply-drizzle-sql.mjs` 实际行为 | 脚本固定写入共享容器 `mysql-local` | 若需要，复制脚本并改为临时容器后验证 |
| Admin 删除模块后的构建（V2 §4.2 聚合 `index.ts`） | 超出 API 侧范围 | P2 前在临时副本验证 |
| 共享 checkout 的未提交内容 | 会话限制在 worktree 内 | 维护者在共享 checkout 执行 `git status` 自查 |
