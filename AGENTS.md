# AGENTS.md — Yishan Monorepo

AI 与开发者必须遵守的强制规则，短且稳定。详细架构与实现见根目录其他规范文档。

## 1. 技术栈与版本来源

- **Admin** (yishan-admin)：Umi 4 + Ant Design Pro，React 19，Biome lint，Jest test
- **API** (yishan-api)：Fastify 5，Drizzle ORM + MySQL，TypeBox，JWT，commonjs
- **App** (yishan-app)：Taro 4 + React 18，Biome lint，TypeScript，微信小程序 + H5
- **Docs** (yishan-docs)：Docusaurus 3
- **Components** (yishan-tiptap)：TipTap 3，Rollup，admin 的 workspace 依赖

Node 与 pnpm 版本以 `.tool-versions`（`node 22.22.1`、`pnpm 8.15.9`）和根 `package.json#packageManager` 为唯一来源；不要在文档或脚本中再写具体数字。

## 2. 开始开发前必须阅读的根文档

- `ARCHITECTURE.md` — 当前架构事实与目录边界
- `PLUGIN_CONTRACT.md` — 插件开发、manifest、生命周期、迁移契约
- `RELEASE_CONTRACT.md` — artifact、迁移、provider adapter、回滚契约
- `CONTRIBUTING.md` — 提交流程与质量门禁
- `README.md` — 项目介绍、五分钟启动、profile 选择

## 3. Core / 插件边界

- Core 是基座；不允许出现具体业务插件的命名空间、迁移、表、权限或菜单。
- 插件目录必须落在 `plugins/<vendor>/<slug>/plugin.ts`，唯一 manifest，禁止在 API / Admin 另建 manifest（详见 ADR-002）。
- 装载与 gate：Core 只 AutoLoad `core/routes/**`；插件通过 `plugin.register(app)` 显式注册，并由 `pluginGate(pluginId)` 统一管控 disabled 状态（详见 ADR-003）。
- 分支策略：`main` = Core + hello；`all` = Core + 官方业务插件；两条发行线已分叉，禁止以 ancestry 作为同步证据（详见 ADR-001）。

## 4. Route → Service → Repository 规则

- **Route**：只负责 schema、认证、权限、DTO 与 HTTP 响应；禁止直接访问 DB。
- **Service**：业务编排与事务边界；可调用 Repository 与其他 Service。
- **Repository**：唯一允许访问 `@/db`、Drizzle 表定义与 SQL 的层；禁止被 Route 直接调用。
- 跨层反向依赖、Core import 插件、插件跨插件 import 均属违规。

## 5. profile、生成物与 verify 命令

profile 是构建期与运行期的唯一插件选择来源：

```bash
pnpm profile:validate -- --profile core
pnpm plugins:catalog -- --profile core
pnpm db:generate -- --profile core
pnpm openapi:generate -- --profile core
pnpm admin:generate-routes -- --profile core

pnpm verify:core -- --profile core
pnpm verify:admin -- --profile core
pnpm verify:app -- --profile core --target weapp
pnpm verify:docs
pnpm verify:integration -- --profile official
pnpm verify -- --profile core
```

`pnpm verify -- --profile <name>` 必须在干净 checkout 中完成安装、catalog、TipTap 构建、Drizzle 生成、OpenAPI 生成、Admin route 生成、API build/test、Admin lint/test/build、App lint/build、Docs build、架构检查与生成物 diff 检查；不得依赖已存在的 `dist/`、`.umi/` 或本地 `.env`。

## 6. 禁止项

- 引入除 Drizzle 之外的 ORM；Drizzle 是当前 ORM
- 在 API / Admin 双 manifest；插件只能有一份 `plugins/<vendor>/<slug>/plugin.ts`
- 在 Core、admin pages、routes、脚本或文档中硬编码业务插件命名空间（`portal`、`shop`、`hello` 仅作为 SDK 示例，不参与生产默认 profile）
- 跳过 catalog / openapi / admin route 任一生成检查
- 把环境专属云账号、地域、bucket、ARN 或 secret 名称作为基座默认值
- 在根规范文档中写"具体业务插件清单"或"账户/地域"
- **手动修改 `apps/yishan-admin/src/services/generated/` 下的任何文件**（含 `*.ts` 与 `typings.d.ts`）。这些文件由 `pnpm --filter yishan-admin openapi` 从 `apps/yishan-api/openapi.json` 自动生成；需要变更时改 API 路由的 TypeBox schema 或 `apps/yishan-admin/config/config.ts` 的 openAPI 插件配置，再跑 `pnpm openapi:check` 让生成物落地。
- **手写代码直接依赖 generated `API.*` ambient namespace**（如 `API.currentUser`、`API.sysAttachment`、`API.menuTreeList`）。Admin 业务代码应只 import `@yishan/plugin-api` 等基座包暴露的稳定类型，或通过 admin-sdk 包封装 generated types 后再消费——避免 openapi 字段增减导致手写代码大面积连锁报错。

## 7. 变更类型 → 测试命令映射

| 改动范围 | 必跑命令 |
| --- | --- |
| Core API / 插件契约 | `pnpm verify -- --profile core` |
| 某插件 | 包含该插件的最小 profile verify + plugin 集成测试 |
| Admin | admin build/test + 受影响 profile 的 openapi / route check |
| App | `pnpm verify:app -- --profile core --target weapp|h5` |
| Docs / 根规范 | docs build + docs check |
| deploy provider | release build/validate + provider adapter dry-run |

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

> specs/archive/** 是历史资料，不得作为当前架构依据；当前事实以 ARCHITECTURE.md、PLUGIN_CONTRACT.md、RELEASE_CONTRACT.md 和 package.json#scripts 为准。