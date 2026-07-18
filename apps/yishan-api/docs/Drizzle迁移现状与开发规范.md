# Drizzle 迁移现状与开发规范

> 版本：2026‑07 重构版。配套脚本：`scripts/generate-drizzle-schema.mjs`、`scripts/test-generator.mjs`、`src/scripts/migrate.ts`、`src/scripts/seed/**`。所有路径相对 `apps/yishan-api/`。

## 1. 目标与前提

项目数据库访问层已从 Prisma 迁移至 Drizzle ORM。本文件说明当前开发版本的实际架构、开发约束、迁移收尾项以及已知脚本行为契约。

- 当前项目尚未上线，**不需要处理 Prisma 或历史 Drizzle migration 的生产兼容性**。
- 开发期允许整理、合并、重编号或重建 migration 基线；但基线一旦稳定、被团队拉取使用，**不应再随意修改**已有 migration 文件的命名/顺序/内容。
- 本规范对"代码即文档"的原则不做妥协：所有表名、列名、关系映射必须从 `drizzle/*.sql` 单一真源派生，禁止手工漂移。

## 2. 当前状态

- **ORM**：`drizzle-orm`（mysql2 adapter）。
- **DDL 真源**：`drizzle/*.sql` —— 由 `src/scripts/migrate.ts` 读取并按 `__drizzle_migrations` 表的 `name` + SHA‑256 顺序应用；`drizzle.config.ts` 仅供 `drizzle-kit` / IDE 兼容使用，**不属于 DDL 真源链路**。
- **生成 schema**：`src/db/schema/{tables,relations,index}.ts`，由 `scripts/generate-drizzle-schema.mjs` 全量重写（`writeFileSync`）；文件首行均为 `// Generated from drizzle/*.sql. Do not edit manually.`，禁止手工修改。
- **数据库客户端**：从 `@/db` 导入 `drizzleDb`、`schema`、`pool`、类型 `AppDb` / `AppTx` / `AppQueryDb`、`dbManager`。
- **业务分层**：`Route → Service → Repository → Drizzle`；Repository 同时分布在 `src/core/repositories/` 与各业务模块 `src/plugins/modules/<module>/repositories/`。
- **迁移产物**：`pnpm db:generate` 当前输出 N 张表、M 组关系（M 由生成器日志给出，请勿在文档里硬编码具体数字）。
- **当前 migration 文件清单**（不要随便重排/重命名，下游脚本按文件名 `sort()` 应用）：
  - `0000_initial.sql` —— 核心表（sys_user / sys_role / sys_menu / sys_user_token 等）
  - `0001_portal.sql` —— portal 模块（portal_article / portal_page 等）
  - `0002_shop.sql` —— shop 模块（shop_product / shop_order 等）
  - `0003_rbac.sql` —— RBAC 收尾：`sys_role.code`、`sys_api_token.scopes`

迁移历史上已移除的运行时依赖：`prisma`、`@prisma/client`、Prisma Client 兼容层及其业务调用点。

## 3. 数据库工作流

### 3.1 修改表结构

```bash
# 1) 在 drizzle/ 中新增或调整 SQL migration（沿用 NNNN_xxx.sql 命名）。
# 2) 重新生成 Drizzle schema：
pnpm --filter yishan-api db:generate
# 3) 自检生成器与生成产物（含 tsc --noEmit）：
pnpm --filter yishan-api db:generate:test
# 4) 编译 + 跑测试：
pnpm --filter yishan-api build:ts
pnpm --filter yishan-api test
```

> **约束**：`db:generate` 会整段重写 `src/db/schema/*.{ts}`，任何手工 patch 都会在下次生成时被覆盖。

### 3.2 重整开发期基线

若需要合并 / 删除 / 重编号历史 migration，应同步：

1. 调整 `drizzle/*.sql` 命名与内容；
2. 重新跑 `db:generate` 让 schema 与 SQL 一致；
3. 重跑 `db:generate:test`；
4. 在空 MySQL 数据库上完成 `db:init` 与 `db:seed` 验证。

### 3.3 查询与写入

```ts
import { drizzleDb } from '@/db'
import { sysUser } from '@/db/schema'
import { eq } from 'drizzle-orm'

const user = await drizzleDb.query.sysUser.findFirst({
  where: eq(sysUser.id, userId),
})
```

- **Repository 是数据库查询与写入的唯一入口**。
- **Service 负责业务编排与跨 Repository 事务**：

  ```ts
  await drizzleDb.transaction(async (tx) => {
    await UserRepository.create(input, tx)
    await RoleRepository.assign(userId, roleIds, tx)
  })
  ```

  也可使用 `dbManager.transaction(fn)` 取得等价 `AppTx`。

详细分层要求见 [后端代码架构规范](./后端代码架构规范.md)。

## 4. Schema 生成器契约

为避免"为何我的字段没生成关系"等问题，新增 DDL 时请遵循以下契约：

### 4.1 支持的 SQL 列类型

| SQL 类型        | Drizzle 输出                                  | 备注 |
| --------------- | --------------------------------------------- | ---- |
| `VARCHAR(n)` / `CHAR(n)` | `varchar('name', { length: n })`        | 缺省 `n` 视为 255 |
| `TEXT`          | `text('name')`                                |      |
| `JSON`          | `json('name')`                                |      |
| `DATETIME` / `TIMESTAMP` / `DATE` | `datetime/timestamp/date('name', { mode: 'date' })` |      |
| `DECIMAL(p, s)` | `decimal('name', { precision: p, scale: s })` | 必须带 `(p, s)`，否则 `Bad DECIMAL type` 抛错 |
| `BIGINT`        | `bigint('name', { mode: 'number' })`          |      |
| `BOOLEAN`       | `boolean('name')`                             |      |
| `TINYINT`       | `tinyint('name')`                             |      |
| `INT` / `INTEGER` | `int('name')`                               |      |

> 暂不支持：`ENUM`/`SET`/`BLOB`/`FLOAT`/`DOUBLE`/`BIT`/`TIME`/`YEAR` 等；如确需新增，必须先扩展 `generate-drizzle-schema.mjs::columnType()`，并在 `test-generator.mjs` 中追加对应断言。

### 4.2 默认值

- `CURRENT_TIMESTAMP[(n)]` → `.default(sql\`CURRENT_TIMESTAMP[(n)]\`)`。
- 数字字面量：`DECIMAL` 列必须写为字符串字面量（`.default('0')`），其余列写为数字。
- 字符串字面量：原样嵌入（必须用单引号包裹，脚本不做转义校验，**禁止在默认中嵌入单引号**）。

### 4.3 主键与自增

- 主键识别依赖 `PRIMARY KEY (\`id\`)`（也支持非 `id` 主键），由生成器从 `body` 解析。
- 自增识别依赖 `AUTO_INCREMENT` 关键字；`AUTO_INCREMENT` 必须紧跟类型，否则生成器无法识别。

### 4.4 关系推断四张表

生成器按以下四个映射决定 `relations.ts` 输出；新增字段前请先确认所属映射：

1. **`TABLE_NAME_ALIAS`**：SQL 表名 → TS 导出名。仅一条历史别名：`shop_product_sku → shopSku`。绝大多数表走 `snake_to_camel` 即可。
2. **`FK_MAP`**：FK 列名（如 `user_id`）→ 目标 `sysUser` 等。共 19 条固定映射；其余 FK 列会被**忽略关系**，仅保留标量字段。
3. **`RELATION_KEY_ALIAS`**：将通用的 `creator_id`/`updater_id`/`leader_id` 重命名消费方键为 `creator`/`updater`/`leader`。
4. **`SEMANTIC_RELATION_ALIAS`**：在特定业务表上把 `productId` → `product`、`skuId` → `sku` 等做语义重命名，避免与标量同名字段冲突。

> 上述映射位于 `scripts/generate-drizzle-schema.mjs` 顶部；如需新增条目，**必须同时**给 `scripts/test-generator.mjs` 追加断言，防止悄悄回退。

### 4.5 自引用与多对多

- 自引用（`parent_id` 列）会自动生成 `parent: one()` 与 `children: many()`，仅当 *列名* 为 `parent_id` 时触发（不依赖表名巧合）。
- 复合外键 / 显式 JOIN 表当前需在 `relations.ts` 生成后手工追加；该路径尚未有脚本支持，**应优先通过 §4.6 评审映射** 表达。

### 4.6 DDL 真源评审清单（新增字段前自检）

- 新表 / 新字段是否落在 §4.1 支持集内？
- 外键列名是否已在 `FK_MAP` 中？若否，关系层会缺边，需先评估是否新增别名，还是显式手补 relations。
- 默认值是否会出现单引号或 `CURRENT_TIMESTAMP` 以外的 SQL 表达式（如 `UUID()`、`NOW()`）？若是，需扩展 `renderDefault()`。
- 是否涉及复合主键 / 复合外键？若是，请走显式手补路径，并同步更新 §6 完成度。

## 5. 必须遵守的约束

- 不引入 `prisma`、`@prisma/client` 或 Prisma Client 兼容层；存量 Prisma 字符串仅允许出现在 `deploy/fc3/.build/` 等历史构建产物中。
- 不手工编辑 `src/db/schema/` 下任何文件。
- 不在 Route 中直接使用 `drizzleDb` 或编写 SQL/ORM 查询。
- 不在 Service 中散落单表 CRUD；所有表级读写必须经对应 Repository。
- 涉及多个写操作时，由 Service 持有事务并把 `AppTx` 透传给 Repository；Repository 的最后一个参数约定为可选 `tx?: AppQueryDb`。
- 新增 / 重命名 / 删除 migration 文件后，必须重跑 `db:generate` + `db:generate:test`。
- 生成器映射表（`TABLE_NAME_ALIAS` / `FK_MAP` / `RELATION_KEY_ALIAS` / `SEMANTIC_RELATION_ALIAS`）修改必须同步 `test-generator.mjs` 断言。

## 6. 当前待优化项

### P1：迁移文件清单自动发现

`scripts/test-generator.mjs` 当前硬编码读取 `drizzle/0000_initial.sql`、`drizzle/0001_portal.sql`、`drizzle/0002_shop.sql` 三个文件名。文档约束要求"新增 migration 自动覆盖"，但实现与此相反，是已知倒退风险。

整改方向：

- 将测试断言改为 `readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()`；
- 把 §4.4 中所有映射的覆盖断言迁入同一份扫描逻辑；
- 增加"新增 `drizzle/N+1_*.sql` 后断言失败"的负向用例。

### P1：收紧 schema 生成器的关系推断

当前生成器按 FK 列名 + `FK_MAP` + 语义别名推断 relations，对复合外键、不规则命名（如新的产品 / SKU/分类映射）容易漏边。

整改方向：

- 必要时把关键关系改为显式 `relations.config.ts` 输入，与生成器互补；
- 为每条推断边增加完整性断言（生成器与测试器共用同一份 `extractFks()`）；
- 覆盖反面用例：`category_id` 在 `portal_*` 与 `shop_*` 表上分别指向不同父表，需确保现有 `category_id` 分流逻辑被覆盖。

### P1：真实 MySQL 集成测试

现有路由层 Vitest 主要 mock 数据库，无法验证：

- 空库执行全部 migration；
- `db:seed` 可执行；
- 关键 CRUD + 分页查询；
- 事务回滚；
- SQL schema ↔ Drizzle schema 结构一致性（列数、列类型、UNIQUE 索引）；

应至少引入一个 MySQL 容器（或测试库），覆盖以上场景并接入 CI。

### P1：实现架构门禁

根目录 `pnpm arch:check` 目前由 `scripts/arch/{check-routes,check-manifest,check-boundaries}.mjs` 三段组成，**当前三段均为占位**（仅打印 `[arch] xxx: no custom guard configured, skipped`）。

整改方向：

- `check-routes.mjs`：禁止 Route 中 `from '@/db'` 直接 import、禁止引入 Prisma。
- `check-manifest.mjs`：校验 Service / Repository 自动注册清单与目录实际文件一致。
- `check-boundaries.mjs`：Core 不允许反向依赖 plugin；plugin 之间不允许跨模块 import；新增一项 `prisma` 包名禁现。

CI 接入：`lint` 阶段或单独的 `ci` 任务调用 `pnpm arch:check`。

### P2：统一文档

仍有 Prisma 描述的文件：

- `apps/yishan-api/README.md`（顶部"采用 Prisma ORM"、技术栈、模型层等段落）。
- `apps/yishan-docs/docs/api/structure.md`、`api/overview.md`、`api/stack.md`、`intro.md`。
- `docs/architecture/*`、`specs/002-app-ui-upgrade/*`、`YISHAN_API_ADMIN_AUDIT.md`、`AGENTS.md`。
- `apps/yishan-api/deploy/fc3/README-layer.md`（与构建产物耦合的旧说明）。
- `apps/yishan-api/.gitignore` 中残留的 `generated/prisma/` 路径已无意义，可整理。

应将上述位置统一替换为 §3 定义的工作流，并按"历史文件 / 当前实现 / 引用关系"分层；旧方案文档加废弃标记并指向本规范，避免误导。

### P2：drizzle-kit 链路收敛

`drizzle.config.ts` 当前未被 `db:migrate` 使用。建议二选一：

- 将 `db:migrate` 迁移到 `drizzle-kit migrate`（并以 hash 列做附加校验），或
- 将 `drizzle.config.ts` 与 `drizzle-kit` 仅保留为 IDE 提示，并明确标注其不参与 DDL 真源。

### P3：CLI 与一致性体验

`yishan-api` 子包已具备 `cli` / `cli:dev`，但文档尚未说明其与 Drizzle 工作流的关系（db:seed 调用方式、db:reseed 等价命令）。

## 7. 开发期迁移完成标准

满足以下条件后，可视为 Prisma → Drizzle 迁移收尾完成：

1. `drizzle/*.sql` 是唯一 DDL 真源，并能在空 MySQL 上完整初始化。
2. `db:generate` 与 `db:generate:test` 自动覆盖全部 migration，无硬编码文件名。
3. `src/db/schema/` 不存在手工漂移；`build:ts` 与 `test` 通过。
4. 关键业务具备真实 MySQL 集成测试，覆盖 migration、CRUD、事务、回滚。
5. CI 存在有效的 `arch:check`、分层与依赖边界检查。
6. 所有面向开发者的文档（项目 README、API README、Docusaurus、架构 ADR、部署说明）不再把 Prisma 作为当前技术实现；旧方案文档归档并标注废弃。

## 8. 常用命令

> 全部以 monorepo 根目录执行为准；括号内为等价子包级调用。

```bash
# --- 生成与自检（DDL 真源链路核心）---
pnpm db:generate     # (pnpm --filter yishan-api db:generate)
                     # 从 drizzle/*.sql 重写 src/db/schema/*.{ts}
pnpm db:generate:test # (pnpm --filter yishan-api db:generate:test)
                     # 8 类断言 + tsc --noEmit

# --- 编译与测试 ---
pnpm build:api       # (pnpm --filter yishan-api build:ts)
pnpm test            # (pnpm --filter yishan-api test)
pnpm arch:check      # 根级门面，串行执行 routes/manifest/boundaries

# --- 数据库初始化（在空库或重置场景）---
pnpm db:init         # db:generate && db:migrate
pnpm db:seed         # 跑 src/scripts/seed/* 初始化数据
pnpm db:seed:regions # 仅导入行政区划数据
pnpm db:reseed       # db:migrate && db:seed

# --- CLI（已构建后）---
pnpm --filter yishan-api cli -- --help
pnpm --filter yishan-api cli:dev -- --help   # 等价于 cli（跑 ts-node）
```

### FC3 生产迁移执行器

生产环境不允许主 API 在启动时自动执行 DDL。CI 会将 `src/infrastructure/migrations/` 打包成一个临时、仅内部调用的 FC Custom Runtime：

| 文件 | 职责 |
| --- | --- |
| `runner.ts` | 调用 `inspectMigrations`、`runMigrations` 或 `resetDatabaseAndSeed`，分别支持 `dry-run`、`apply`、`reset-and-seed`。 |
| `server.ts` | 对 FC 的 `GET` 健康检查返回 200，并将 invocation 的 `POST` 事件转交给 `runner.ts`。 |

函数 handler 为 `infrastructure/migrations/runner.handler`，启动命令为 `node ./infrastructure/migrations/server.js`。工作流在迁移成功后删除该临时函数；部署配置见 `deploy/fc3/s-migration-runner.yaml`。

> `pnpm db:reset` 在根 `package.json` 已声明，但 `yishan-api` 子包当前未实现对应脚本。调用会报错；如确需"删库重建"，请走 `db:init && db:seed` 或补充子包 `db:reset` 后再恢复该别名。

## 9. 故障排查速查

| 现象                                              | 根因 / 处置 |
| ------------------------------------------------- | ----------- |
| 生成器报 `Bad DECIMAL type`                       | `DECIMAL` 列漏写 `(p, s)`；补全精度与刻度。 |
| `relations.ts` 没有期望的 `one(xxx)`              | FK 列名不在 `FK_MAP` 内；要么改字段名，要么加映射，要么在 `SEMANTIC_RELATION_ALIAS` 中显式补边。 |
| `tsc --noEmit` 在 schema 上失败                   | 多为不识别类型落入 `int` 的兜底导致类型不匹配；按 §4.1 扩展类型映射并加断言。 |
| `test-generator` 报"unknown assertion"            | 检查是否改动了 SQL 但未跑 `db:generate`；先生成再测。 |
| `db:migrate` 报 migration 哈希不一致               | 既有 migration 被改内容；按 §3.2 处理（重置基线或回滚 SQL 改动）。 |
| 服务启动时 health check 失败但直连 MySQL 正常      | 多数为 `.env` 中 `DATABASE_HOST`/`DATABASE_PORT` 漂移；核对 `client.ts::buildDatabaseUrl`。 |
