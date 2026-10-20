# Yishan（移山）

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-22.22.1-339933.svg)](.tool-versions)
[![pnpm](https://img.shields.io/badge/pnpm-8.15.9-f69220.svg)](package.json)

企业应用开发基座，集成管理后台、API 服务、微信小程序与文档站点。采用产品优先的 Monorepo 结构，共享 Core 能力，独立配置与装配各产品。

## 在线演示

- 管理后台：<https://admin.zerocmf.com>
- API 文档：<https://admin.zerocmf.com/api/docs>
- 演示账号：`admin` / `admin123`（仅限演示环境）

## 核心能力

- **管理后台**：React 19、Umi、Ant Design，支持模块装配、动态菜单与权限控制。
- **API 服务**：Fastify 5、TypeBox、Drizzle、MySQL，提供身份认证、RBAC 与模块生命周期管理。
- **移动端**：基于 Taro 4，提供共享请求、会话、存储能力与移动组件。
- **接口生成**：基于后端 Schema 生成 OpenAPI 文档及前端 API 客户端。
- **文档站点**：基于 Docusaurus，分别维护产品指南与平台开发文档。

## 快速开始

### 环境要求

- Node.js ≥ 22.0.0（推荐 22.22.1）
- pnpm ≥ 8.0.0（推荐 8.15.9）
- MySQL 8.x
- Redis（可选，用于缓存与限流）

### 安装与配置

```bash
git clone https://github.com/daifuyang/yishan.git
cd yishan
pnpm install --frozen-lockfile
cp apps/demo/api/.env.example apps/demo/api/.env
```

编辑 `apps/demo/api/.env`，配置数据库连接、JWT 密钥与初始管理员密码：

```dotenv
DATABASE_URL=mysql://user:password@localhost:3306/yishan
JWT_SECRET=<至少32字符的随机密钥>
SEED_ADMIN_PASSWORD=<管理员初始密码>
```

### 初始化数据库

```bash
pnpm build:api
pnpm --filter @yishan/demo-api db:migrate --dry-run
pnpm --filter @yishan/demo-api db:migrate --apply
pnpm db:seed
```

初始管理员为 `admin`，密码取自 `SEED_ADMIN_PASSWORD`。应用启动不自动执行迁移或初始化；生产环境执行 seed 需设置 `ALLOW_PRODUCTION_SEED=true`。

### 启动开发服务

在独立终端中分别启动 API 与管理后台：

```bash
# API
pnpm dev:api

# 管理后台
pnpm build:tiptap
pnpm dev:admin
```

| 服务 | 本地地址 |
| --- | --- |
| 管理后台 | <http://localhost:8000> |
| API 文档 | <http://localhost:3100/api/docs> |

## 仓库结构

```text
apps/
  demo/
    admin/                 管理后台
    api/                   API 服务与业务模块
    app/                   Taro 小程序
    config/                产品共享配置
    docs/                  产品文档
  portal/docs/             平台开发文档
packages/
  core/
    contracts/             公共契约
    database/              数据库连接与迁移
    api/                   API 运行时与模块管理
    system-api/            身份认证、权限与系统服务
    admin/                 Admin 运行时与构建插件
    system-admin/          系统管理页面
    app/                   Taro 请求、会话与存储
    docs-kit/              共享文档配置与主题
  ui/                      移动端组件
  yishan-tiptap/            富文本编辑器
docs/                      架构、ADR 与工程规范
```

API 模块通过 [manifest.ts](apps/demo/api/src/manifest.ts) 显式安装，运行状态由 `sys_module.enabled` 控制。

## 常用命令

在仓库根目录执行：

| 命令 | 说明 |
| --- | --- |
| `pnpm dev:api` | 启动 API 开发服务 |
| `pnpm dev:admin` | 启动管理后台开发服务 |
| `pnpm dev:app` | 启动微信小程序开发构建 |
| `pnpm dev:docs` | 启动产品文档站点 |
| `pnpm lint` | 代码检查与包边界校验 |
| `pnpm typecheck` | 类型检查 |
| `pnpm test` | 单元测试 |
| `pnpm test:integration` | 数据库集成测试 |
| `pnpm build` | 构建全部应用与共享包 |
| `pnpm check:openapi` | 检查 OpenAPI 同步状态 |
| `pnpm check:migrations` | 检查迁移历史与清单 |
| `pnpm --filter @yishan/demo-admin openapi` | 生成前端 API 客户端 |

## 部署

| 环境 | 部署方式 | 文档 |
| --- | --- | --- |
| Ubuntu | Admin、API 与 Nginx 同机部署 | [部署指南](apps/demo/api/deploy/ubuntu/README.md) |
| 阿里云 FC | Function Compute 3 | [部署指南](apps/demo/api/deploy/fc3/README.md) |

Admin 构建配置 `PUBLIC_PATH` 须与 API 的 `ADMIN_BASE_PATH` 一致。生产依赖打包需在 Linux 环境执行，数据库迁移须在服务发布前单独执行。

## 文档

| 主题 | 文档 |
| --- | --- |
| 产品指南 | [Demo 文档](apps/demo/docs/content) |
| 模块接入 | [接入指南](apps/portal/docs/content/modules/onboarding.md) |
| API 架构 | [API V2](docs/architecture/api-v2.md) |
| 包边界 | [依赖规范](docs/architecture/package-boundaries.md) |
| 数据库 | [所有权规范](docs/architecture/database-ownership.md) |
| 模块契约 | [契约说明](docs/architecture/module-contract.md) |
| 移动端 | [Core App](packages/core/app/README.md) |

## 贡献

参见 [贡献指南](CONTRIBUTING.md)。安全问题请按 [安全策略](SECURITY.md) 报告。

## 许可证

[MIT](LICENSE) © zerocmf
