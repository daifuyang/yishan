# P0-6 数据库迁移专项验证

> 环境：一次性 Docker 容器 `mysql:8.4`（8.4.11）+ `redis:7.4-alpine`，标签 `purpose=yishan-p0-temp`，只绑定 `127.0.0.1`，root 密码为本次临时生成；**未读取任何 `.env` 或生产凭据**（worktree 内不存在 `.env`），未连接 `mysql-local` 等已有容器。每个场景使用独立数据库名。
> 代码：`all@e4a08d3` 的 `apps/yishan-api`（已 `build:ts`）；`main@6a5c62a` 通过 `git archive` 导出到临时目录后执行。
> 工具：drizzle-orm 0.44.7、drizzle-kit 0.31.10、mysql2 3.15.3。
> 脚本：[`scripts/migration-repro.sh`](scripts/migration-repro.sh)、[`scripts/db-inspect.cjs`](scripts/db-inspect.cjs)（按 drizzle 的 `sha256(SQL 文件全文)` 把 `__drizzle_migrations.hash` 反查到 `core/<tag>`、`<module>/<tag>`）。日志：[`evidence/db/`](evidence/db/)。

状态口径：**CONFIRMED** 已在隔离库实际复现；**CODE-CONFIRMED** 源码确认、未运行复现；**UNVERIFIED** 仍需验证；**NOT REPRODUCED** 已执行但未复现。

## 1. 结论总览

| # | 问题 | 状态 | 证据 |
|---|---|---|---|
| M1 | Core 与全部模块未配置 `migrations.table`，共用 `__drizzle_migrations` | **CONFIRMED** | S4 中 demo/portal/shop/core 5 行写入同一张表（`evidence/db/s4-modules-first.log`） |
| M2 | migrator 只执行 `folderMillis > max(created_at)` 的迁移 | **CONFIRMED** | `node_modules/drizzle-orm/mysql-core/dialect.js:39-52`；S1/S6 行为与之一致 |
| M3 | 新库先跑 Core，模块 `0000_init` 被静默跳过且退出码 0 | **CONFIRMED**（all、main 均复现） | S1、M1 场景 |
| M3′ | 模块之间同样互相跳过（时间戳较早的模块被较晚的模块挡住） | **CONFIRMED**（新发现） | S6：先 shop 后 portal → portal 5 张表全部缺失，退出码 0 |
| M4 | `sys_module_migration` 按 tag 跨模块去重，第二个起的模块不记录 | **CONFIRMED** | S2b、smoke 库：只有 `demo/0000_init` 一行；portal/shop 输出“journal 已全部记录” |
| M5 | 模块表不存在，但记账显示迁移完成 | **CONFIRMED** | S2b：`sys_module_migration` 记录 demo 已迁移，库内无 `demo_todos` |
| M6 | 存在绕过历史表的建表路径（`scripts/apply-drizzle-sql.mjs` + `SKIP_DRIZZLE_MIGRATE=1`） | **CODE-CONFIRMED** | 脚本硬编码 `docker exec mysql-local`；文档 `apps/yishan-docs/docs/quick-start/{environment,run}.md` 推荐。未执行（会写入共享容器） |
| M7 | runner 用 tag 对比 hash，且查询不存在的 `name` 列 | **CONFIRMED** | S5：`RUNNER ERROR: Unknown column 'name' in 'field list'`；dry-run 与 apply 都先调用 `inspect()`，两种模式均不可用 |
| M8 | Core `0010_create-sys-enum.sql` 未登记 journal，且 `0002_init` 已建 `sys_enum` | **CONFIRMED** | 两文件建同名表与同名索引；现有集成测试的 setup 逐个执行 `drizzle/*.sql` → `Duplicate key name 'idx_sys_enum_type_enabled_sort'`，3 个集成测试文件 0 用例执行 |
| M9 | DB URL 拼接多处重复 | **CODE-CONFIRMED** | 10 个文件读取 `DATABASE_URL/DATABASE_HOST`：根与 4 个模块 `drizzle.config.ts`、`src/db/client.ts`、`src/config/index.ts`、`core/plugins/external/database.ts`、`src/scripts/reset.ts`、`scripts/repair-crm-demo.mjs`；模块配置未设置时默认库名 `yishan`，根配置默认空库名，行为不一致 |
| M10 | `db/client.ts` import 期建池 | **CODE-CONFIRMED** | `src/db/client.ts:25-36` |
| M11 | 下游 CRM 已改用独立迁移表 | 未验证（P0 不访问 codecloud） | 仅引用 V2 结论 |
| O1 | **`db:seed` 的模块入驻步骤在所有平台必然失败**（新发现） | **CONFIRMED**（all、main 均存在） | `onboard-modules.ts:52-53` 的 `import(pathToFileURL(...).href)` 被 `module: commonjs` 编译为 `require('file:///...')`（`dist/scripts/onboard-modules.js:51-52`）；S2：`Cannot find module 'file:///…/scripts/module-pack.mjs'`，`db:seed` 退出码 1，模块迁移、记账、模块 seed 全部未执行 |
| J1 | demo `drizzle/meta/0000_snapshot.json` 与 SQL/Schema 不一致（快照描述 `demo_documents`，SQL 与 schema 为 `demo_todos`；手写 id `b1e2c3a4-1111-…`） | **CONFIRMED**（新发现） | 在临时副本执行 `drizzle-kit generate`：`0000_snapshot.json data is malformed`，**退出码 0** 且不生成任何文件 |
| J2 | CRM journal：`when` 非单调（idx 6–12 共 7 项早于 idx 5 的 1788913800000）；44 个 SQL 中 10 个未登记 journal（`0010_crm-customer-enum-codes`、`0011_crm-contact-role-status`、`0012_crm-activity-polymorphic`、`0013_*`、`0031_*`、`0032_*`、`0040_*`、`0041_*`、`0050_*`、`0051_*`），且与已登记文件存在同序号前缀 | **CODE-CONFIRMED** | `src/modules/crm/drizzle/`。CRM `meta.enabled=false`，不参与当前迁移；在临时副本执行 generate 需要交互确认（rename 推断），说明快照链与 schema 已不一致 |
| J3 | main：Core `drizzle/meta/` 被 `.gitignore` 排除；不先 generate 则 `db:migrate` 退出码 1；`db:generate`（main 无 `--name=init`）生成随机名 `0000_<random>.sql`，`when` = 运行时刻 | **CONFIRMED** | M1 场景：生成 `0000_colorful_namor.sql`（内容与已提交 `0000_init.sql` 字节相同，hash 与之相同，但 `created_at` 每次不同）→ 每个环境的 Core 历史不可复现，且必然晚于任何模块 → M3 必然发生 |

Core journal（all）与 SQL：`0000_init`、`0002_init` 已登记且文件存在；`idx` 跳过 1；临时副本内 `drizzle-kit generate` 输出 `No schema changes`，即 **Core schema 与快照无漂移**；portal/shop 同样无漂移。

## 2. 场景与实际结果

| 场景 | 步骤（按真实入口） | 结果 | 日志 |
|---|---|---|---|
| S1 CI 顺序（all） | 新库 → `pnpm db:migrate`（CI “API Schema Migrate”）→ 按 onboard 方式在 demo/portal/shop 目录执行 `drizzle-kit --config=./drizzle.config.ts migrate` | Core 27 张 `sys_*` 表 + 2 行历史；三个模块均打印 `migrations applied successfully!`、退出码 0，**但 0 张模块表、0 行新历史** | `s1-ci-order.log` |
| S2 运维路径 `db:seed`（all） | 新库 → `node dist/scripts/seed/index.js` | Core 迁移与 seed 成功（admin、菜单、3429 条地区）；Step 2 onboard 抛出 O1，`db:seed` 退出码 1；`sys_module`、`sys_module_migration` 为空 | `s2-seed.log` |
| S3 重跑 `db:seed` | 同库再执行 | 同样在 O1 处失败（确定性） | `s3-seed-rerun.log` |
| S2b 绕过 O1 观察后续逻辑 | S2 + 测试专用 `--require fileurl-require-shim.cjs`（只把 `file://` 说明符转为路径，**不改产品代码**） | demo：“迁移完成，新增 1 条 journal 记录”，但无 `demo_todos`；portal、shop：“journal 已全部记录”；portal seed 因 `portal_categories` 不存在失败；`sys_module` 3 行 enabled=1 | `s2b-seed-shim.log` |
| S3b 幂等 | S2b 同库重跑 | Core 不重复执行；菜单 upsert 为 update；状态与 S2b 完全一致 → **幂等但稳定地处于错误状态** | `s3b-seed-shim-rerun.log` |
| S4 对照：模块先于 Core | 新库 → demo、portal、shop → Core | 42 张表全部存在，`__drizzle_migrations` 5 行（3 模块 + 2 Core） | `s4-modules-first.log` |
| S6 对照：shop 先于 portal | 新库 → shop → portal | 只有 8 张 `shop_*`；portal 被跳过，退出码 0 | `s6-shop-before-portal.log` |
| S5 runner dry-run | 对 S2 库执行 `runner.handler({mode:'dry-run'})` | `Unknown column 'name' in 'field list'` | `s5-runner-dryrun.log` |
| smoke 库（all） | 模块先迁移 → `db:seed`（shim） | 42 张表；`sys_module_migration` 仍只有 `demo/0000_init` 一行（M4 独立于 M3 成立） | `smoke-provision.log` |
| M1 main CI 顺序 | 导出副本：`db:migrate`（无 journal）→ `db:generate` → `db:migrate` → demo migrate | 第一次 migrate 退出码 1；generate 产生随机名迁移；demo 被跳过（无 `demo_todos`） | `m1-main-ci-order.log` |
| M2 main smoke 库 | demo 先迁移 → `db:seed`（shim） | 28 张表；`sys_module_migration` 1 行 | `m2-main-smoke-provision.log` |

真实 CI（`all`）的数据库步骤只有 `db:generate` + `db:migrate`（Core），**没有任何模块迁移步骤**；随后的 OpenAPI 启动检查不访问模块表，因此 CI 无法发现 M3/M4/O1。

## 3. 风险报告（已确认问题）

| 问题 | 根本原因 | 触发条件 | 当前影响 | 可能影响的模块 | 推荐修复 | 涉及已部署库？ | 修复前必须具备的保护 |
|---|---|---|---|---|---|---|---|
| M1+M2+M3/M3′ | 多条独立迁移流共用一张“只看最大 created_at”的历史表 | 任何库中已有更晚时间戳的迁移（Core 或其他模块）后再迁移某模块 | 新库按 CI/文档顺序初始化时，所有模块表缺失而命令成功；新增模块或下游模块迁移在已有库上同样会被跳过 | demo、portal、shop、crm 以及任何新模块 | 每模块独立 `migrations.table`（Drizzle 官方配置）+ 已有库衔接脚本（只插不删、默认 dry-run）；短期可加 CI 守卫：模块迁移后校验 schema 中的表都存在 | **是**——已部署库的历史行可能混有模块 hash，或模块表由 `apply-drizzle-sql` 建立 | 对已部署库只读导出 `__drizzle_migrations`、`sys_module_migration`、`information_schema.tables`；在库副本演练；人工确认（D6） |
| M4/M5 | `inArray(sysModuleMigration.hash, tags)` 未带 `module_id` 条件；记账在 drizzle-kit 退出码 0 后无条件进行 | 第二个及以后入驻的模块 / 模块表未真实创建 | 模块管理界面的迁移状态失真 | 全部模块 | 查询改为 `(module_id, hash)`；记账前校验 journal 中的 hash 已在该模块历史表中 | 是（展示数据） | 同上；先只读统计现网 `sys_module_migration` 行数与模块数 |
| O1 | TS `module: commonjs` 将动态 `import()` 降级为 `require()`，`require` 不接受 `file://` URL | 任何平台执行 `db:seed`（Step 2）或单独执行 `dist/scripts/onboard-modules.js` | 文档化的初始化入口失败；所有模块的迁移、seed、`sys_module` 同步均未执行 | 全部模块 | 改用 `require`/`createRequire` 加载 `.mjs` 之外的实现，或把 `module-pack` 改为 CJS；需要源码修改，P0 不做 | 否（初始化脚本） | 修复后在空库重跑 S2，并确认 M3/M4 已一并处理，否则修复 O1 会把 M4/M5 的错误状态暴露为“成功” |
| M7 | runner 查询 `name` 列；tag 与 hash 比较 | FC 迁移工作流 `yishan-fc-migrate.yml`（仅 `workflow_dispatch`） | dry-run/apply 均失败——**未造成错误写入**，但该入口不可用 | Core + 全部模块 | 修复或明确弃用该入口（V2 建议） | 是（若曾成功执行过旧版本） | 先确认现网是否曾通过该入口迁移（U3） |
| M8 | 同一 DDL 存在于两个 SQL 文件，一个未登记 journal | 任何“执行目录下全部 SQL”的工具（集成测试 setup、`apply-drizzle-sql`、手工） | 现有 API 集成测试全部无法运行 | Core（`sys_enum`） | 不修改已发布 SQL；集成测试改为按 journal 执行或使用 drizzle migrator | 待确认（现网是否手工执行过 0010） | 只读核对现网 `sys_enum` 及索引 |
| J1 | demo 快照为手写数据，与 SQL 不一致 | 修改 demo schema 后执行 `drizzle-kit generate` | generate 静默不产生迁移（退出码 0），schema 变更可能无迁移 | demo（模块模板/参考实现） | 在不改动已发布 `0000_init.sql` 的前提下重建快照（需人工确认流程） | 否 | 记录 demo 现有表结构快照（见 smoke 库） |
| J2 | 多分支并行开发导致 journal 时间戳与序号冲突 | 重新启用 CRM（`meta.enabled=true`）并在已有库执行 migrate | `when` 早于前一项的迁移（idx 6–12）在已执行过 idx 5 的库上被跳过；未登记的 SQL 永不执行 | crm（当前未打包） | CRM 已外迁 codecloud；Yishan 侧确定 CRM 去留（D3）后再处理 | 若 all 现网曾启用 CRM：是 | 只读核对现网 crm 表与历史 |
| J3 | main 未提交 Core journal，CI 每次 generate | main 的任何新环境 | Core 历史 `created_at` 因环境而异；与 all 的 `0000_init`（固定 when）不兼容 | Core + demo | 提交与 `0000_init.sql` 对应的 journal/snapshot（core-merge 分析 §7 已建议） | main 未部署（CD 只从 all 部署） | 无 |

## 4. 未验证 / 未执行

- **现网/测试库状态（U2、U3、U8）**：P0 不接触任何真实数据库，无法判断已部署库是否已出现 M3/M5、是否混有模块 hash、模块表由哪条路径建立。只读核对需要维护者提供只读账号，建议 SQL：
  ```sql
  SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id;
  SELECT module_id, hash, applied_at FROM sys_module_migration ORDER BY id;
  SELECT id, enabled, version FROM sys_module;
  SELECT table_name FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name REGEXP '^(demo|portal|shop|crm)_';
  ```
  将 hash 与 `db-inspect.cjs` 计算的各 journal 条目 hash 对照即可判断每条历史属于哪条迁移流。
- `apply-drizzle-sql.mjs`（M6）：脚本固定写入 `mysql-local` 容器，执行即违反隔离要求，未运行。
- FC 迁移工作流与 runner 的 apply 模式：未运行（会调用部署环境）；dry-run 已在隔离库复现失败。
