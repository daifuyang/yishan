# 模块开发规范（4 层分层 + 模板）

> 本文档是 `portal` / `shop` 落地后**沉淀下来的模块开发规范**。
>
> 配套文档：
> - 新建模块的"30 分钟脚手架" → 根目录 `docs/module-onboarding.md`
> - 已落地模块的速览 → 本目录 `modules.md`
>
> 本文档回答的不是"怎么建一个新模块"，而是"模块**写到什么程度算合格**"。

## 1. 硬约束清单

违反任何一条都无法通过 review/PR / lint：

- ✖ `db/schema.ts` 之外**不允许** `import drizzleDb` 或 `@/db`
- ✖ `services/` / `module.ts` / `routes/` **不允许**直接写 SQL
- ✖ 不允许改 `sys_*` Core 表
- ✖ 不允许跨模块 join 别的模块的表（走 HTTP / Core extension）
- ✖ 不允许建 `sys_*` 表（即使模块内）
- ✖ 不允许在 `routes/` 中 import `drizzle-orm` 或本模块的 `db/schema`
- ✔ 表名必须以 `<meta.id>_` 开头（`pnpm lint` 卡死）
- ✔ `meta.id` 全局唯一（启动期 fail-fast）
- ✔ 路由 prefix 硬约定 `/api/${meta.id}/v1`，**模块不声明**
- ✔ 入口只放在 `module.ts` 一个文件
- ✔ 前端菜单 `path` 用 `/<id>/...` 挂在根下，**禁止**带 `/modules/` 前缀
- ✔ 前端菜单 `component` 用虚拟路径 `./modules/<id>/<page>`（**必须**带 `./modules/`）

`pnpm lint` 跑 `scripts/check-module-naming.mjs`，会正则解析每个模块的 `db/schema.ts`，抓表名缺前缀、表名跨模块重复。

## 2. 4 层分层

```
┌───────────────────────────────────────────────────────────┐
│ routes/v1/index.ts        FastifyPluginAsync              │  ← 路由注册 + TypeBox schema
│   依赖 services, schemas, permissions, core/route-registrar │
│   不允许 import drizzleDb / db/schema                     │
├───────────────────────────────────────────────────────────┤
│ services/*.service.ts     class, 数据库行级别的业务编排     │  ← constructor 注入 db
│   依赖 repositories, schemas, drizzleDb type               │
│   不允许 import drizzleDb 实际值                          │
├───────────────────────────────────────────────────────────┤
│ repositories/*.repository.ts  static methods + 静态函数     │  ← 唯一允许 import drizzleDb 的层
│   依赖 db/schema, drizzleDb, drizzle-orm 操作符             │
├───────────────────────────────────────────────────────────┤
│ db/schema.ts             Drizzle table 定义                │  ← 模块内表结构
│   依赖 drizzle-orm/mysql-core                             │
└───────────────────────────────────────────────────────────┘
```

依赖方向：上层 → 下层，**不能反向**。`module.ts` 只导出 `meta`，不导路由。

## 3. 各层模板

### 3.1 `module.ts` —— 纯 meta

```ts
/**
 * 业务模块 meta。
 *
 * - id: 模块唯一标识，路由 prefix 硬约定为 `/api/${id}/v1`，由 core 推导。
 * - enabled: 首次 sync 进 sys_module 时作为 enabled 列的兜底值（缺省 true）。
 *   sync 永不覆盖已有 enabled；运行时启停完全由 sys_module 表掌握。
 */
export const meta = {
  id: '<id>',
  enabled: true, // 可选；缺省 true
}
```

> 路由注册由 `module-loader` 自动跑（基于 `app.ts` 扫描 `src/<id>/module.ts`），模块**不**再写 `fp()` 插件函数。

### 3.2 `db/schema.ts` —— Drizzle 表

```ts
import { sql } from 'drizzle-orm'
import { datetime, index, int, json, mysqlTable, tinyint, varchar, uniqueIndex } from 'drizzle-orm/mysql-core'

export const <id>Sample = mysqlTable(
  '<id>_sample',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 100 }).notNull(),
    attributes: json(),     // 灵活字段
    status: tinyint().notNull().default(1),
    creatorId: int('creator_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id').notNull(),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    uniqName: uniqueIndex('uniq_<id>_sample_name').on(t.name),
    idxStatus: index('idx_<id>_sample_status').on(t.status),
    idxDeletedAt: index('idx_<id>_sample_deleted_at').on(t.deletedAt),
  }),
)
```

**字段约定**（必读）：

- 主键：`id: int().primaryKey().autoincrement().notNull()`
- 软删：`deleted_at: datetime()` 允许 null，**所有列表查询必须 `isNull(table.deletedAt)`**
- 乐观锁：`version: int().notNull().default(1)`，更新时 `set: { ...patch, version: sql\`version + 1\` }`
- 审计：`creator_id / created_at / updater_id / updated_at` 必带
- 业务状态：`status: tinyint().notNull().default(1)`，约定 0=禁用 / 1=启用
- 灵活字段：`attributes: json()`，用于不固定 schema 的扩展属性
- 索引命名：`idx_<table>_<col>` / `uniq_<table>_<col>` / `uniq_<table>_<col1>_<col2>`

### 3.3 `repositories/<entity>.repository.ts` —— 静态方法 + 默认 db

```ts
import { and, desc, eq, isNull, like, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { <id>Sample } from '../db/schema.js'

export interface <Entity>Row {
  id: number
  name: string
  // ... 与 db 列一一对应
  deletedAt: Date | null
}

export interface <Entity>ListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: number
}

function buildWhere(opts: <Entity>ListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(<id>Sample.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(like(<id>Sample.name, k))
  }
  if (opts.status !== undefined) conds.push(eq(<id>Sample.status, opts.status))
  return and(...conds)
}

export class <Entity>Repository {
  static async list(
    query: <Entity>ListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: <Entity>Row[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildWhere(query)
    const [rows, totalRows] = await Promise.all([
      db.select().from(<id>Sample).where(where).orderBy(desc(<id>Sample.createdAt))
        .limit(pageSize).offset((page - 1) * pageSize),
      db.select({ id: <id>Sample.id }).from(<id>Sample).where(where),
    ])
    return { rows: rows as <Entity>Row[], total: totalRows.length }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<<Entity>Row | null> {
    const [row] = await db.select().from(<id>Sample).where(eq(<id>Sample.id, id)).limit(1)
    return (row as <Entity>Row | undefined) ?? null
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db.update(<id>Sample)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(<id>Sample.id, id))
    return true
  }

  // create / update 略，按字段 patch 即可
}
```

要点：

- 默认参数 `db: AppQueryDb = drizzleDb` 让测试可以传 mock db
- 列表查询统一 `Promise.all([rows, totals])` 减少 round-trip
- 软删用 `set: { deletedAt: new Date(), updatedAt: new Date() }`，**不**真删
- 不要导出 `drizzleDb` 给上层

### 3.4 `services/<entity>.service.ts` —— class + constructor 注入

```ts
import type { AppQueryDb } from '@/db'
import { <Entity>Repository, type <Entity>ListQuery, type Create<Entity>Input, type Update<Entity>Input } from '../repositories/<entity>.repository.js'

export class <Entity>Service {
  constructor(private readonly db: AppQueryDb) {}

  async list(query: <Entity>ListQuery) {
    const { rows, total } = await <Entity>Repository.list(query, this.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }

  async findById(id: number) {
    const row = await <Entity>Repository.findById(id, this.db)
    if (!row) throw new Error('<Entity> not found')
    return row
  }

  async create(input: Create<Entity>Input) {
    return <Entity>Repository.create(input, this.db)
  }

  async update(id: number, input: Update<Entity>Input) {
    const existed = await <Entity>Repository.findById(id, this.db)
    if (!existed) throw new Error('<Entity> not found')
    return <Entity>Repository.update(id, input, this.db)
  }

  async remove(id: number): Promise<void> {
    const existed = await <Entity>Repository.findById(id, this.db)
    if (!existed) throw new Error('<Entity> not found')
    await <Entity>Repository.softDelete(id, this.db)
  }
}
```

要点：

- service **不**直接抛 HTTP 状态码；只抛业务异常（路由层用 `ResponseUtil` 包装）
- `create` / `update` 一定要先 `findById` 验存在（避免悬空更新）
- `categoryIds` / 多对多在 repository 内部事务式处理（先删再插）

### 3.5 `routes/v1/index.ts` —— 数组驱动注册

```ts
import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar, type ManagedRouteOptions } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { IdParamsSchema } from '../../schemas/common.schema.js'
import { PERMS } from '../../permissions.js'
import { <Entity>Service } from '../../services/<entity>.service.js'
import { <Entity>CreateReqSchema, <Entity>ListQuerySchema, <Entity>ListRespSchema, <Entity>RespSchema, <Entity>UpdateReqSchema } from '../../schemas/<entity>.schema.js'

const ROUTE_TAG = '<id>'

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

interface RouteDecl {
  method: HttpMethod
  url: string
  perm: typeof PERMS[keyof typeof PERMS]
  schema: ManagedRouteOptions['schema']
  handler: (service: <Entity>Service, request: any, reply: any) => Promise<unknown>
}

const <entity>Routes: RouteDecl[] = [
  { method: 'get',  url: '/<entity>',           perm: PERMS.<ENTITY>_LIST,   schema: { tags: [ROUTE_TAG], summary: '列表', querystring: <Entity>ListQuerySchema, response: { 200: <Entity>ListRespSchema } }, handler: (s, req) => s.list(req.query) },
  { method: 'get',  url: '/<entity>/:id',      perm: PERMS.<ENTITY>_LIST,   schema: { tags: [ROUTE_TAG], summary: '详情', params: IdParamsSchema, response: { 200: <Entity>RespSchema } }, handler: (s, req) => s.findById(req.params.id) },
  { method: 'post', url: '/<entity>',           perm: PERMS.<ENTITY>_CREATE, schema: { tags: [ROUTE_TAG], summary: '新建', body: <Entity>CreateReqSchema, response: { 200: <Entity>RespSchema } }, handler: (s, req, reply) => ResponseUtil.success(reply, await s.create({ ...req.body, creatorId: req.currentUser?.id ?? 1, updaterId: req.currentUser?.id ?? 1 }), '创建成功') },
  { method: 'patch', url: '/<entity>/:id',     perm: PERMS.<ENTITY>_UPDATE, schema: { tags: [ROUTE_TAG], summary: '更新', params: IdParamsSchema, body: <Entity>UpdateReqSchema, response: { 200: <Entity>RespSchema } }, handler: (s, req, reply) => ResponseUtil.success(reply, await s.update(req.params.id, { ...req.body, updaterId: req.currentUser?.id ?? 1 }), '更新成功') },
  { method: 'delete', url: '/<entity>/:id',    perm: PERMS.<ENTITY>_DELETE, schema: { tags: [ROUTE_TAG], summary: '删除', params: IdParamsSchema, response: { 200: TypeAnyOk() } }, handler: (s, req, reply) => { await s.remove(req.params.id); return ResponseUtil.success(reply, null, '删除成功') } },
]

function TypeAnyOk() {
  return { type: 'object', properties: { success: { type: 'boolean' } } }
}

const <id>: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const service = new <Entity>Service(app.drizzleDb)
  for (const r of <entity>Routes) {
    route[r.method](r.url, { access: { permission: r.perm }, schema: r.schema as ManagedRouteOptions['schema'] }, async (request, reply) => {
      return r.handler(service, request, reply)
    })
  }
}

export default <id>
```

要点：

- `route.<method>(...)` 通过 `createRouteRegistrar` 拿到，**核心已挂载 `onRequest` 鉴权 hook**——只要 `access.permission` 给到就自动 gate
- `req.currentUser` 由 core 的 auth hook 注入；可空降为 `1` 兜底
- 多实体时保持 `Services` 接口聚合（portal 用了），单实体时直接 `new <Entity>Service(app.drizzleDb)` 即可
- 删除成功返回 `ResponseUtil.success(reply, null, '删除成功')`

### 3.6 `schemas/<entity>.schema.ts` —— TypeBox

```ts
import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

export const <Entity>RespSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  status: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type <Entity>Resp = Static<typeof <Entity>RespSchema>

export const <Entity>ListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(<Entity>RespSchema),
})

export const <Entity>ListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({ status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })) }),
])
export type <Entity>ListQuery = Static<typeof <Entity>ListQuerySchema>

export const <Entity>CreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
})
export type <Entity>CreateReq = Static<typeof <Entity>CreateReqSchema>

export const <Entity>UpdateReqSchema = Type.Partial(<Entity>CreateReqSchema)
export type <Entity>UpdateReq = Static<typeof <Entity>UpdateReqSchema>
```

要点：

- `<Entity>ListQuerySchema` 必须 `Type.Composite([PaginationQuerySchema, ...])` 复用 page/pageSize
- `UpdateReqSchema` 直接 `Type.Partial(<Entity>CreateReqSchema)`，永远不要重写
- `Type.String({ format: 'date-time' })` 用于所有时间字段；前端 openapi 生成后是 string

### 3.7 `schemas/common.schema.ts` —— 共享

```ts
import { Type } from '@sinclair/typebox'

export const IdParamsSchema = Type.Object({
  id: Type.Integer(),
})

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 10 })),
})
```

### 3.8 `permissions.ts` —— 集中注册

```ts
import type { PermissionRef } from '@/core/permissions/catalog.js'
import { registerPermissions } from '@/core/permissions/catalog.js'

export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  <ENTITY>_LIST:   { code: '<id>:<entity>:list',   label: '<module>-<entity>-查看', group: '<id>' },
  <ENTITY>_CREATE: { code: '<id>:<entity>:create', label: '<module>-<entity>-新建', group: '<id>' },
  <ENTITY>_UPDATE: { code: '<id>:<entity>:update', label: '<module>-<entity>-编辑', group: '<id>' },
  <ENTITY>_DELETE: { code: '<id>:<entity>:delete', label: '<module>-<entity>-删除', group: '<id>' },
})

registerPermissions(...Object.values(PERMS))
```

要点：

- `code` 段结构：`<module>:<entity>:<action>`，冒号分隔
- `group` 等于 `meta.id`，admin 权限目录按 group 展示
- 文件**顶层副作用**调用 `registerPermissions(...)`，core 在启动时统一读取

### 3.9 `config/system-menu.json` —— 菜单字典

```json
[
  {
    "type": 0,
    "name": "模块名",
    "path": "/<id>",
    "sortOrder": 20,
    "icon": "AppstoreOutlined",
    "children": [
      {
        "type": 1,
        "name": "实体管理",
        "path": "/<id>/<entities>",
        "sortOrder": 1,
        "icon": "FolderOutlined",
        "component": "./modules/<id>/<entities>",
        "children": [
          { "type": 2, "name": "查看", "permissionCodes": ["<id>:<entity>:list"],   "sortOrder": 1, "hideInMenu": 1, "isDefaultAction": 1 },
          { "type": 2, "name": "新建", "permissionCodes": ["<id>:<entity>:create"], "sortOrder": 2, "hideInMenu": 1 },
          { "type": 2, "name": "编辑", "permissionCodes": ["<id>:<entity>:update"], "sortOrder": 3, "hideInMenu": 1 },
          { "type": 2, "name": "删除", "permissionCodes": ["<id>:<entity>:delete"], "sortOrder": 4, "hideInMenu": 1 }
        ]
      }
    ]
  }
]
```

三个 `type`：`0` = 目录 / `1` = 页面 / `2` = 按钮（endpoint）。`component` 用 `./modules/<id>/<page>`；别忘了 `./modules/` 前缀。

### 3.10 `seed.ts` —— 菜单 + 示例数据

`scripts/onboard-modules.ts` 通过 `spawn node seed.js` 触发本文件。

```ts
import { eq } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { sysMenu, sysMenuPermission, sysUser } from '@/db/schema'
import adminMenu from './config/system-menu.json'
import { <id>Sample } from './db/schema.js'

export type AdminMenuNode = {
  type: 0 | 1 | 2
  name: string
  path?: string
  sortOrder: number
  icon?: string
  component?: string
  hideInMenu?: 0 | 1
  permissionCodes?: string[]
  isDefaultAction?: 0 | 1
  children?: AdminMenuNode[]
}

export function flattenMenuTree(nodes: AdminMenuNode[]): Array<{ node: AdminMenuNode; depth: number; parentPath: string | null }> {
  const out: Array<{ node: AdminMenuNode; depth: number; parentPath: string | null }> = []
  const walk = (list: AdminMenuNode[], depth: number, parentPath: string | null): void => {
    for (const node of list) {
      const myPath = node.path ?? parentPath
      out.push({ node, depth, parentPath })
      if (node.children && node.children.length > 0) walk(node.children, depth + 1, myPath)
    }
  }
  walk(nodes, 0, null)
  return out
}

async function upsertOne(decl: AdminMenuNode, parentId: number | null, creatorId: number): Promise<number> {
  if (!decl.path) return parentId ?? 0  // 按钮节点 (type=2) 无独立 path
  const existing = await drizzleDb.query.sysMenu.findFirst({ where: eq(sysMenu.path, decl.path) })
  if (existing) {
    await drizzleDb.update(sysMenu).set({ name: decl.name, type: decl.type, parentId, component: decl.component ?? existing.component, icon: decl.icon, sortOrder: decl.sortOrder, updaterId: creatorId, status: 1, hideInMenu: decl.hideInMenu === 1 })
      .where(eq(sysMenu.id, existing.id))
    return existing.id
  }
  await drizzleDb.insert(sysMenu).values({
    name: decl.name, path: decl.path, type: decl.type, parentId, component: decl.component, icon: decl.icon,
    sortOrder: decl.sortOrder ?? 99, status: 1, hideInMenu: decl.hideInMenu === 1, isDefaultAction: decl.isDefaultAction === 1,
    isExternalLink: false, keepAlive: false, creatorId, updaterId: creatorId,
  })
  const created = await drizzleDb.query.sysMenu.findFirst({ where: eq(sysMenu.path, decl.path) })
  if (!created) throw new Error(`菜单写入后未找到：${decl.path}`)
  return created.id
}

async function upsertTree(nodes: AdminMenuNode[], parentId: number | null, creatorId: number): Promise<void> {
  for (const decl of nodes) {
    const id = await upsertOne(decl, parentId, creatorId)
    if (decl.children?.length) await upsertTree(decl.children, id, creatorId)
  }
}

async function bindAllPermissions(flat: ReturnType<typeof flattenMenuTree>, creatorId: number): Promise<void> {
  for (const { node, parentPath } of flat) {
    if (!node.permissionCodes?.length) continue
    const anchorPath = node.path ?? parentPath
    if (!anchorPath) throw new Error(`bindAllPermissions 找不到可绑定的菜单行：${node.name}`)
    const row = await drizzleDb.query.sysMenu.findFirst({ where: eq(sysMenu.path, anchorPath) })
    if (!row) throw new Error(`bindAllPermissions 找不到菜单：${anchorPath}`)
    for (const code of node.permissionCodes) {
      await drizzleDb.insert(sysMenuPermission).values({ menuId: row.id, permissionCode: code }).onDuplicateKeyUpdate({ set: { permissionCode: code } })
    }
  }
}

export default async function seed<Module>(): Promise<void> {
  const [admin] = await drizzleDb.select({ id: sysUser.id }).from(sysUser).where(eq(sysUser.username, 'admin')).limit(1)
  const creatorId = admin?.id ?? 1
  const menuTree = adminMenu as AdminMenuNode[]
  await upsertTree(menuTree, null, creatorId)
  await bindAllPermissions(flattenMenuTree(menuTree), creatorId)
  // 可选：seedSampleData(creatorId)
}

if (require.main === module) {
  seed<Module>().catch((err) => { console.error('[<id> seed] 异常退出:', err); process.exit(1) })
}
```

要点：

- 菜单 upsert 按 `path` 做幂等（重复跑 `db:seed` 不会重复插）
- 按钮节点（type=2）**不**写入 sys_menu 行，只通过 `bindAllPermissions` 绑到父页面的 `sys_menu_permission`
- 示例数据放在 `seedSampleData(creatorId)` 子函数里，按业务唯一键（slug / path / sku_code）做幂等

### 3.11 `drizzle/0000_init.sql` —— 跟 schema 对齐

模块自带 `drizzle.config.ts` + `drizzle/0000_init.sql` + `drizzle/meta/{_journal,0000_snapshot}.json`。修改 `db/schema.ts` 后：

```bash
cd apps/yishan-api/src/modules/<id>
npx drizzle-kit --config=./drizzle.config.ts generate
```

**不在启动时**自动跑 migration；上线前手动 `pnpm --filter yishan-api db:migrate`。

## 4. 关键约束的代价

| 约束 | 代价 | 收益 |
|---|---|---|
| 4 层强制 | 多写两个文件 | 测试可 mock 单层、SQL 集中审查 |
| 路由 prefix 硬约定 | 失去自定义自由度 | 模块显式 id 全局唯一，启动期 fail-fast |
| 模板字段（`creator_id` 等） | 每张表多 6 个字段 | 审计、乐观锁、软删开箱即用 |
| 权限码集中 | 多写一个文件 | admin 权限目录自动按 group 分组 |
| 类型不允许 `any` | 跨模块要 HTTP | 跨模块运行时解耦 |

## 5. 提交前自检

```bash
# 1. 命名 lint
pnpm lint                # scripts/check-module-naming.mjs 校验表名前缀

# 2. 单测
pnpm --filter yishan-api test

# 3. 重新生成 openapi（前端同步类型）
pnpm --filter yishan-admin openapi

# 4. 端到端验证
pnpm --filter yishan-api dev
# swagger UI: http://localhost:3000/api/docs
# 找到 <id> tag 调用 list / create / update / delete 跑一遍
```

如果第 4 步新增了路由，确认 swagger UI 里 `<id>` 分组下出现新接口、`schema` 描述符合预期。
