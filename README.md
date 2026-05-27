# 移山通用管理系统 (Yishan Universal Management System)

一个基于 React/Ant Design Pro 前端、Fastify 后端与 Docusaurus 文档的 monorepo 项目，为 zerocmf.com 打造的通用管理解决方案。

## 相关链接

- 演示站点：https://admin.zerocmf.com
  测试账号请联系维护者按需申请，避免公开固定凭证
- GitHub 仓库：https://github.com/zerocmf/yishan

## 项目结构

```
yishan/
├── apps/
│   ├── yishan-admin/                 # 管理后台前端（Ant Design Pro + Umi 4）
│   ├── yishan-api/                   # 后端服务（Fastify + Prisma + TypeBox + JWT）
│   ├── yishan-docs/                  # 文档站点（Docusaurus 3）
│   └── yishan-components/
│       └── yishan-tiptap/            # TipTap React 组件库（Rollup）
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 环境要求

- Node.js >= 20.0.0（与前端 `yishan-admin` 要求一致）
- pnpm >= 8.0.0

## 快速开始

```bash
# 安装所有依赖（在仓库根目录）
pnpm install

# 启动管理后台（Umi 开发服务器）
pnpm --filter yishan-admin dev

# 启动后端（TypeScript watch + Fastify）
pnpm --filter yishan-api dev

# 启动文档站点（Docusaurus 开发模式）
pnpm --filter yishan-docs start
```

## 常用脚本

```bash
# 管理后台
pnpm --filter yishan-admin build         # 生产构建
pnpm --filter yishan-admin preview       # 本地预览（构建后）
pnpm --filter yishan-admin test          # 前端单元测试
pnpm --filter yishan-admin lint          # 代码检查（Biome + TS）

# 后端服务
pnpm --filter yishan-api start           # 生产启动（含编译）
pnpm --filter yishan-api test            # 后端测试（Vitest）
pnpm --filter yishan-api db:generate     # 生成 Prisma 客户端
pnpm --filter yishan-api db:init         # 初始化迁移
pnpm --filter yishan-api db:seed         # 运行种子数据

# 文档站点
pnpm --filter yishan-docs build          # 文档构建
pnpm --filter yishan-docs serve          # 本地预览

# 组件库（TipTap）
pnpm --filter yishan-tiptap build        # Rollup 构建
pnpm --filter yishan-tiptap dev          # 开发模式（watch）
```

## 技术栈

### 前端（yishan-admin）
- 框架：React 19 + TypeScript
- 构建：UmiJS 4（@umijs/max）
- UI：Ant Design 6
- 样式：Less + antd-style
- 代码规范：Biome
- 测试：Jest（含覆盖率）、Playwright（部分模块）
- OpenAPI：通过 `max openapi` 生成 API 类型与服务

### 后端（yishan-api）
- 框架：Fastify 5
- 类型与校验：TypeBox（JSON Schema）
- ORM：Prisma 7
- 认证：JWT
- 缓存：Redis（可选）
- 文档：Swagger + Swagger UI
- 测试：Vitest

### 文档（yishan-docs）
- 框架：Docusaurus 3（React 19）
- 类型检查：TypeScript

### 组件库（yishan-tiptap）
- 编辑器：TipTap 3
- UI：Radix UI、Floating UI
- 构建：Rollup（CJS/ESM/types/css 输出）

## 目录概览

### apps/yishan-admin
```
config/                   # Umi 配置（routes、proxy、defaultSettings）
mock/                     # 本地 mock 数据
public/                   # 静态资源（含 manifest）
src/                      # 业务代码（pages、components、services、locales、hooks、types）
```

### apps/yishan-api
```
src/app.ts                # Fastify 应用入口
src/server.ts             # 启动脚本
src/core/routes/          # 核心 API 路由（auth、users、roles、menus、departments 等）
src/core/schemas/         # TypeBox 模式定义
src/core/services/        # 核心业务服务层
src/core/models/          # Prisma 访问封装
src/plugins-runtime/      # 插件运行时（发现、生命周期、持久化）
src/plugins/modules/      # 插件模块（portal、hello 等）
prisma/schema/            # Prisma 多文件数据模型
```

### apps/yishan-docs
```
docs/                     # 文档内容
blog/                     # 博客
src/                      # 自定义页面与组件
docusaurus.config.ts      # 配置文件
```

### apps/yishan-components/yishan-tiptap（构建 admin 前需先构建）
```
src/                      # 组件源码
rollup.config.js          # 构建配置
dist/                     # 构建产物（cjs、esm、d.ts、css）
```

## 开发状态

## 业务功能实现现状（当前代码）

以下内容基于当前仓库已有页面与接口代码整理。

### 已实现（前后端均有代码）
- 认证与会话：登录、JWT 鉴权、登录日志
- 用户与权限：用户管理、角色管理、菜单管理、部门管理
- 系统配置：系统选项（Site 配置页）、字典管理（字典类型/字典数据）
- 文件与存储：附件管理、本地存储配置、七牛云存储配置
- 应用管理：应用列表与详情管理（含资源配置）

### 已实现（前端页面已落地）
- 内容管理：文章、分类、页面、文章模板、页面模板
- 组织岗位：岗位管理（Post）

### 工程与平台能力
- OpenAPI/Swagger 文档入口
- CI 校验链路（admin/api/tiptap）
- FC3 部署链路（API + Admin 静态资源）

### 主要代码位置
- 后端核心路由：`apps/yishan-api/src/core/routes/api/v1/admin`
- 认证路由：`apps/yishan-api/src/core/routes/api/v1/auth`
- 插件路由：`apps/yishan-api/src/plugins/modules/*/routes`
- 后台页面：`apps/yishan-admin/src/pages/system`、`apps/yishan-admin/src/pages/portal`

### 菜单命名与功能对照（深度检查）

以下对照基于当前“动态菜单（后端 seed）+ 前端页面 + 后端接口”综合判断。

| 菜单路径 | 菜单名称 | 前端页面 | 后端接口 | 状态 |
| --- | --- | --- | --- | --- |
| `/system/user` | 用户管理 | `system/user` | `api/v1/admin/users` | 已实现 |
| `/system/role` | 角色管理 | `system/role` | `api/v1/admin/roles` | 已实现 |
| `/system/department` | 部门管理 | `system/department` | `api/v1/admin/departments` | 已实现 |
| `/system/post` | 岗位管理 | `system/post` | `api/modules/portal/v1/admin/posts` | 已实现（命名域待统一） |
| `/system/menu` | 菜单管理 | `system/menu` | `api/v1/admin/menus` | 已实现 |
| `/system/dict` | 字典管理 | `system/dict` | `api/v1/admin/dicts` | 已实现 |
| `/system/site` | 站点配置 | `system/site` | `api/v1/admin/system/options` | 已实现 |
| `/system/storage` | 云存储 | `system/storage` | `api/v1/admin/system/storage` + `api/v1/admin/system/qiniu` | 已实现 |
| `/system/attachments` | 媒体库 | `system/attachments` | `api/v1/admin/attachments` | 已实现 |
| `/system/login-log` | 登录日志 | `system/login-log` | `api/v1/admin/system/login-logs` | 已实现 |
| `/system/apps` | 应用管理 | `system/apps` | `api/v1/admin/apps` | 已实现 |
| `/plugins/yishan/portal/articles` | 文章管理 | `portal/articles` | `api/modules/portal/v1/admin/articles` | 已实现 |
| `/plugins/yishan/portal/pages` | 页面管理 | `portal/pages` | `api/modules/portal/v1/admin/pages` | 已实现 |
| `/plugins/yishan/portal/categories` | 分类管理 | `portal/categories` | `api/modules/portal/v1/admin/articles`（分类子接口） | 已实现 |
| `/plugins/yishan/portal/article-templates` | 文章模板 | `portal/article-templates` | `api/modules/portal/v1/admin/articles`（模板接口） | 已实现 |
| `/plugins/yishan/portal/page-templates` | 页面模板 | `portal/page-templates` | `api/modules/portal/v1/admin/pages`（模板接口） | 已实现 |

命名规范上目前还有这些可优化点（不影响功能使用，但影响可维护性）：

1. **领域边界不一致**：`/system/post` 页面实际调用 `portalPosts` 服务（`/api/modules/portal/.../posts`），建议统一为 system 域或组织域命名。
2. **菜单与页面挂载来源不同**：菜单以后端 `sys_menu` 与插件 manifest 同步结果为准，前端 `routes.ts` 只负责页面挂载和访问控制，新增插件时需同步检查前后端 manifest。
3. **历史 i18n 菜单键残留**：`src/locales/zh-CN/menu.ts` 中仍有大量模板示例键（dashboard/form/list 等），与当前业务菜单不一致，建议精简避免误导。

### 已完成
- monorepo 初始化与 pnpm 工作空间配置
- 管理后台基础框架（Ant Design Pro + Umi）
- 后端基础框架（Fastify + Prisma + TypeBox + JWT）
- 文档站点（Docusaurus）
- TipTap 组件库（Rollup 构建与类型产出）

### 进行中
- 管理后台核心模块页面（用户、角色、菜单、部门、文章等）
- OpenAPI 对齐与前后端联调
- 部署脚本与环境配置优化

### 计划中
- 文件管理与富文本增强
- 系统监控与日志采集
- 国际化与主题增强
- 数据导入/导出

## 许可证

MIT License
