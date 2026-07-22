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

const url =
  process.env.DATABASE_URL ??
  `mysql://${process.env.DATABASE_USER ?? 'root'}:${process.env.DATABASE_PASSWORD ?? ''}@${
    process.env.DATABASE_HOST ?? 'localhost'
  }:${process.env.DATABASE_PORT ?? '3306'}/${process.env.DATABASE_NAME ?? 'yishan'}`

export default defineConfig({
  dialect: 'mysql',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
})
```

### `module.ts` —— 入口插件

```ts
import fp from 'fastify-plugin'
import { <id>Sample } from './db/schema.js'

export const meta = {
  id: '<id>',
  enabled: true,                            // 可选；缺省 true。首次 sync 进 sys_module 的兜底值
}

export default fp<{ moduleId: string }>(async (app, opts) => {
  const moduleId = opts.moduleId

  // 把 moduleId 写到每条路由的 config，供 Core 的 onRoute 拦截器用
  app.addHook('onRoute', (route) => {
    route.config = { ...(route.config ?? {}), moduleId }
  })

  // 业务路由：通过 app.drizzleDb 访问数据库
  app.get('/list', async () => {
    return app.drizzleDb.select().from(<id>Sample)
  })
})
```

> 路由 prefix 硬约定为 `/api/${meta.id}`，由 `moduleRoutePrefix()` 生成，模块不再声明。

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

加一份 `drizzle/meta/_journal.json`（drizzle-kit 格式）。

## 步骤 3：装上 repositories / services / schemas / tests

业务复杂了再装。可参见 `apps/yishan-api/src/modules/demo/`：

| 文件 | 装什么 |
| --- | --- |
| `repositories/*.ts` | 该模块**唯一**允许 import drizzleDb 与 `db/schema` 的层 |
| `services/*.ts` | 业务编排；拿 db 句柄、调 repository |
| `schemas/*.ts` | TypeBox HTTP schema |
| `tests/*.ts` | vitest 单测；service 用 `vi.spyOn` 拦 repository |

## 步骤 4：跑 migration（手动）

```bash
npx drizzle-kit --config=apps/yishan-api/src/modules/<id>/drizzle.config.ts generate
npx drizzle-kit --config=apps/yishan-api/src/modules/<id>/drizzle.config.ts migrate
```

> 这两步由你手敲。模块启动时**不**自动跑迁移；服务启动也是**不**自动检查 pending。

## 步骤 5：开启模块（开发期）

模块默认装载，启停事实源是 `sys_module.enabled`：

- 首次 sync 该模块到 sys_module 时，若行不存在则用 `meta.enabled`（缺省 `true`）INSERT。
- 已有行的 `enabled` 永不被覆盖；运行时通过后台「模块管理」页或 toggle 接口切换。

如需「出厂默认关闭」，把 `meta.enabled = false`。

## 步骤 6：启动与验证

```bash
pnpm --filter yishan-api dev
```

按 `/api/<id>` 暴露的路径调用即可。

## 关键约束清单

- ✖ 不许在 `db/schema.ts` 之外 import `drizzleDb` 或 `@/db`
- ✖ 不许在 `services/` / `module.ts` 直接写 SQL —— 走 `repositories/`
- ✖ 不许改 Core 表（`sys_*` 全部不许动）
- ✖ 不许跨模块 join 别的模块的表 —— 走 HTTP / Core extension
- ✖ 不许建 `sys_*` 表（即使模块内）
- ✔ 表名必须以 `<meta.id>_` 开头（`pnpm lint` 卡死）
- ✔ `meta.id` 全局唯一（启动期 fail-fast），`prefix` 硬约定 `/api/${meta.id}` 不再声明
- ✔ 入口只放在 `module.ts` 一个文件，业务复杂再做拆分
- ✔ 前端菜单 `path` 用 `/<id>/...` 直挂在根下（例：`/demo/quickstart`），**禁止**再加 `/modules/` 命名空间——`modules/` 只是源码目录约定，不出现在 URL 里

## 完整 demo

参考 `apps/yishan-api/src/modules/demo/`：
- `GET  /api/demo/server-info` — 不读库，拿到当前进程信息
- `GET  /api/demo/documents` — 读库
- `POST /api/demo/documents` — 写库（TypeBox 校验）
