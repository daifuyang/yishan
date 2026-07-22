# demo 模块

新人入门示例。展示一个 module 的完整骨架，作为"按业务拆分成可插拔模块"的最小可运行样例。

## 它演示什么

- `meta` 声明模块元数据（id / enabled），prefix 由 `moduleRoutePrefix()` 硬约定为 `/api/<id>`
- `fastify.decorate('drizzleDb', ...)` 把数据库句柄暴露给 module
- route → service → repository → drizzleDb 完整分层
- TypeBox 写 HTTP schema，Fastify 内置 ajv 校验
- 模块自带 drizzle config 与 drizzle 目录

## 目录

```
modules/demo/
├── README.md
├── module.ts                 # meta + 默认 Fastify 插件
├── db/schema.ts              # Drizzle 表定义
├── drizzle.config.ts         # module 自带的 drizzle-kit 配置
├── drizzle/0000_init.sql     # 建表 + 3 条演示数据
├── drizzle/meta/             # drizzle-kit 产物（_journal / snapshot）
├── repositories/             # 唯一访问 db 的层
├── services/                 # 业务编排
├── schemas/                  # TypeBox HTTP schema
└── tests/                    # 单测
```

## 命名约定（新人先看这一段）

| 项 | 规则 |
| --- | --- |
| `meta.id` | 全局唯一（= 目录名）；小写字母 + 数字 + 下划线；≤ 24 |
| 路由 `prefix` | `/api` 是写死的；模块 prefix = `/api/${meta.id}`，由 `moduleRoutePrefix()` 统一生成，子路径完全由 `routes/` 下文件夹层次决定 |
| 模块表 | 必须以 `<meta.id>_` 开头（如 `demo_documents`） |
| Core 表 | `sys_*`；模块禁止建 `sys_*` 表 |

约束：`meta.id` 即目录名，天然唯一；路由 prefix 由 `moduleRoutePrefix()` 统一生成，不存在冲突；表名以 `<id>_` 开头由开发者自觉遵守。

## meta 字段

模块在 `module.ts` 中导出唯一元数据：

```ts
export const meta = {
  id: 'demo',        // 必填，模块唯一标识
  enabled: true,     // 可选；缺省 true。首次 sync 进 sys_module 时作为 enabled 列兜底值
}
```

- `id`：与目录名一致；core 推导路由 prefix 为 `/api/${id}`。
- `enabled`：仅在「首次 sync 该模块到 sys_module 表」时生效一次——行不存在则 INSERT，enabled 取此值。已有行 sync 永不覆盖 `enabled`。
- 表名、版本号由 core 从 `<id>_` / `0.0.0` 兜底推导，不再需要在 meta 里声明。

## 启停模块

事实源是 `sys_module.enabled`。所有模块一律进 dist，运行时启停由后台「模块控制」页或 toggle 接口切换，写 DB + 清缓存，全局 `onRequest` gate 即时拦截，无需重启。停用的模块请求直接 404。

> 此前还存在一个构建期 `module.json.build` 开关用于"不把某模块编进 dist"——已删除。模块要不要出厂默认开启由 `meta.enabled` 控制；模块要不要随产品一起发布由「目录是否存在于 src/modules/」控制。

## 跑迁移（手工）

```bash
# 首次：生成 migration
npx drizzle-kit --config=apps/yishan-api/src/modules/demo/drizzle.config.ts generate

# 提交后：把 SQL 应用到库
npx drizzle-kit --config=apps/yishan-api/src/modules/demo/drizzle.config.ts migrate
```

程序**从不**自动调用这些命令。

## 验证

启动服务后访问：

| 路由 | 说明 |
| --- | --- |
| `GET  /api/demo/v1` | 模块版本入口 |
| `GET  /api/demo/v1/info` | 当前进程信息（不读库） |
| `GET  /api/demo/v1/documents` | 列出预置的 3 条演示文档 |
| `GET  /api/demo/v1/documents/:id` | 单条文档 |
| `POST /api/demo/v1/documents` | 新增文档（TypeBox 校验 body） |

所有 demo 路由统一受 `demo:documents:list` 权限码保护（见 `routes/v1/index.ts`），通过 `createRouteRegistrar` 注入 preHandler。

## Swagger UI

`core/plugins/external/swagger.ts` 配的是 `hideUntagged: true`——**没声明 tags 的路由不会出现在 `/api/docs`**。所有 demo 路由通过 `schemas/routes.schema.ts` 里的 `ROUTE_TAG` 常量声明 `tags: ['demo']`，并配 TypeBox response schema（params / body / response 一应俱全）。新模块复用同一约定：在自己的 `schemas/routes.schema.ts` 集中 `ROUTE_TAG`，路由文件 `schema: { tags: [ROUTE_TAG], ... }` 即可。然后把 tag 名加进 `swagger.ts` 的顶层 tags 列表，UI 上才会出现 tag 分组标题。

## 管理入口

demo 模块的菜单由模块自身的 `seed.ts` 注册进 `sys_menu`（通过 `pnpm db:seed` 触发）：

- path：`/system/demo-documents`
- component：`./system/demo-documents`
- 权限码：`demo:documents:list`

对应前端页 `apps/yishan-admin/src/pages/system/demo-documents/index.tsx` 用 ProTable 拉 `/api/demo/v1/documents`。

整个入驻链路：seed 声明菜单 → `pnpm db:seed`（INSERT sys_menu + 权限注册 + 角色绑定）→ 后台「系统管理」下出现「模块演示」菜单 → 列表页读模块 API → 表格渲染。

## 测试

```bash
pnpm --filter yishan-api test src/modules/demo/tests
```

或者只跑本模块：

```bash
cd apps/yishan-api && npx vitest run src/modules/demo/tests
```

## 跟着做一个新模块

1. 在 `src/modules/<id>/` 拷贝本目录
2. 把所有 `demo` 全局替换为你的 `id`
3. 改 `db/schema.ts`：把表名从 `demo_documents` 改成 `<id>_<entity>`
4. 改 `module.ts`：把 `meta.id` 改成自己的，`meta.enabled` 视需要保留或省略（默认 true）
5. `npx drizzle-kit --config=.../<id>/drizzle.config.ts generate`
6. `npx drizzle-kit --config=.../<id>/drizzle.config.ts migrate`
7. `pnpm --filter yishan-api build:ts` 后启动服务；在后台「模块控制」页启用（运行时启停即时生效）