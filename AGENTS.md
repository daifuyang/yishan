# AGENTS.md — Yishan Monorepo

AI 与开发者必须遵守的强制规则，短且稳定。详细架构与实现见根目录其他规范文档。

## 1. 技术栈与版本来源

- **Admin** (yishan-admin)：Umi 4 + Ant Design Pro，React 19，Biome lint，Jest test
- **API** (yishan-api)：Fastify 5，Drizzle ORM + MySQL，TypeBox，JWT，commonjs
- **App** (yishan-app)：Taro 4 + React 18，Biome lint，TypeScript，微信小程序 + H5
- **Docs** (yishan-docs)：Docusaurus 3
- **Components** (yishan-tiptap)：TipTap 3，Rollup，admin 的 workspace 依赖

Node 与 pnpm 版本以 `.tool-versions` 和根 `package.json#packageManager` 为唯一来源；不要在文档或脚本中再写具体数字。

## 2. 开始开发前必须阅读的根文档

- `ARCHITECTURE.md` — 当前架构事实与目录边界
- `README.md` — 项目介绍与五分钟启动
- `CONTRIBUTING.md` — 提交流程与质量门禁

## 3. Core / 模块边界

- Core 是基座；`apps/yishan-api/src/core/` 不得出现具体业务的表、权限或菜单。
- 业务模块以**目录 + 文件**形式落在 `apps/yishan-api/src/modules/<id>/`。每个模块必须有 `routes.ts`，export `meta`（`id` / `name` / `defaultEnabled` / `prefix`）和默认 Fastify 插件。
- 模块路由走**裸 Fastify**：`app.get/post/...` 直接调用，不再有 `RouteRegistrar`、`pluginGate`、`api.register` 动态 import、`manifest` 校验。
- 启停 = `meta.defaultEnabled` + 可选的本地 `.dev-modules.json` 覆盖；production 完全忽略 `.dev-modules.json`。
- Admin、App、其它客户端未来按相同 `meta` 形态自治；目前仅 API 已经采用。
- 不再有 `plugins/` 目录、`packages/plugin-sdk/`、`packages/plugin-api/`、`packages/admin-sdk/`、`core/plugin-platform/`、`core/middleware/plugin-gate.ts`、双 manifest、`PLUGIN_CONTRACT.md`、`ADR-002/003/006`。

## 4. Route → Service → Repository 规则

- **Route**：只负责 schema、认证、权限、DTO 与 HTTP 响应；禁止直接访问 DB。
- **Service**：业务编排与事务边界；可调用 Repository 与其他 Service。
- **Repository**：唯一允许访问 `@/db`、Drizzle 表定义与 SQL 的层；禁止被 Route 直接调用。
- 跨层反向依赖均属违规。

## 5. 模块启停、生成物与 verify 命令

```bash
pnpm arch:check              # 架构规则（routes / boundaries / admin-types / modules-autoload）
pnpm --filter yishan-api permissions:check
pnpm docs:check

pnpm verify:core             # API + arch + db + openapi + types
pnpm verify:admin            # admin build/test/lint
pnpm verify:app              # app lint/build
pnpm verify:docs
pnpm verify:integration
pnpm verify
```

`pnpm verify -- --profile <name>` 必须在干净 checkout 中完成安装、TipTap 构建、Drizzle 生成、OpenAPI 生成、Admin route 生成、API build/test、Admin lint/test/build、App lint/build、Docs build、架构检查与生成物 diff 检查；不得依赖已存在的 `dist/`、`.umi/` 或本地 `.env`。

> 历史 `profile:validate` / `plugins:catalog` / `release:build` / `release:validate` 已随老 plugin 模型一起删除。

## 6. 禁止项

- 引入除 Drizzle 之外的 ORM；Drizzle 是当前 ORM
- 复活 `plugins/` 目录、`packages/plugin-sdk` / `plugin-api` / `admin-sdk`、`apps/yishan-api/src/core/plugin-platform/`、`apps/yishan-api/src/core/middleware/plugin-gate.ts`、双 manifest、`PLUGIN_CONTRACT.md`
- 在 Core、admin pages、routes、脚本或文档中硬编码具体业务命名空间（如 `portal` / `shop` / `hello`）
- 把环境专属云账号、地域、bucket、ARN 或 secret 名称作为基座默认值
- **手动修改 `apps/yishan-admin/src/services/generated/` 下的任何文件**（含 `*.ts` 与 `typings.d.ts`），但允许维护一个**空** `typings.d.ts` 占位作为迁移期声纳
- **手写代码直接依赖 generated `API.*` ambient namespace**。Admin 业务代码应只 import `@/types/sdk` 暴露的稳定类型，或通过 admin SDK 包封装 generated types 后再消费——避免 openapi 字段增减导致手写代码大面积连锁报错

## 7. 变更类型 → 测试命令映射

| 改动范围 | 必跑命令 |
| --- | --- |
| Core API | `pnpm verify:core` + `pnpm arch:check` |
| 新增 / 修改 API 模块 | `pnpm --filter yishan-api test` + 手动 curl smoke |
| Admin | `pnpm verify:admin` + `pnpm arch:check:admin-types` |
| App | `pnpm verify:app` |
| Docs / 根规范 | `pnpm verify:docs` + `pnpm docs:check` |
| modules autoload 契约 | `pnpm arch:check:modules-autoload` |

## 快速命令（开发者日常）

```bash
pnpm --filter yishan-admin lint
pnpm --filter yishan-admin test
pnpm --filter yishan-admin build
pnpm --filter yishan-api test
pnpm --filter yishan-tiptap build    # admin dev/build 之前
pnpm --filter yishan-app lint
pnpm --filter yishan-app build:weapp
```

> specs/archive/** 是历史资料，不得作为当前架构依据；当前事实以 ARCHITECTURE.md、AGENTS.md 和 `package.json#scripts` 为准。