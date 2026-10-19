# Yishan（移山）

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-22.22.1-339933.svg)](.tool-versions)
[![pnpm](https://img.shields.io/badge/pnpm-8.15.9-f69220.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg)](tsconfig.json)

> 企业应用通用基座 —— React 19 / Umi / Ant Design 管理后台、Fastify 5 / TypeBox / Drizzle / MySQL 后端、微信小程序与 Docusaurus 文档。

Product-First Monorepo + Source-First 开发。Core 可被多个独立产品复用，Demo 只是其中一个普通产品实例。

---

## 目录

- [演示环境](#演示环境)
- [核心能力](#核心能力)
- [快速开始](#快速开始)
- [仓库结构](#仓库结构)
- [常用命令](#常用命令)
- [配置](#配置)
- [部署](#部署)
- [架构与文档](#架构与文档)
- [贡献与安全](#贡献与安全)
- [许可证](#许可证)

---

## 演示环境

线上演示站点可直接访问，无需自建环境：

| 环境 | 地址 | 形态 |
| --- | --- | --- |
| 管理后台 | <https://admin.zerocmf.com> | 独立子域名，Admin 占根路径 `/` |
| API | `https://admin.zerocmf.com/api` | 与后台同源，Swagger 在 `/api/docs` |
| 生产环境 | 阿里云 FC（Function Compute） | 挂载在 `/admin/` 前缀下 |

### 演示账号

**仓库不存放任何账号口令**，包括演示环境的。这是刻意的：口令进 git 就等于永久泄漏，`git log` 里删不掉。

| 你要什么 | 怎么拿 |
| --- | --- |
| 线上演示站点（`admin.zerocmf.com`）登录口令 | 向维护者索取 |
| 本地自建环境的初始管理员口令 | 由你自己设定，见下方「快速开始」 |

维护者联系方式与发布渠道见 [SECURITY.md](SECURITY.md)。

### 本地初始管理员

`db:seed` 只创建**账号**，不创建口令——口令必须由你通过环境变量注入，seed 会拒绝在缺口令时执行：

```bash
# apps/demo/api/.env
ALLOW_PRODUCTION_SEED=true      # 仅当你要在非生产库执行时才需要
SEED_ADMIN_PASSWORD=<你自己的强口令>
```

seed 写入的账号是固定的：

| 字段 | 值 |
| --- | --- |
| 用户名 | `admin` |
| 密码 | 你设置的 `SEED_ADMIN_PASSWORD` |
| 角色 | 超级管理员（可访问全部已启用模块） |

其余种子数据（部门、岗位、菜单、字典、省市区）同样来自 `packages/core/system-api/src/scripts/seed/config/`，全是幂等的 INSERT ... ON DUPLICATE KEY UPDATE。

---

## 核心能力

- **API V2** —— `ApiModule` 契约（contractVersion 2）+ 显式运行时装配。Core 校验并拓扑排序模块，不扫描应用目录；路由 → 服务 → 仓储 → schema 是单向的，只有仓储执行 SQL。
- **Admin V2** —— `@yishan/core-admin` 运行时 + 公开 Umi 构建插件；`@yishan/core-system-admin` 贡献系统管理页面。菜单结构由后端 `sys_menu.component` 驱动，前端路由表保持精简。
- **移动端** —— 独立 Taro 4 产品 + `@yishan/core-app`（请求、登录、存储、环境、hooks）+ `@yishan/ui/mobile`。Core 永不引用任何产品或后端运行时。
- **OpenAPI 双向同步** —— 后端 schema 生成前端客户端，产物按 System / Product 两个分区各归其主。

---

## 快速开始

需要 **Node 22.22.1**、**pnpm 8.15.9**、**MySQL 8**；Redis 用于缓存与限流。版本固定在 `.tool-versions`，用 asdf / mise / fnm 可自动切换。

```bash
git clone <this-repo>
cd yishan
pnpm install --frozen-lockfile
```

配置 `apps/demo/api/.env`（参考 `.env.example`，**不要提交密钥**），然后：

```bash
# 数据库迁移 —— 三步走，--apply 才是真正写入
pnpm build:api                                       # migrate/seed 跑的是 dist/，必须先构建
pnpm --filter @yishan/demo-api db:migrate --check     # 检查 pending
pnpm --filter @yishan/demo-api db:migrate --dry-run   # 预演
pnpm --filter @yishan/demo-api db:migrate --apply     # 显式写入

# 种子数据（需要先设置 SEED_ADMIN_PASSWORD）
pnpm --filter @yishan/demo-api db:seed

# 启动（各自独立终端）
pnpm dev:api                                      # API，:3100
pnpm --filter @yishan/tiptap build                # Admin 依赖已构建的 tiptap
pnpm --filter @yishan/demo-admin dev              # Admin，:8000
```

> **启动不执行迁移，也不执行 seed。** 这两步永远是显式的——操作前请确认连的是目标环境。

Swagger 位于 `http://localhost:3100/api/docs`。

---

## 仓库结构

```text
apps/demo/api/              @yishan/demo-api：配置、装配、业务模块、扩展、部署
apps/demo/admin/            @yishan/demo-admin：管理后台配置、装配和业务页面
apps/demo/app/              @yishan/demo-app：独立 Taro 产品
apps/demo/config/           Demo 产品配置（Admin 与配套小程序共享）
apps/demo/docs/             @yishan/demo-docs：Demo 产品文档
apps/portal/docs/           @yishan/portal-docs：平台开发者文档
packages/core/contracts/    @yishan/core-contracts：纯公共契约
packages/core/database/     @yishan/core-database：连接与迁移执行
packages/core/api/          @yishan/core-api：Fastify 平台与模块生命周期
packages/core/system-api/   @yishan/core-system-api：身份、RBAC 与系统业务
packages/core/admin/        @yishan/core-admin：Admin 运行时、模块装配和 Umi 构建插件
packages/core/system-admin/ @yishan/core-system-admin：系统管理页面与模块贡献
packages/core/app/          @yishan/core-app：Taro 请求、登录、缓存、环境与公共 hooks
packages/core/docs-kit/     @yishan/docs-kit：共享 Docusaurus 配置、主题与组件
packages/ui/                @yishan/ui/mobile：跨产品移动组件与原有样式
packages/yishan-tiptap/     @yishan/tiptap：独立 Rollup 编辑器
docs/                        架构、ADR、工程规范与贡献指南
```

模块的启停：安装的模块清单由 `apps/demo/api/src/manifest.ts` 决定，运行时流量由 `sys_module.enabled` 决定。禁用保留数据与路由并返回「模块已禁用」；未安装的模块没有路由、seed 或迁移贡献。默认安装 demo、portal、shop；CRM 保留完整实现与测试，默认不安装。

---

## 常用命令

全部从仓库根目录执行。

```bash
pnpm lint        # Admin 包 + 产品（Biome/tsc）+ docs/app + 边界检查
pnpm test        # Core App、Taro App、Core Admin、Admin（Jest）、API（Vitest）
pnpm build       # Core App/UI → weapp → API → tiptap → admin → docs
pnpm typecheck   # TipTap、移动端、API、Admin、Docs
```

其余常用：

| 命令 | 覆盖范围 |
| --- | --- |
| `pnpm dev:api` | Fastify watch + 自动重载 |
| `pnpm --filter @yishan/demo-admin dev` | Umi dev server |
| `pnpm check:boundaries` | 包边界与依赖方向（含移动端公开 exports） |
| `pnpm check:openapi` | OpenAPI 产物与后端 schema 同步 |
| `pnpm check:migrations` | 迁移一致性 |
| `pnpm test:integration` | 一次性本地 MySQL fixture（**只建随机临时 schema，不碰产品库**） |
| `pnpm --filter @yishan/demo-admin openapi` | 从后端 schema 重新生成 API 客户端 |
| `pnpm check:taro` | 实际解析到的 Taro / shim 版本一致性 |
| `pnpm verify:tiptap` | 仓库外 React 18/19 tarball 消费与单实例验证 |
| `pnpm typecheck:mobile` / `pnpm build:app` | 移动端类型检查 / 微信小程序构建 |

TipTap 独立示例不参与根 workspace：先 `pnpm build:tiptap`，再在 `packages/yishan-tiptap/example` 内独立 `pnpm install` / `typecheck` / `dev`。

提交遵循 [Conventional Commits](https://www.conventionalcommits.org/)；lint-staged + husky 已在 `@yishan/demo-admin` 接线。

---

## 配置

`apps/demo/api/.env` 关键项：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3100` | API 监听端口 |
| `DATABASE_URL` | — | MySQL 连接串 |
| `JWT_SECRET` | — | **生产环境为空或弱值时拒绝启动**（见 [jwt-secret-validator.ts](packages/core/system-api/src/core/plugins/external/jwt-secret-validator.ts)） |
| `SEED_ADMIN_PASSWORD` | — | seed 初始管理员口令 |
| `ADMIN_BASE_PATH` | `/admin` | Admin 挂载路径 |
| `ADMIN_REDIRECT_ROOT` | `true` | 是否把 `/` 301 到 `ADMIN_BASE_PATH` |

### 路径形态必须前后一致

Admin 挂在哪个前缀，由**构建时**和**运行时**两处共同决定，只改一处必然白屏：

```bash
# 构建时：产物里资源 URL 的前缀
PUBLIC_PATH=/ pnpm --filter @yishan/demo-admin build
```

```ini
# 运行时：apps/demo/api/.env 或部署环境变量
ADMIN_BASE_PATH=/
ADMIN_REDIRECT_ROOT=false
```

判断是否同步：产物 `public/admin/index.html` 里的资源引用应为 `/umi.*`（而不是 `/admin/umi.*`）。

> Admin 独占根路径时，SPA fallback 会覆盖整个站点。所有 `/api/*` 请求的处理见
> [`static.ts`](packages/core/system-api/src/core/plugins/external/static.ts)——那里把 API 前缀显式让给全局 404，并把旧的 `/admin` 前缀 301 回根路径。改这个文件前先读它的注释。

---

## 部署

| 目标 | 说明 |
| --- | --- |
| 演示环境（腾讯云 Ubuntu 单机） | Admin + API + nginx 同机，Admin 静态由后端托管。完整 runbook 见 **[deploy/ubuntu/README.md](apps/demo/api/deploy/ubuntu/README.md)** |
| 生产环境（阿里云 FC） | `PUBLIC_PATH=/admin/`，配置见 [deploy/fc3/README.md](apps/demo/api/deploy/fc3/README.md) 与 `.github/workflows/yishan-api-cd.yml` |

生产产物由 `scripts/package-api.mjs` 用 pnpm 生产依赖闭包打包，包含公开 package exports、迁移和 JSON 资源，可以脱离仓库运行。

> **构建、打包与部署都不执行数据库迁移，也不会自动发布。** DDL 不保证事务回滚，迁移必须在 API 起来之前单独执行。

---

## 架构与文档

| 主题 | 文档 |
| --- | --- |
| 模块接入 | [apps/portal/docs/content/modules/onboarding.md](apps/portal/docs/content/modules/onboarding.md) |
| API V2 | [docs/architecture/api-v2.md](docs/architecture/api-v2.md) |
| 包边界 | [docs/architecture/package-boundaries.md](docs/architecture/package-boundaries.md) |
| 数据库所有权 | [docs/architecture/database-ownership.md](docs/architecture/database-ownership.md) |
| 模块契约 | [docs/architecture/module-contract.md](docs/architecture/module-contract.md) |
| Core App 契约 | [packages/core/app/README.md](packages/core/app/README.md) |
| 移动端表单规范 | [docs/design/mobile-form-spec.md](docs/design/mobile-form-spec.md) |
| 文档内容归属 | [docs/architecture/documentation-ownership.md](docs/architecture/documentation-ownership.md) |

产品指南只维护在 `apps/demo/docs/content`；架构 / ADR / 历史工程记录只维护在根 `docs/`。

---

## 贡献与安全

- 贡献流程：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全策略与漏洞上报：[SECURITY.md](SECURITY.md)
- 提交前请跑 `pnpm lint && pnpm test && pnpm build`（覆盖你改动到的范围）
- **永远不要提交密钥与口令**：`.env` 已在 `.gitignore` 中，口令只通过环境变量注入

---

## 许可证

[MIT](LICENSE) © zerocmf
