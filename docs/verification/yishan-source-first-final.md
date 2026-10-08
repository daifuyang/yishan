# Yishan Source-First 最终验收报告

> 日期：2026-10-08 · 分支 `refactor/source-first-integration`（基于 PR #9 的 `refactor/source-first-p1a@0209993`）· PR：https://github.com/daifuyang/yishan/pull/11（叠加在 #9 之上，未合并）
> 环境：Windows 11 + Git Bash，Node 22.22.1，pnpm 8.15.9；数据库只使用一次性容器（mysql:8.4 tmpfs、redis:7，仅绑定 127.0.0.1，标签 `purpose=yishan-p0-temp`）。未连接任何生产/测试环境数据库，未触发任何部署工作流，未修改 `main` / `all`。

## 结论：**PASS WITH RESTRICTIONS**

工程目标 A–F 均已实现并验证（含真实数据库、跨仓库消费演练、portal/shop 兼容性叠加验证）。剩余事项只依赖人工权限或业务决策（§10）：已部署库的只读核对与衔接批准、GitGuardian 分诊、portal/shop 去留与现网部署来源切换、PR 评审合并。

---

## 1. 最终架构与目录结构

不新建 Package、不搬迁 System 目录（与 V2 一致，依据见 §3）。新增/调整的关键文件：

```text
apps/yishan-api/
├── drizzle/meta/{_journal,0000_snapshot}.json   [新提交] Core 迁移历史（与 all 的 0000_init 同一 when）
├── drizzle.config.ts                             migrations.table = __drizzle_migrations（Core+System）
└── src/
    ├── app.ts                                    组合根：fastify.decorate('authProvider', opts.authProvider ?? defaultAuthProvider)
    ├── core/
    │   ├── auth/identity.ts                      [新] Principal / CurrentUser / AuthProvider 契约（kernel）
    │   ├── auth/effective-permissions.ts         [新] 有效权限计算（纯函数，kernel）
    │   ├── module-api.ts                         [新] 模块唯一 kernel 入口（纯重导出）
    │   ├── system-api.ts                         [新] system 对模块开放的能力（seedModuleMenus）
    │   ├── module-loader/module-contract.ts      [新] ModuleMeta / ModuleSeedContext 类型
    │   ├── module-loader/module-loader.ts        meta.id 校验；模块 OpenAPI tag；db 由 Fastify 注入
    │   ├── permissions/catalog.ts                public 权限、registerPermissionGroups；删除 BYPASS_CODES
    │   ├── routes/route-registrar.ts             直接写 OpenAPI security
    │   ├── plugins/external/{jwt-auth,rbac}.ts   只依赖 AuthProvider 契约
    │   ├── plugins/app/schemas.ts                [移动] System schema 注册（原在 plugins/external）
    │   └── services/{auth-provider,module-menu-seed.service}.ts   [新] System 默认实现
    ├── db/{database-url,migrations-table}.ts     [新] URL 拼接唯一实现（M9）；迁移历史表命名约定
    ├── modules/demo/                             只经 module-api / system-api；drizzle.config 独立历史表
    └── scripts/
        ├── lib/{migration-streams,streams}.ts    [新] 迁移流执行 + 守卫 + 核对
        ├── migrate.ts                            [新] db:migrate:all / db:migrate:modules
        ├── migrations-bridge.ts                  [新] db:migrations:bridge（已部署库衔接）
        ├── onboard-modules.ts                    重写（R-02、M4）
        └── seed/index.ts                         Core 迁移改用迁移流（不再依赖 drizzle-kit）
scripts/
├── check-architecture-boundaries.mjs            新规则：module-imports-internal / kernel-imports-system / kernel-alias-import
├── check-migrations.mjs (+ baselines/migrations.json)   [新] 迁移静态守卫（进入 pnpm lint）
├── check-module-naming.mjs                      新增 meta.id / 目录名校验
└── yishan-upstream.mjs                          [新] 下游跟进上游的 Git 薄封装
docs/distribution.md                             [新] 源码边界 + 分发与升级配方
.gitattributes                                   [新] *.sql eol=lf
```

## 2. 公共代码与业务代码的边界

| 层 | 路径 | 可以依赖 | CI 规则 |
|---|---|---|---|
| kernel | module-loader、permissions、auth、route-registrar、module-api | npm、platform 的 db 类型/`sys_module` 表 | 不得导入 system；只用相对导入（`kernel-imports-system`、`kernel-alias-import`） |
| platform | plugins/external、db | kernel 契约 | 不得导入 system |
| system | services、repositories、schemas、mappers、routes/api、routes/_dev、plugins/app、scripts | kernel、platform | — |
| module | modules/&lt;id&gt; | **只有** `core/module-api`、`core/system-api`（drizzle.config 另可用 db/database-url、db/migrations-table） | `module-imports-internal`、`cross-module-import` |
| 公共代码中的业务字面量 | — | — | `business-literal`（demo/portal/shop/crm） |

`scripts/baselines/architecture-boundaries.json`：P1-A 时 24 条已知违规 → **0 条**。新增任何违规即失败，已修复项必须删除。

## 3. 是否提取独立 Core Package：**否**（保持 App 内源码边界，记录包化条件）

原型（`tmp/proto-kernel`，未入库）结论：

| 方案 | 结果 |
|---|---|
| source-only workspace 包（tsconfig paths 指向包源码） | API 的 `tsc`（CommonJS，`rootDir: src`）直接失败：`TS6059 File ... is not under 'rootDir'` |
| 预构建包（包内 `tsc` → `dist`） | 可构建运行（`/api/demo`），但需要包构建 + watch 链；且 FC 运行时层 `build-runtime-layer.sh` 用 `npm install --omit=dev` 安装 API 依赖，无法解析 `workspace:*` → 部署链路需改造 |
| App 内 kernel + 守卫（采用） | 零额外构建；下游直接修改源码（§6 演练）；kernel 约 1.4k 行，对外依赖仅 5 处（db 类型与 `sys_module` 表、ResponseUtil、BusinessError、错误码、JWT 配置） |

Yishan 仓库内只有一个服务端消费者，包化不减少重复。包化触发条件（满足其一）：同仓库出现第二个服务端进程；下游确认在同一仓库内共享 kernel（如 codecloud crm-server 与 console-server）；有项目要以 npm 依赖使用 kernel。届时按 `kernel-*` 规则已保证的边界 `git mv` 即可。

## 4. 实际完成的重构与修复

| 目标 | 内容 | 关联风险 |
|---|---|---|
| A | `PermissionRef.public` 取代 Core 的 `BYPASS_CODES`（并删除 2 个无人声明的死码 `system:cron`、`system:options:public`）；`registerPermissionGroups`；PAT 可授予范围按声明 group 动态分组（修复恒 500）；registrar 直接写 `security`（删除按函数名推断的 onRoute）；Swagger 模块 tag 来自模块 meta；`meta.id` 格式 + 等于目录名校验；删除 Core seed 的 portal 夹具与 Admin 壳的 portal/demo-documents 文案 | R-04、R-13、R-16、R-17、N-09 |
| B | `AuthProvider` 契约（resolveSession / resolveApiToken? / loadPermissions），jwt-auth 与 rbac 不再引用 UserService/仓储/PermissionService；System 默认实现；`CurrentUser` 通过声明合并扩展；ModuleLoader 去掉 `drizzleDb` 直接依赖；`seedModuleMenus` 作为 System 公开能力；demo 改走公开入口 | V2 §4.3/§4.4 |
| C | 边界规则进入 CI；包化原型与结论（§3） | — |
| D | 见 §5 | R-01、R-02、M4、M5、M8（不再影响）、M9、J3、R-08 |
| E | `scripts/yishan-upstream.mjs` + `docs/distribution.md` + 自动化测试；演练发现并修复“下游删除 demo 后上游测试失败” | V2 §4.7 |
| F | portal/shop 叠加验证（§8） | — |

## 5. 数据库迁移修复与验证

机制：Core+System 一条流（`__drizzle_migrations`，与已部署库兼容）；每个模块一条流（`<id>_drizzle_migrations`）。执行仍是 Drizzle 官方 migrator，前后加三道检查：前置守卫（历史为空但表已存在 → 拒绝并指向衔接脚本）、历史核对（journal 每条都在历史表中，否则报“被跳过”）、结构核对（schema 的每张表每一列都存在）。失败 → 非零退出。

| 要求 | 验证 | 结果 |
|---|---|---|
| 每模块独立且正确的历史 | `migration-streams.test.ts`：Core 与 demo 各 1 行，互不混入 | ✅ |
| Core/System 历史兼容 | Core journal 采用 all 的 `0000_init`（when=1787238284270，SQL 字节相同）；模拟 all 部署库 → Core “up to date” | ✅ |
| 空库完整初始化 | 空库 `db:seed`（Core 先、模块后 = R-01 触发顺序）：demo_todos 存在；CI 同顺序 | ✅ |
| 新增模块正确迁移 | 演练中下游自建 `notes`（when 早于 Core）→ 建表成功 | ✅ |
| 多模块互不干扰 | 夹具 alpha（最新）/ beta（最旧）/ Core 两种顺序均全部建表；portal+shop+demo 叠加验证 | ✅ |
| 幂等 | 重跑 `db:seed`、`migrate.js`：无新执行、行数不变 | ✅ |
| 入驻与 seed 可执行 | `db:seed` 退出 0；portal seed（P0 中因表缺失失败）成功；`sys_module_migration` 3 模块 3 行（P0 只有 1 行） | ✅ |
| 失败返回非零 | 坏 SQL 抛错且不记录；`migrate.js` 退出 1；衔接需复核时退出 3 | ✅ |
| 验证真实表结构 | information_schema 列级核对；缺列夹具被拦截 | ✅ |
| 不改写历史 SQL | `git diff 6a5c62a..HEAD -- '*.sql'` 为空；`check:migrations` 基线锁定 | ✅ |
| 静默跳过可检测 | 非单调 journal 夹具 → “0001_more is not recorded” | ✅ |

**新库与已部署库分开处理。** 已部署库（all 现网）演练：用 all@e4a08d3 的迁移文件（只读取自主 checkout）按旧机制构造两类库：

| 库 | 构造 | 新代码行为 |
|---|---|---|
| deployed_a（健康：模块先于 Core） | 5 行共享历史，14 张模块表 | `migrate.js` 拒绝（退出 1，指向 bridge）→ `bridge` dry-run：demo `copy-from-shared`（复制共享表中实际记录的 hash，含 Windows CRLF 变体）→ mysqldump 备份 → `--apply` → `migrate.js` 全部 up to date；`__drizzle_migrations`、`demo_todos` 的 CHECKSUM 前后一致 → 执行脚本打印的回滚 SQL → 数据与备份一致（仅 `sys_module_migration` 的 AUTO_INCREMENT 计数不同） |
| deployed_b（R-01 损坏：Core 先） | 2 行共享历史，0 张模块表 | `bridge`：demo `fresh` → `migrate.js` 建表并记账 |

衔接脚本只 CREATE 新历史表 / INSERT，从不修改或删除旧行与业务表；`needs-review`、`adopt-candidate` 不自动处理（后者需 `--adopt=<id>`）。**现网执行步骤（需人工）**：①用只读账号执行 P0 `database-migration-audit.md` §4 的查询；②在库副本上 `db:migrations:bridge`（dry-run）并人工核对；③备份 `__drizzle_migrations`、`sys_module_migration` 与 `information_schema.tables` 快照；④批准后 `-- --apply`；⑤`db:migrate:all` 应全部 up to date；⑥回滚 = 脚本打印的 DROP/DELETE。portal/shop 的衔接在它们进入本分支后同样适用（演练中已在叠加环境验证 copy 与 fresh 路径的同一代码）。

另修复：Drizzle hash 取 SQL 原始字节，Windows（autocrlf）检出与 Linux 不同 → `.gitattributes` 强制 SQL LF，核对时兼容 CRLF 变体（有专门集成测试）。

未处理：R-06（FC 迁移 runner）的源码只在 all，main 上 `yishan-fc-migrate.yml` 本就不可用；部署链路改动不在本次授权内（§10）。

## 6. 源码分发与升级演练（`tmp/e2e`，真实 Git 仓库）

| 步骤 | 结果 |
|---|---|
| 从上游（HEAD 快照 v1）`git archive` 获取 `apps/yishan-api` → 消费项目 `server/` | ✅ 279 文件 |
| 删除 demo 模块；写 `YISHAN_UPSTREAM.json`（base、pathMap、exclude） | ✅ |
| 修改公共源码：kernel `catalog.ts` 新增函数；System `auth-provider.ts` 改锁定提示；新建自有模块 `notes` | ✅ |
| **隐藏上游仓库后**独立安装（`pnpm install --ignore-workspace`，8.5s）、构建、迁移、seed、启动 | ✅ 登录 200；`/api/notes/v1/notes` 200；available-scopes 200；`/api/demo/...` 404 |
| 发现：上游 3 个测试文件静态依赖 demo，删除 demo 后测试失败 | 已在上游修复（`hasModule`），并通过升级流程送达 |
| 上游 v2：改 kernel 同文件不同处、改 System 同一行、新增 Core 迁移、删除文件、重命名文件、改被排除的 demo、测试修复 | — |
| `status` 预览 | ✅ 列出提交与文件，标注 2 个本地改过的文件；排除项不出现 |
| 脏工作区 `apply` | ✅ 拒绝（退出 1） |
| `apply` | ✅ 新分支；catalog 两侧修改自动合并；auth-provider 冲突标记（ours=本地）；新增/删除/重命名生效；标记文件同提交更新；退出 2 |
| 回滚（未合并） | ✅ HEAD 与文件恢复到升级前 |
| 原子失败（本地删除未排除、上游又修改的文件） | ✅ 不留任何修改，回到原分支并删除升级分支 |
| 保留本地措辞解决冲突并提交 → 构建、迁移（新 Core 迁移被执行）→ v3 再升级（无冲突，单提交） | ✅ 单测 303 通过；集成 31 通过 / 14 跳过（demo 专用） |

自动化：`scripts/yishan-upstream.test.mjs`（3 个用例，用临时仓库复现预览、三方合并、冲突保护、回滚、原子失败），进入 `pnpm test:scripts`。

## 7. API、测试、构建与 CI

| 检查 | 结果 |
|---|---|
| `pnpm check:toolchain` | ok（node 22.22.1、pnpm 8.15.9） |
| `pnpm lint` | 通过；`typecheck:baseline` App 44 / TipTap 4（未增加）；boundaries 0；migrations ok |
| `pnpm test` | Admin 63/63；API 34 文件 325 通过（45 跳过 = 集成）；scripts 16/16 |
| `pnpm build` | tiptap、admin、api、app（weapp）、docs 全部成功 |
| API 集成测试（临时 MySQL/Redis） | 6 文件 45/45（含 app.e2e 7、R-01 3、migration-streams 15） |
| OpenAPI：已提交 vs 运行时 | 0 changes |
| OpenAPI：运行时 vs P0 基线 | 4 changes，4 allowed，0 unapproved |
| 生成的 Admin 客户端 | 与 openapi.json 同步（`system: string`） |
| GitHub Actions（PR #11） | 见本节末尾 |

新增/改动的测试：`auth-provider.contract.test.ts`（7，替身身份实现）、`me.api-tokens.routes.test.ts`（R-04 回归）、`api-token.service.test.ts`（分组顺序）、`module-lifecycle.baseline.test.ts`（meta.id 4 例，取代 R-16 现状快照）、`migration-streams.test.ts`（15）、`module-migration.r01.test.ts`（it.fails → 通过 + 根因复现）、`check-architecture-boundaries.test.mjs`（新规则）、`check-migrations.test.mjs`（2）、`yishan-upstream.test.mjs`（3）。没有删除任何测试、没有扩大任何错误基线（边界基线 24 → 0）。

**GitHub Actions（PR #11）**：全部通过。`verify` 在 pull_request（run 37795252615，5m32s）与 push（run 37795193097，5m50s）两次运行均 success。日志核对：boundaries 0；migrations ok；Core 先用 drizzle-kit 迁移，demo 再经 `migrate.js` 建表（`demo_drizzle_migrations`，核对 1 张表）；重跑全部 up to date；`[module-tables] demo: 1/1 present`；已提交 vs 运行时 OpenAPI 0 changes；对 P0 基线 4 changes，4 allowed；集成测试 6 个文件全部通过。GitGuardian Security Checks 在 PR #11 上 **pass**（新增提交无发现；#9 的 3 条历史告警仍待分诊）。Vercel pass。

## 8. 与 P0 行为基线的差异（全部为有意变化）

| 项 | P0 | 现在 |
|---|---|---|
| `GET /api/v1/me/api-tokens/available-scopes` | 恒 500 | 200；分组 = 声明的 group，`system` 字段为字符串；system 在前、special 在后 |
| app 登录/刷新的 OpenAPI security | 继承全局 bearer | `[]`（运行时本就匿名） |
| 非法 `meta.id` / 与目录名不一致 | 被接受 | 启动失败（未打包的模块不校验） |
| Swagger 全局 tags | 硬编码 demo，缺 portal/shop | 已挂载模块自动贡献（demo 描述不变，OpenAPI 0 差异） |
| 空库 Core 先迁移 | 模块表缺失、退出 0 | 模块表存在；被跳过/缺表会报错退出 1 |
| `db:seed` | 入驻步骤恒失败（退出 1） | 成功；`sys_module_migration` 按模块记账 |
| Core 迁移历史 | main 运行时 generate，随机名/当前时间 | 已提交，与 all 相同 |
| onboard 输出 | 3 步（含空操作“菜单追加”） | 2 步，带历史表与校验信息 |
| portal/shop（叠加验证） | 依赖“模块先于 Core”才能建表 | 任意顺序；OpenAPI 自动出现其 tag |

登录、刷新、登出、JWT 会话、PAT（scope 交集、空 scope、撤销）、RBAC（无角色 403）、禁用/锁定用户、模块启停 gate 与重启保持：`app.e2e` 7/7 与 P0 断言一致（R-11 禁用用户 HTTP 200 现状保持）。

## 9. 仍未解决的风险

| 风险 | 说明 |
|---|---|
| 已部署库真实状态未知（U2/U3） | 只做了隔离演练；现网是否混有 CRLF hash、是否经 apply-drizzle-sql 建表未知，衔接必须先只读核对 |
| 部署链路 | main 上 FC 迁移 runner 不存在（R-06 只在 all）；若现网改从 main 部署，需要把 `dist/scripts/migrate.js` 接入迁移工作流（需人工授权修改 CD） |
| portal/shop 进入 main 的适配 | 运行时兼容；要通过新门禁需机械修改约 50 处 import、2 个 drizzle.config、2 个 seed，并登记其 SQL 基线 |
| 替换 System 时的类型 | 若替换身份实现但保留 `auth-provider.ts` 的 `CurrentUser` 声明合并，类型会多出 sys_user 字段（文档已说明） |
| 同步工具限制 | 不识别下游重命名；上游重命名呈现为删除+新增 |
| 既有问题保持 | R-11、R-20（种子超管无法授予模块 scope，故 available-scopes 不显示模块分组）、N-01、N-02/N-03、N-04（重复 operationId）、N-06、N-08 |

## 10. 必须人工完成的事项（REQUIRES HUMAN ACTION）

1. **已部署库**：只读核对 → 副本演练 → 批准 `db:migrations:bridge --apply`（D6）。本次没有任何真实库权限，也未尝试连接。
2. **GitGuardian**（PR #9 的 3 条，状态 Triggered）：incident 38006099（`migration-repro.sh:25`，从环境变量读取密码，无字面量）；incident 21237363 两处（`api-baseline-probe.mjs:96`、`app.auth.routes.test.ts:39`，公开的开发种子默认密码 `admin123`，生产在未设置 `SEED_ADMIN_PASSWORD` 时拒绝 seed）。均非真实凭据，无需轮换；消除需改写历史（禁止），需维护者在 GitGuardian 标记为测试凭据/误报。本 PR 新增内容已自查，无新增类似字面量。
3. **决策**：D3 portal/shop 是否进入 main（默认不打包）；D4 现网部署来源从 all 切换的时间与方式；D1 `@yishan` npm 组织归属（与本次无直接关系）。
4. **评审与合并**：先 #9 后 #11；不自动合并。

## 11. 分支、提交与 PR

| 提交 | 说明 |
|---|---|
| `5ee3150` | refactor(api): remove business knowledge from Core and make the identity source replaceable（A+B） |
| `aeab5cb` | fix(api): give every migration stream its own history and verify what it applied（D） |
| `2389035` | test(api): keep the suite green when a downstream project deletes the demo module（E 演练发现） |
| `fcbbd51` | feat: source distribution and selective upgrade via a thin Git recipe（E、文档） |
| `a0f0c25` | docs(plans): update Source-First execution record |
| （本报告） | docs(verification): Source-First final report |

分支 `refactor/source-first-integration` → PR https://github.com/daifuyang/yishan/pull/11（base `refactor/source-first-p1a`，即 PR #9）。P1-A 的全部提交保留在 #9 中，未改写、未强推。

## 12. Definition of Done

| 类别 | 状态 |
|---|---|
| 架构（Core 不依赖业务、身份可替换、模块只依赖公开契约、无跨模块依赖、公共源码可复用定制、边界进 CI） | ✅ |
| 功能（API 兼容（4 项批准变化）、PAT 与 available-scopes、模块生命周期、Admin/App 构建、认证与权限测试） | ✅ |
| 数据库（空库、多模块幂等、seed/onboard、失败非零、历史 SQL 未改、已部署库衔接隔离演练、未操作生产库） | ✅（现网执行待人工） |
| 工程质量（lint/test/build、集成测试、OpenAPI、TS 基线不增、边界、新增测试、GitHub CI） | ✅ 本地全部；GitHub CI 见 §7 |
| 源码分发（获取、修改、独立运行、预览、不覆盖、可回滚） | ✅ |
| 数据与安全（无工作区丢失、无生产修改、无发布、无密钥、无掩盖失败） | ✅ |

---

## 附录 A：变更文件汇总（`0209993..HEAD`）

85 个文件（新增 26、修改 54、删除 4、重命名 1）；行数中约 3k 行为 Core 迁移快照 JSON。

- Core kernel/platform：`core/{auth/*,module-api.ts,module-loader/*,permissions/catalog.ts,routes/route-registrar.ts,plugins/external/{jwt-auth,rbac,swagger}.ts}`、`app.ts`
- System：`core/services/{auth-provider,module-menu-seed.service,api-token.service,permission.service}.ts`、`core/schemas/api-token.ts`、3 个路由文件、`plugins/app/schemas.ts`（移动）、`scripts/seed/config.ts`（删 4 个 portal JSON）
- 数据库：`drizzle/meta/*`、`drizzle.config.ts`、`db/{client,database-url,migrations-table}.ts`、`scripts/{lib/*,migrate,migrations-bridge,onboard-modules,seed/index}.ts`、`.gitattributes`、`.gitignore`
- demo 模块：7 个文件（只改 import 与注入方式、meta.description、drizzle.config）
- Admin：2 个 locale、2 个生成客户端文件
- 测试：API 15 个文件；scripts 4 个
- 门禁与 CI：`scripts/check-{architecture-boundaries,migrations,module-naming}.mjs`、`scripts/baselines/*`、`.github/workflows/yishan-fullstack-ci.yml`、根与 API `package.json`
- 文档：`CLAUDE.md`、`docs/module-onboarding.md`、`docs/distribution.md`、`docs/plans/yishan-source-first-execution.md`、本报告

## 附录 B：测试统计

| 套件 | 通过 | 失败 | 跳过 |
|---|---|---|---|
| Admin Jest | 63 | 0 | 0 |
| API Vitest（单元） | 325 | 0 | 45（集成，未设置环境变量时跳过） |
| API Vitest（集成，临时库） | 45 | 0 | 0 |
| scripts（node:test） | 16 | 0 | 0 |
| 消费项目（演练，删除 demo 后） | 单元 303 / 集成 31 | 0 | 39 / 14（demo 专用与集成） |

## 附录 C：Codecloud 接入建议（只设计，未读取或修改 codecloud-platform；依据 V2 §1 的只读对比结论）

1. **来源标记**：在 `apps/crm/server/` 与 `apps/console/server/` 旁各放一个 `YISHAN_UPSTREAM.json`（或仓库根一个，pathMap 两条）。CRM 的 base 取其文档记录的 `b0764f4…`；console 无记录，需用文件 blob hash 与 Yishan 历史逐提交比对推定（V2 U7）。`exclude` 列出两副本删除/接管的模块与 `deploy/`。
2. **首轮同步范围**：只同步 kernel 与认证相关（`core/auth/*`、`plugins/external/{jwt-auth,rbac}.ts`、`permissions/catalog.ts`、`routes/route-registrar.ts`、`module-loader/*`、`module-api.ts`、`system-api.ts`、`scripts/lib/*`、`scripts/{migrate,migrations-bridge}.ts`）。两副本中这些文件 V2 时与 Yishan 字节相同，冲突面最小。
3. **迁移**：CRM 已使用 `crm_drizzle_migrations`，与本次约定 `<id>_drizzle_migrations` 一致，可直接纳入；Core 历史在 codecloud 库上先 `db:migrations:bridge` dry-run。
4. **是否共享 kernel**：若 codecloud 决定两个服务端共享同一份 kernel，即触发 §3 的包化条件——在 codecloud 仓库内提取一个 source-only 包（由 codecloud 决定构建方式），Yishan 侧的 `kernel-*` 规则保证可以无改动搬出。
5. **身份**：若 codecloud 有自己的用户中心，提供自己的 `AuthProvider`，不需要改 jwt-auth/rbac。
