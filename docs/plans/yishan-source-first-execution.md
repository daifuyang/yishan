# Yishan Source-First 执行记录（权威恢复点）

> 会话中断后：先读本文件 → `git status` / `git log` → 重新跑“验证命令”一节，然后从“下一步最小行动”继续。不重新讨论架构。

## 最终目标（验收口径见任务书 §七）

A 清除 Core 业务泄漏 · B 公共机制与 System 解耦（身份/权限可替换）· C 公共源码复用边界 · D 迁移系统缺陷修复（R-01/R-02/M4，含已部署库衔接方案）· E 跨仓库源码分发与选择性升级演练 · F 既有功能兼容。最终报告：`docs/verification/yishan-source-first-final.md`。

## 基线与分支

| 项 | 值 |
|---|---|
| 起点 | `refactor/source-first-p1a` @ `0209993`（PR #9，未合并；含 6 个 Core 回迁 + 6 个 P1-A 提交） |
| 工作分支 | `refactor/source-first-integration`（worktree `.claude/worktrees/source-first-p1a`） |
| origin/main | `0dc03c7`；本地 main `6a5c62a`；all 为现网部署来源（不改） |
| 架构参考 | V2：主 checkout 中未跟踪的 `docs/plans/yishan-source-first-architecture-review.md`（未纳入本分支） |
| 工具链 | Node 22.22.1（`/c/Users/dfy/AppData/Roaming/fnm/node-versions/v22.22.1/installation` 置于 PATH 前）、pnpm 8.15.9 |
| 临时库 | `docker run --rm --label purpose=yishan-p0-temp --name yishan-sf-mysql --tmpfs /var/lib/mysql -e MYSQL_ROOT_PASSWORD=root -p 127.0.0.1:33306:3306 mysql:8.4`；redis 同理 `36379`（Git Bash 需 `MSYS_NO_PATHCONV=1`） |

## 关键决策（依据）

1. **不拆 Package（Goal C 采用 V2 C′）**：kernel 留在 `apps/yishan-api/src/core`，以“可包化约束”+ CI 守卫表达边界（零 `@/`、不依赖 system）。依据：Yishan 内只有一个服务端消费者；API 为 tsc+CommonJS 构建，workspace TS 包需额外构建链。包化触发条件与原型结论见最终报告。
2. **身份契约 = 一个 `AuthProvider`（3 个函数）**，由组合根 `app.ts` 装饰到 `fastify.authProvider`；jwt-auth / rbac 只依赖 `core/auth/identity.ts`。无 IoC、无 ModuleContext。
3. **模块公开入口**：`core/module-api.ts`（kernel 契约，纯重导出）+ `core/system-api.ts`（system 对模块开放的能力，如 `seedModuleMenus`）。运行时依赖走 Fastify 原生（`app.drizzleDb`、`request.currentUser`）。
4. **迁移**：Core+System 保持 `__drizzle_migrations`（兼容已部署库，Core journal 采用 all 的 `0000_init` 同一 `when`）；每模块 `<id>_drizzle_migrations`。执行用 drizzle-orm 官方 migrator，前后加守卫（未衔接库拒绝、历史核对、结构核对）。已部署库用 `db:migrations:bridge`（默认 dry-run，只插不删）。
5. **SQL 一律 LF 检出**（`.gitattributes`），核对时兼容历史上 CRLF 检出产生的 hash。
6. **契约变化**只允许 4 项（R-04 available-scopes schema/描述；R-13 app login/refresh `security: []`），逐项登记在 `scripts/baselines/openapi-allowed-changes.json`。

## 已完成

- [x] Goal A：`PermissionRef.public` 取代 `BYPASS_CODES`；`registerPermissionGroups`（模块自登记分组名）；PAT 分组动态化（R-04 500 修复）；registrar 直接写 OpenAPI `security`（删 onRoute 函数名推断，R-13）；Swagger 模块 tag 来自模块 meta；`meta.id` 校验（格式 + 等于目录名，R-16）；删除 Core seed 中的 portal 夹具与 Admin 壳的 portal/demo-documents 文案；边界基线清零。
- [x] Goal B：`core/auth/identity.ts`（`Principal`/`CurrentUser`/`AuthProvider`）、`core/auth/effective-permissions.ts`；system 默认实现 `core/services/auth-provider.ts`；jwt-auth/rbac 不再 import system；ModuleLoader 不再 import `drizzleDb`；System schema 插件移到 `plugins/app`；demo 只经 `module-api`/`system-api`；菜单 seed 收敛为 `seedModuleMenus`。
- [x] Goal D：Core journal/snapshot 提交（J3）；模块独立历史表；`scripts/lib/migration-streams.ts`、`migrate.ts`、`migrations-bridge.ts`；onboard 修复（R-02、M4）；seed 不再依赖 drizzle-kit；`check-migrations.mjs` + 基线；CI 改为按 R-01 顺序迁移。
- [x] 新规则：`module-imports-internal`、`kernel-imports-system`、`kernel-alias-import`、模块 id lint、`check:migrations`。

## 未完成 / 下一步最小行动

1. 提交 A+B、D 两组改动（本地提交）。
2. 全量 `pnpm lint` / `pnpm test` / `pnpm build`（含 Admin、App、Docs）。
3. Goal C：workspace 包原型评估（临时目录），记录结论与触发条件。
4. Goal E：临时消费项目演练（复制 → 删除模块 → 改公共源码 → 来源标记 → 预览上游 → 3-way 合并 → 冲突保护 → 回滚）；编写 `docs/distribution.md` 与可能的薄脚本。
5. Goal F：portal/shop（仅存在于 all）在新契约下的兼容性评估。
6. 推送分支、建 PR、核对 GitHub CI；写最终报告。

## 验证命令与最近结果

| 命令 | 结果（日期 2026-10-08） |
|---|---|
| `tsc --noEmit -p apps/yishan-api/tsconfig.json` | 0 错误 |
| `pnpm --filter yishan-api test` | 34 files / 324 passed（45 skipped = 集成） |
| 集成（临时库）`YISHAN_RUN_INTEGRATION=1 ... vitest run test/integration` | 6 files / 45 passed（R-01 由 it.fails 转为通过） |
| `node scripts/openapi-diff.mjs <P0基线> <runtime> --allow ...` | 4 changes, 4 allowed；committed vs runtime 0 |
| `node scripts/check-architecture-boundaries.mjs` | ok（0 known violations） |
| `node scripts/check-migrations.mjs` | ok（2 SQL / 2 streams） |
| `node --test scripts/*.test.mjs` | 全部通过 |
| 空库 `db:seed`（Core 先、模块后） | 退出 0；demo_todos 存在；重跑幂等 |

## 已知风险

- 已部署库（all 现网）尚未只读核对；衔接必须人工确认后执行（REQUIRES HUMAN ACTION）。
- `yishan-fc-migrate.yml` 引用的 runner 源码只存在于 all；main 上该手动工作流不可用（未改动）。
- `R-11`（禁用用户 HTTP 200）、`N-01`（App user/edit）、`N-02`（TipTap 双 core）、`N-04`（重复 operationId）保持现状。

## 主要修改文件

见最终报告“变更文件汇总”。
