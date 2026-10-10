# Yishan（移山）

企业应用通用基座：React 19 / Umi / Ant Design 管理后台、Fastify 5 / TypeBox / Drizzle / MySQL 后端、微信小程序与 Docusaurus 文档。

API V2 与 Admin V2 使用 Product-First Monorepo、Source-First 开发和显式应用装配。Core 可被多个独立产品复用；Demo 是一个普通产品实例。Admin 沿用 Umi Max / React / Ant Design，小程序保持完整产品应用，通用能力由 Core App 和移动 UI 提供。

```text
apps/demo/api/              @yishan/demo-api：配置、装配、业务模块、扩展、部署
apps/demo/admin/            @yishan/demo-admin：管理后台配置、装配和业务页面
apps/demo/app/              @yishan/demo-app：独立 Taro 产品
apps/yishan-docs/           文档站
packages/yishan-tiptap/    @yishan/tiptap：独立 Rollup 编辑器与发布示例
packages/core/app/         @yishan/core-app：Taro 请求、登录、缓存、环境与公共 hooks
packages/ui/               @yishan/ui/mobile：跨产品移动组件与原有样式
packages/core/contracts/   @yishan/core-contracts：纯公共契约
packages/core/database/    @yishan/core-database：连接与迁移执行
packages/core/api/         @yishan/core-api：Fastify 平台与模块生命周期
packages/core/system-api/  @yishan/core-system-api：身份、RBAC 与系统业务
packages/core/admin/       @yishan/core-admin：Admin 运行时、模块装配和 Umi 构建插件
packages/core/system-admin/ @yishan/core-system-admin：系统管理页面与模块贡献
apps/demo/config/          Demo 产品配置（Admin 与配套小程序）
```

需要 Node **22.22.1**、pnpm **8.15.9**、MySQL 8；Redis 用于缓存与限流。版本见 `.tool-versions`。安装和运行：

```bash
pnpm install --frozen-lockfile
pnpm build:api
pnpm build:admin
pnpm typecheck:admin
# 在 apps/demo/api 配置 .env；不要提交密钥。
# 操作前确认连接的是目标环境。启动不执行迁移或 seed。
pnpm --filter @yishan/demo-api db:migrate --check
pnpm --filter @yishan/demo-api db:migrate --dry-run
pnpm --filter @yishan/demo-api db:migrate --apply
pnpm db:seed
pnpm dev:api
pnpm --filter @yishan/tiptap build
pnpm dev:admin
```

Demo 默认监听 `:3100`。认证、系统和业务 HTTP 路径保留；Swagger 位于 `/api/docs`。默认清单安装 demo、portal、shop；CRM 保留完整实现与测试，跟迁移前一样默认不安装。安装模块由 `apps/demo/api/src/manifest.ts` 决定，运行时流量由 `sys_module.enabled` 决定。禁用保留数据和路由，返回模块禁用错误；未安装模块无路由、seed 或迁移贡献。

```bash
pnpm typecheck:api
pnpm test:api
pnpm test:integration
pnpm check:boundaries
pnpm check:migrations
pnpm check:openapi
pnpm test:scripts
pnpm build:api
```

真实数据库测试只创建随机临时 schema，不使用产品数据库。集成测试环境和限制见 [迁移报告](docs/architecture/api-migration-report.md)。历史迁移存在未入 journal SQL 和 CRM 重复 DDL；这些不会在重构中被静默改写或冒充通过。

生产产物由 `scripts/package-api.mjs` 使用 pnpm 生产依赖闭包打包，包含公开 package exports、迁移和 JSON 资源；可以脱离仓库运行。先以 `PUBLIC_PATH=/admin/` 构建 Admin，再通过 `--admin apps/demo/admin/dist` 包含静态资源；线上 `/admin/` 和 `/api/` 路径不因目录迁移改变。`pnpm build:admin` 先构建共享 TipTap，两个 Admin Core 包直接消费源码，不需要预构建。FC3 配置见 [Demo 部署说明](apps/demo/api/deploy/fc3/README.md)。构建、打包与部署不执行数据库迁移，不自动发布生产。

开发指南：[模块接入](docs/module-onboarding.md)、[API V2](docs/architecture/api-v2.md)、[包边界](docs/architecture/package-boundaries.md)、[数据库所有权](docs/architecture/database-ownership.md)。贡献与安全规则见 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [SECURITY.md](SECURITY.md)。

移动端与共享组件：

`apps/demo/app` 是 Demo 配套的完整 Taro 产品（`@yishan/demo-app`），页面、业务 API、登录导航和产品配置留在应用中；没有创建无业务的 CRM/AXIS 空应用。新产品可在 `apps/<product>/app` 创建独立入口，使用自己的配置和 API，通过公开 exports 消费 Core App/UI，无需复制公共实现。

| 命令 | 实际覆盖 |
| --- | --- |
| pnpm build:mobile | Core App 编译、移动 UI 类型检查 |
| pnpm typecheck:mobile | 已安装 Taro/shim 版本、Core App、移动 UI、完整 Taro App |
| pnpm check:taro | 实际解析的 Taro/shim 版本一致性 |
| pnpm verify:tiptap | 复用 prepack，仓库外 React 18/19 tarball 消费、严格类型与单实例 |
| pnpm --filter @yishan/tiptap build / typecheck | 独立编辑器构建/类型检查 |
| pnpm --filter @yishan/demo-app build:h5 | H5 生产构建 |
| pnpm build:app | 微信小程序生产构建 |
| pnpm typecheck | TipTap、移动端、API、Admin、Docs |
| pnpm test | Core App、Taro App、Core Admin、Admin、API；数据库集成另行执行 |
| pnpm lint | Admin、Docs、Taro App、API/Admin/App 包边界检查 |
| pnpm build | Core App/UI、微信小程序、API、TipTap/Admin、Docs；H5 和独立 example 另行执行 |

TipTap 独立示例不参与根 Workspace：先 `pnpm build:tiptap`，再在 `packages/yishan-tiptap/example` 执行 `pnpm install --frozen-lockfile`、`pnpm typecheck`、`pnpm dev`。发布包可由外部项目 `pnpm add @yishan/tiptap` 消费；本轮只验证本地 tarball，没有发布 npm。新产品装配、认证策略与同源 Session key 见 [Core App 契约](packages/core/app/README.md)，构建 Host 与 shim 见 [Demo App](apps/demo/app/README.md)，发布验证见 [TipTap](packages/yishan-tiptap/README.md)。历史迁移见 [移动端迁移报告](docs/architecture/mobile-architecture-migration-report.md)，本轮证据见 [V2 工程收口报告](docs/architecture/v2-engineering-hardening-report.md)。
