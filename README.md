# Yishan（移山）

企业应用通用基座：React 19 / Umi / Ant Design 管理后台、Fastify 5 / TypeBox / Drizzle / MySQL 后端、微信小程序与 Docusaurus 文档。

API V2 与 Admin V2 使用 Product-First Monorepo、Source-First 开发和显式应用装配。Core 可被多个独立产品复用；Demo 是一个普通产品实例。Admin 沿用 Umi Max / React / Ant Design，小程序保持现有组织方式。

```text
apps/demo/api/              @yishan/demo-api：配置、装配、业务模块、扩展、部署
apps/demo/admin/            @yishan/demo-admin：管理后台配置、装配和业务页面
apps/yishan-app/            小程序
apps/yishan-docs/           文档站
apps/yishan-components/     共享编辑器
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
pnpm --filter yishan-tiptap build
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
