# Module 入门指南

> 这份文档面向第一次在 Yishan 上写"按业务拆分的可插拔模块"的开发者。
>
> 读完之后你应该能：自己照着 demo 模块的样子，30 分钟内新建一个业务模块并跑通。

## 一句话总览

每个业务能力 = `apps/yishan-api/src/modules/<id>/` 下一个目录。
该目录自带：路由、表定义、drizzle 配置、drizzle 输出、repository、service、schema、测试、README。
**程序不跑迁移**；表、路由、查询全是模块自己的事。
Core 只提供三件基础设施：Fastify 实例、`app.drizzleDb` 句柄、几个 hook（用于命名校验）。

## 命名约定（先记这个）

| 项 | 规则 | 谁来校验 |
| --- | --- | --- |
| `meta.id` | 全局唯一；小写字母 + 数字 + 下划线；≤ 24 | 启动期 |
| 路由 `prefix` | 默认 `/api/<id>`；自定义时必须全局唯一 | 启动期（Fastify `onRoute`） |
| 表名 | 必须以 `<meta.id>_` 开头 | `scripts/check-module-naming.mjs` |
| 前端菜单 `path` | `/<id>/...`,**不要**带 `/modules/` 前缀;`<id>` 段必须与 `meta.id` 严格对齐 | code review |

违规后果：
- 启动期撞 id 或 prefix → 服务起不来，`exit 1`
- 表名不对 → `pnpm lint` 退 1
- 跨模块表名重复 → `pnpm lint` 退 1

## 步骤 1：创建模块目录

```bash
mkdir -p apps/yishan-api/src/modules/<id>/{db,drizzle/meta,repositories,services,schemas,tests}
```

`<id>` 用业务名（单数小写），决定：
- meta.id = `<id>`
- 默认 prefix = `/api/<id>`
- 表前缀 = `<id>_`

## 步骤 2：四个最小文件

### `db/schema.ts` —— Drizzle 表定义

```ts
import { int, mysqlTable, varchar, datetime, sql } from 'drizzle-orm/mysql-core'

export const <id>Sample = mysqlTable('<id>_sample', {
  id: int().primaryKey().autoincrement().notNull(),
  name: varchar({ length: 100 }).notNull(),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
})
```

> 表名必须以 `<id>_` 开头。

### `drizzle.config.ts` —— module 自带 drizzle-kit 配置

```ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { LOCAL_DEV_DATABASE_URL, resolveDatabaseUrl } from '../../db/database-url'
import { moduleMigrationsTable } from '../../db/migrations-table'

export default defineConfig({
  dialect: 'mysql',
  schema: './db/schema.ts',
  out: './drizzle',
  // 每个模块独立的迁移历史表 `<id>_drizzle_migrations`（不与 Core / 其他模块共享，P0 R-01）。
  // `pnpm check:migrations` 会检查这一行。
  migrations: { table: moduleMigrationsTable('<id>') },
  dbCredentials: { url: resolveDatabaseUrl() ?? LOCAL_DEV_DATABASE_URL },
})
```

### `module.ts` —— 只导出 meta

loader 只读 `meta`，不会 register 这个文件里的其它导出。路由放在 `routes/`。

```ts
export const meta = {
  id: '<id>',          // 必须等于目录名；/^[a-z][a-z0-9_]{0,23}$/，不合法启动即失败
  enabled: true,       // 装载开关；false 则不编译、不 sync、不 mount、不迁移。缺省 true
  description: '...',  // 可选：OpenAPI 中 `<id>` tag 的描述（Core 不再硬编码模块 tag）
}
```

> 路由 prefix 硬约定为 `/api/${meta.id}`，由 `moduleRoutePrefix()` 生成，模块不再声明。保持 meta 为扁平对象（构建脚本用正则读取 `enabled`）。

### `drizzle/0000_init.sql` —— 建表 SQL

模块自带 SQL，drizzle-kit 跑时直接执行：

```sql
CREATE TABLE `<id>_sample` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`)
);
```

加一份 `drizzle/meta/_journal.json`（drizzle-kit 格式）。已发布的 SQL 永远不改；新迁移只追加，且 `when` 必须严格递增（`pnpm check:migrations` 校验，新文件评审后 `node scripts/check-migrations.mjs --update` 登记）。

## 步骤 3：装上 repositories / services / schemas / tests

业务复杂了再装。可参见 `apps/yishan-api/src/modules/demo/`：

| 文件 | 装什么 |
| --- | --- |
| `repositories/*.ts` | 该模块**唯一**执行 SQL、import 本模块 `db/schema` 的层；db 句柄由调用方传入 |
| `services/*.ts` | 业务编排；构造注入 db 句柄（路由里 `new XService(app.drizzleDb)`）、调 repository |
| `seed.ts` | 可选；default 导出 `(ctx: ModuleSeedContext) => Promise<void>`，菜单用 `seedModuleMenus(tree, ctx.db)` 登记 |
| `schemas/*.ts` | TypeBox HTTP schema |
| `tests/*.ts` | vitest 单测；service 用 `vi.spyOn` 拦 repository |

## 步骤 4：生成与执行 migration（手动）

```bash
cd apps/yishan-api/src/modules/<id> && npx drizzle-kit generate --config=./drizzle.config.ts   # 改 schema 后
pnpm --filter yishan-api db:migrate:modules <id>   # 执行：独立历史表 + 历史核对 + 真实表结构核对，失败退出码 1
```

> 模块启动时**不**自动跑迁移。`db:migrate:modules` 与 `drizzle-kit migrate --config=...` 读写同一张历史表，但前者会核对结果。
> 已部署过旧版本（共享 `__drizzle_migrations`）的库，先跑 `pnpm --filter yishan-api db:migrations:bridge`（默认 dry-run）。

## 步骤 5：装载与流量

两层开关：

- `meta.enabled`：装载。`false` 时启动跳过该模块（不写 `sys_module`、不挂路由）。改完要重新发版。
- `sys_module.enabled`：流量。只对已装载模块生效；toggle 即时 404，重启不覆盖。

首次 INSERT 流量默认开启。不装这个模块，把 `meta.enabled` 设为 `false`。

## 步骤 6：启动与验证

```bash
pnpm --filter yishan-api dev
```

按 `/api/<id>` 暴露的路径调用即可。

## 关键约束清单

- ✖ 模块只能从 `@/core/module-api`（kernel 契约：`registerPermissions`、`registerPermissionGroups`、`createRouteRegistrar`、`ResponseUtil`、`BusinessError`、`AppDb` 类型等）与 `@/core/system-api`（system 开放能力：`seedModuleMenus`）导入 Yishan 代码；不许 import `@/db`、`core/services`、`core/repositories` 等内部文件（`pnpm check:boundaries` 的 `module-imports-internal` 规则）。数据库句柄用 `app.drizzleDb`，当前用户用 `request.currentUser`（模块只应依赖 `id`）
- ✔ 匿名接口在权限声明上写 `public: true`；权限分组展示名用 `registerPermissionGroups({ id: '<id>', label })` 自己登记
- ✖ 不许在 `services/` / `module.ts` 直接写 SQL —— 走 `repositories/`
- ✖ 不许改 Core 表（`sys_*` 全部不许动）
- ✖ 不许跨模块 join 别的模块的表 —— 走 HTTP / Core extension
- ✖ 不许建 `sys_*` 表（即使模块内）
- ✖ **schema 与数据初始化一律走 CLI，不暴露 HTTP**——参见下方「运维 / 开发工具边界」
- ✔ 表名必须以 `<meta.id>_` 开头（`pnpm lint` 卡死）
- ✔ `meta.id` 全局唯一（启动期 fail-fast），`prefix` 硬约定 `/api/${meta.id}` 不再声明
- ✔ 入口只放在 `module.ts` 一个文件，业务复杂再做拆分
- ✔ 前端菜单 `path` 用 `/<id>/...` 直挂在根下（例：`/demo/quickstart`），**禁止**再加 `/modules/` 命名空间——`modules/` 只是源码目录约定，不出现在 URL 里

## 运维 / 开发工具边界

模块管理后台（`/admin/system/module-management`，dev-only 页面）只做一件事：**启停**（list + toggle）。
schema 生成、迁移、seed、reset 都不暴露 HTTP，全部走 CLI。理由：

| 动作 | 入口 | 触发风险 |
| --- | --- | --- |
| 启停模块 | HTTP（toggle） | 低：只改 `sys_module.enabled`，即时 gate 拦截，无副作用 |
| 生成迁移文件 | CLI（`npx drizzle-kit --config=... generate`） | 写源码，多人并发会冲突 |
| 应用迁移 | CLI（`db:migrate:all` / `db:migrate:modules`，或 `db:seed` 走 onboard-modules） | 改表结构，受控流程 |
| seed 数据 | CLI（同上，onboard-modules 第二步） | 写业务数据，受控流程 |
| DROP / 重建 | CLI（`pnpm --filter yishan-api db:reset`，仅 dev） | 毁数据，必须显式 + NODE_ENV≠production |

dev-only 路由树（`core/routes/_dev/`）在 `NODE_ENV=production` 时整棵不挂载，但这一层只是兜底；
分类标准（什么走 HTTP、什么走 CLI）必须显式遵守，不能依赖 prod 自动屏蔽作为安全护栏。

CI / 部署侧用：

```bash
pnpm --filter yishan-api db:generate   # 改 Core schema 后生成迁移（Core drizzle/meta 已提交）
pnpm --filter yishan-api db:migrate:all            # Core + 全部已打包模块，执行后核对
pnpm --filter yishan-api db:migrations:bridge      # 旧版本已部署库：只读诊断 + 衔接计划（--apply 才写）
pnpm --filter yishan-api db:seed       # 上线首次部署：migrate + seed + sync sys_module
pnpm --filter yishan-api db:reset      # 仅 dev：重建数据库
```

## 完整 demo

参考 `apps/yishan-api/src/modules/demo/`：
- `GET  /api/demo/server-info` — 不读库，拿到当前进程信息
- `GET  /api/demo/documents` — 读库
- `POST /api/demo/documents` — 写库（TypeBox 校验）

## 前端模块页面约定（admin）

每个后端模块对应一个 admin 子目录，路径硬约定：

```
apps/yishan-admin/src/modules/<id>/pages/<page>/index.tsx
```

`apps/yishan-admin/plugin.ts` 编译期扫描这个目录，生成 `moduleComponentsMap`：注册 key `./modules/<id>/<page>` → 真实 import `@/modules/<id>/pages/<page>`。

菜单 JSON 的 `component` 字段用虚拟路径，例如：

```json
{
  "type": 1,
  "name": "文章管理",
  "path": "/portal/articles",
  "sortOrder": 2,
  "component": "./portal/articles",
  "children": [
    { "type": 2, "name": "查看", "permissionCodes": ["portal:article:list"], "sortOrder": 1, "hideInMenu": 1, "isDefaultAction": 1 }
  ]
}
```

页面写法参考 `apps/yishan-admin/src/modules/demo/pages/todos/index.tsx`：ProTable + ModalForm + Popconfirm 三件套。调用 `@/services/generated/<module>.ts` 里的 openapi 自动生成函数，类型与后端 schema 同步。

**关键点**：
- 虚拟路径 `./modules/<id>/<page>` 必须带 `./modules/` 前缀（demo 已用此写法；portal/shop 早期漏了导致 404，见 commit `0023d2f` 的修复）
- URL 路由 (`path`) 仍是 `/<id>/<page>`，不带 `./modules/`——`modules/` 只是源码目录约定 + 组件虚拟路径前缀，不出现在 URL 里
- 新增页面后无需手动注册——`plugin.ts` 自动发现 `src/modules/<id>/pages/<page>/index.tsx`
- 改后端 schema 后需要 `pnpm --filter yishan-admin openapi` 重新生成 services，否则页面 TS 报错
