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
- 业务模块以**目录 + 文件**形式落在 `apps/yishan-api/src/modules/<id>/`。每个模块必须有 `routes.ts`，export `meta`（`id` / `name` / `defaultEnabled`）和默认 Fastify 插件。
- 模块必须自带 `db/schema.ts`、`drizzle.config.ts`、`drizzle/` 输出目录、`repositories/`、`services/`、`tests/`；按需追加 `schemas/`。
- 模块表名一律以 `<meta.id>_` 为前缀；`apps/yishan-api/src/modules/demo/` 是 SDK 示范。
- 命名约定：启动期 `app.ts` 校验 `meta.id` 唯一；提交期 `scripts/check-module-naming.mjs` 校验表名 `demo_documents` 之类的 `<id>_*` 命名 + 跨模块不重复。
- **路由 prefix 硬约定为 `/api/${id}`**，不再由模块 `meta.prefix` 声明，也不做跨模块 prefix 唯一性校验（id 唯一性由文件系统保证）。
- 模块路由走**裸 Fastify**：`app.get/post/...` 直接调用。
- **两级启停开关**（各有唯一事实源，互不耦合）：
  - 构建期打包 = 每模块 `module.json` 的 `build` 字段（缺省视为 `true`）。`build:false` 的模块经 `scripts/gen-module-tsconfig.mjs` 加入 tsconfig exclude，不编译进 dist、不参与打包。开发态用 `pnpm --filter yishan-api modules:build <id> on|off` 切换（改本地 meta，需 rebuild 生效）。
  - 运行时启停 = `sys_module.enabled`（多实例共享）。boot 时无条件挂载所有已打包模块，`app.ts` 的全局 `onRequest` gate 按 enabled 拦截停用模块（→404），即时生效、零重启。toggle 只写 DB，**永不回写源码/meta 文件**。
  - 约束：运行时启用 ⟹ 必须已打包（单向偏序，不是双向等值）。
- 模块启动期**不**自动跑迁移、不自动校验 pending；迁移由开发者手动 `drizzle-kit migrate`。
- Admin、App、其它客户端未来按相同 `meta` 形态自治；目前仅 API 已经采用。

## 4. Route → Service → Repository 规则

- **Route**：只负责 schema、认证、权限、DTO 与 HTTP 响应；禁止直接访问 DB。
- **Service**：业务编排与事务边界；可调用 Repository 与其他 Service。
- **Repository**：唯一允许访问 `@/db`、Drizzle 表定义与 SQL 的层；禁止被 Route 直接调用。
- 跨层反向依赖均属违规。

## 5. 默认门禁

仓库在根目录只编排各 app 自带的 `lint/test/build`，不再维护跨包静态门禁：

```bash
pnpm lint                    # admin lint + docs typecheck + app lint
pnpm test                    # admin test + api test
```

完整 PR 流程按改动范围跑对应 app 的 `lint/test/build`（详见 §7）。

## 6. 禁止项

- 引入除 Drizzle 之外的 ORM；Drizzle 是当前 ORM
- 在 Core、admin pages、routes、脚本或文档中硬编码具体业务命名空间（如 `portal` / `shop` / `hello`）
- 把环境专属云账号、地域、bucket、ARN 或 secret 名称作为基座默认值
- **手动修改 `apps/yishan-admin/src/services/generated/` 下的任何文件**（含 `*.ts` 与 `typings.d.ts`），但允许维护一个**空** `typings.d.ts` 占位作为迁移期声纳
- **手写代码直接依赖 generated `API.*` ambient namespace**。Admin 业务代码应只 import `@/types/sdk` 暴露的稳定类型，或通过 admin SDK 包封装 generated types 后再消费——避免 openapi 字段增减导致手写代码大面积连锁报错

## 7. 变更类型 → 测试命令映射

| 改动范围 | 必跑命令 |
| --- | --- |
| Core API | `pnpm --filter yishan-api test` + `pnpm --filter yishan-api build:ts` |
| 新增 / 修改 API 模块 | `pnpm --filter yishan-api test` + 手动 curl smoke |
| Admin | `pnpm --filter yishan-admin lint` + `pnpm --filter yishan-admin test` + `pnpm --filter yishan-admin build` |
| App | `pnpm --filter yishan-app lint` + `pnpm --filter yishan-app build:weapp` |
| Docs / 根规范 | `pnpm --filter yishan-docs build` |

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