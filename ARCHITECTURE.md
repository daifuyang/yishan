# Yishan Architecture

## 1. 文档定位

本文描述当前架构事实，面向首次进入仓库的开发者、AI agent 和架构评审者。它定义目录职责、依赖方向、运行边界和命令契约。它不记录重构历史，也不充当部署环境配置手册。根 `package.json#scripts` 是可执行命令名称的事实来源。`specs/archive/**` 仅保存历史资料，不定义当前架构。

历史 plugin 模型（`PLUGIN_CONTRACT.md`、`ADR-002/003/006`、`plugins/<vendor>/<slug>/`、`plugin-platform/`、`plugin-sdk/plugin-api/admin-sdk`）已被精简删除。任何引用上述路径的文档、脚本或 CI 都视为已废弃。

## 2. 系统总览

Yishan 是一个以 Core 为基座的 monorepo。

- **API**（`apps/yishan-api`）：Fastify 5 + Drizzle + MySQL + TypeBox + JWT。
- **Admin**（`apps/yishan-admin`）：Umi 4 + Ant Design Pro + React 19。
- **App**（`apps/yishan-app`）：Taro 4 + React 18，微信小程序 + H5 双端。
- **Docs**（`apps/yishan-docs`）：Docusaurus 3。
- **Components**（`packages/yishan-tiptap`）：TipTap 3，被 Admin 通过 workspace 协议消费。

业务能力以**模块**形式承载：每个模块在 `apps/yishan-api/src/modules/<id>/` 下提供 `routes.ts`（Fastify 插件）和 `meta`（id / name / defaultEnabled / tablePrefix / version），并自带 `db/schema.ts`、drizzle 配置与产物、`repositories/`、`services/`、`schemas/`、`tests/`。Core 通过 `@fastify/autoload` 扫描该目录装载模块，路由 prefix 硬约定为 `/api/<id>`（`core/module-loader.ts` 的 `moduleRoutePrefix()` 为唯一来源）。启停分两级：**构建期打包** 由每模块 `module.json.build` 决定（`build:false` 不编译进 dist）；**运行时启停** 由 `sys_module.enabled` + `app.ts` 全局 `onRequest` gate 决定（停用模块请求直接 404，即时生效、零重启）。

## 3. 不可破坏的架构不变量

- Core 不依赖任何业务模块实现；模块可调用 Core 暴露的 extension point。
- API 业务调用遵守 Route → Service → Repository。
- Repository 是访问数据库实现（`@/db`、Drizzle 表定义、SQL）的唯一业务层。
- 所有模块路由 prefix 由 `moduleRoutePrefix()` 统一生成为 `/api/<id>`，id 唯一性由文件系统保证。
- Admin 路由必须能解析到模块页面或 Core 页面；菜单引用必须能解析到路由。
- OpenAPI spec、Admin `services/generated/`、模块迁移目录均按当前已装载模块动态生成；不再维护静态 profile 文件或 plugin 清单。
- 生成物不得通过手工编辑改变架构事实。

## 4. 发行线

仓库维护 `main` 与 `all` 两条发行线。

- `main` 是 Core 发行线，唯一模块是 `demo`（SDK 示范，`defaultEnabled: false`，路径 `apps/yishan-api/src/modules/demo/`）。
- `all` 是官方集成发行线，包含官方业务模块示例。

两条发行线共享同一构建机制与同一 SDK。跨线同步通过显式 cherry-pick / backport 完成，不再依赖 Git ancestry。

## 5. 模块发现

```text
apps/yishan-api/src/modules/<id>/
├── README.md              # 模块自描述，新人入门首选
├── routes.ts              # export const meta = { id, name, defaultEnabled, prefix }
│                          # export default <FastifyPluginAsync>，含 onRoute 把 moduleId 写入 route.config
├── db/schema.ts           # Drizzle 表定义（表名 = <id>_<entity>）
├── drizzle.config.ts      # 模块自带 drizzle-kit 配置
├── drizzle/               # drizzle-kit 产物：SQL + meta/_journal.json + meta/snapshot.json
├── repositories/          # 该模块唯一允许访问 @/db / Drizzle 表定义的层
├── services/              # 业务编排
├── schemas/               # TypeBox HTTP schema
└── tests/                 # 单元 / 集成，可选
```

`apps/yishan-api/src/app.ts` 在 boot 阶段：

1. 用 `@fastify/autoload` 注册 `core/plugins/external/*` 与 `core/plugins/app/*`（Fastify 生态 helpers + 内部工具）。
2. `fastify.decorate('drizzleDb', drizzleDb)`：把数据库句柄暴露给所有 module 的 routes.ts。
3. 构造 `ModuleLoader` 并 `scanDiskModules()`（读各模块 `meta`）→ `syncModulesFromDisk()`（INSERT 缺失行按 `defaultEnabled` 兜底 `enabled`，UPDATE 结构字段但不动 `enabled`）。
4. 在 root 注册全局 `onRequest` gate：命中 `/api/<moduleId>/...` 且该模块 `sys_module.enabled=false` 时直接 404；core 路由（`/api/v1/...` 等）放行。
5. `mountAllOnDisk()`：对 `src/modules/<id>/` 下每个【已打包在 dist】的模块，用 `@fastify/autoload` 注册其 `routes/` 目录，`options.prefix = moduleRoutePrefix(id)`。**不看 enabled**——运行时启停交给 gate（fastify 插件树 boot 后不可变，无法运行时挂/卸）。
6. 用 `@fastify/autoload` 注册 `core/routes/*`（Core 自有路由）。

模块默认包含一份 `demo`（SDK 示范），路径 `apps/yishan-api/src/modules/demo/`，提供 `GET /api/demo/server-info`、`GET /api/demo/documents` 等入口。

## 6. 根目录结构

```text
.
├── apps/
│   ├── yishan-api/
│   │   ├── drizzle/
│   │   │   └── core/                # Core DDL
│   │   ├── src/
│   │   │   ├── core/                # Core：auth、db、middleware、permissions、repositories、routes、schemas、services
│   │   │   │   ├── plugins/
│   │   │   │   │   ├── external/    # fastify-cors/jwt/redis/multipart/...
│   │   │   │   │   └── app/         # dict-map、password-manager 等内部工具
│   │   │   ├── modules/             # 业务模块（每个子目录 = 一个模块）
│   │   │   ├── db/
│   │   │   ├── infrastructure/
│   │   │   ├── config/
│   │   │   └── app.ts               # Core boot + module autoload
│   │   └── test/
│   ├── yishan-admin/
│   │   ├── src/
│   │   │   ├── core/                # 核心 admin 路由
│   │   │   ├── pages/               # 业务页面
│   │   │   ├── types/sdk/           # 稳定 admin 类型（替代旧 admin-sdk 包）
│   │   │   ├── services/generated/  # 由 openapi 生成
│   │   │   └── utils/
│   │   └── config/
│   ├── yishan-app/
│   ├── yishan-docs/
│   └── yishan-components/           # tiptap editor package
├── packages/                        # 共享 workspace 包
├── scripts/                         # 历史脚本目录已清空（scripts/{arch,docs,migrate}、verify.mjs、generate-core-permissions.mjs 等已删除），等待按新基线重新设计
├── specs/                           # 历史与进行中的方案（archive/ 视为历史）
├── AGENTS.md                        # AI/开发者强制规则
├── ARCHITECTURE.md                  # 本文件
├── README.md
└── CONTRIBUTING.md
```

`plugins/` 已删除；`packages/plugin-sdk`、`packages/plugin-api`、`packages/admin-sdk` 已删除并按需内联（如 admin-sdk 内容已搬到 `apps/yishan-admin/src/types/sdk/`）。

## 7. API 应用边界

`apps/yishan-api/` 是 Core + 模块的宿主。其关键布局：

```text
apps/yishan-api/
├── drizzle/
│   └── core/
├── src/
│   ├── core/
│   │   ├── routes/
│   │   ├── services/
│   │   └── repositories/
│   ├── db/
│   ├── infrastructure/
│   ├── modules/                     # ← 模块入口（routes.ts + meta）
│   ├── config/
│   └── app.ts
└── test/
```

`src/core/` 只包含基座能力（auth、permissions、repositories、routes、services、schemas、middleware、plugins/external、plugins/app）。`src/modules/<id>/` 是业务模块的唯一位置。

## 8. API 分层

Core 与每个模块内部都采用同一调用方向：

```text
Route → Service → Repository → Drizzle / SQL
```

- Route 只负责 schema、认证、权限、DTO 与 HTTP 响应。
- Route 不包含事务编排。
- Route 不直接读取表定义或执行 SQL。
- Service 负责业务规则、用例编排与事务边界。
- Repository 是唯一允许访问 Drizzle 表定义和 SQL 的位置。
- 反向依赖、跨模块 import、Core import 模块实现均属违规。

## 9. 模块边界

- `meta.id` 是模块唯一标识，必须唯一且稳定；id 唯一性由文件系统目录名保证。
- 路由 prefix 硬约定 `/api/<id>`，由 `moduleRoutePrefix()` 唯一生成，模块不再声明 `meta.prefix`。
- 表名必须以 `<meta.id>_` 开头。
- 模块不直接 import 其他模块的源码；跨模块交互只通过 Core 暴露的 extension point 或 HTTP API。
- 模块不读取或修改 Core 表；模块也不许建 `sys_*` 表，只能访问自己的 drizzle 工程。
- 模块启停分两级：构建期打包（`module.json.build`，改后需 rebuild）与运行时启停（`sys_module.enabled` + 全局 `onRequest` gate，即时生效）。运行时启用蕴含必须已打包。
- 模块启动期**不**自动跑迁移、不自动校验 pending；迁移由开发者手动执行 `drizzle-kit migrate`。

## 10. Admin 架构

- Core admin 路由集中在 `apps/yishan-admin/src/core/routes.ts`，与模块路由分开声明。
- Admin 业务代码只 import 稳定类型（`@/types/sdk`），不直接依赖 generated `API.*` namespace。
- `apps/yishan-admin/src/services/generated/typings.d.ts` 是空 stub 占位，作为迁移期声纳。
- Admin build（`max build`）不依赖 `tsc --noEmit` 通过。

## 11. App 与 Docs

- App 是独立客户端，按需调用 API；不复制 Admin 客户端类型。
- Docs 仅描述架构与使用，不参与运行时构建。

## 12. OpenAPI 与客户端

- API 启动时 Fastify swagger 装饰器从已注册路由收集 schema。
- 每个 module 的 schema 字段必须用 TypeBox 显式声明。
- Admin 客户端类型从 OpenAPI 生成物派生；业务代码通过 `@/types/sdk` 间接消费。

## 13. 数据库与迁移

- 数据库：仅 Drizzle，无 ORM 替代物。
- Core DDL 在 `apps/yishan-api/drizzle/core/`（沿用根 `drizzle-kit`）。
- **每个 module 自带一份独立 drizzle 工程**：`apps/yishan-api/src/modules/<id>/drizzle.config.ts` + `drizzle/` 输出目录，drizzle-kit 完全独立运行。
- 模块迁移**永远**由开发者手动 `drizzle-kit migrate` 执行；模块的 routes.ts 不执行 SQL，不检查 pending。
- 不允许 Core 创建业务表，不允许模块修改 Core 表，也不允许模块建 `sys_*` 表。
- 表名约束：`demo_documents` 等所有模块表必须以 `<meta.id>_` 开头，由 `scripts/check-module-naming.mjs` 与启动期同时校验。

## 14. 请求与能力流

```text
HTTP request
  ↓
Core middleware (auth, cors, jwt, ...)
  ↓
core/routes/*  (preHandlers + handlers)
  ↓
core/services/* + module routes
  ↓
Service → Repository → Drizzle / SQL
```

模块挂载点位于 Core middleware 之后、Core routes 之前；模块可用 `app.get/post/...` 自由注册路由与 hooks。

## 15. 变更归属判断

- 改动落在 `apps/yishan-api/src/core/`、`drizzle/core/`、`scripts/`、`apps/yishan-admin/src/core/`、`apps/yishan-app/src/core/`、根规范 → Core。
- 改动落在 `apps/yishan-api/src/modules/<id>/`、`apps/yishan-admin/src/pages/<feature>/`、对应 admin/app 路由 → 该模块。
- 改动落在 `apps/yishan-docs/`、`specs/archive/` → 文档。

## 16. 架构评审清单

- 是否触碰 `plugins/`、`packages/plugin-sdk` / `plugin-api` / `admin-sdk`、`core/plugin-platform/`、`core/middleware/plugin-gate.ts`？
- 是否新增业务表到 `drizzle/core/`？
- 是否硬编码 `portal` / `shop` / `hello` 作为系统分类？
- 是否修改 `apps/yishan-admin/src/services/generated/` 下的非占位文件？
- 是否让 admin 业务代码 import `API.*` namespace？
- 是否在 Core 引入对模块源码的反向依赖？
- 模块表名是否以 `<meta.id>_` 开头？跨模块表名是否撞？
- `meta.id` / `meta.prefix` 是否全局唯一？
- 模块是否在 routes.ts 之外碰 drizzleDb，或写了 SQL 字符串而绕过 repositories？

## 17. 事实优先级

当文档与代码冲突时，事实优先级：

1. 编译/运行成功的代码
2. 根 `package.json#scripts`
3. `AGENTS.md`
4. 本文件
5. `specs/archive/**`（仅作历史参考）