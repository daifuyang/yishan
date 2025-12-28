# 移山通用管理系统 (Yishan Universal Management System)

一个基于 React/Ant Design Pro 前端、Fastify 后端与 Docusaurus 文档的 monorepo 项目，为 zerocmf.com 打造的通用管理解决方案。

## 相关链接

- 演示站点：https://admin.zerocmf.com
  账号密码：admin/admin123
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
- UI：Ant Design 5
- 样式：Less + antd-style
- 代码规范：Biome
- 测试：Jest（含覆盖率）、Playwright（部分模块）
- OpenAPI：通过 `max openapi` 生成 API 类型与服务

### 后端（yishan-api）
- 框架：Fastify 5
- 类型与校验：TypeBox（JSON Schema）
- ORM：Prisma 6
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
src/routes/               # API 路由（admin/users、roles、menus、posts、departments 等）
src/schemas/              # TypeBox 模式定义
src/services/             # 业务服务层
prisma/schema/            # Prisma 数据模型
```

### apps/yishan-docs
```
docs/                     # 文档内容
blog/                     # 博客
src/                      # 自定义页面与组件
docusaurus.config.ts      # 配置文件
```

### apps/yishan-components/yishan-tiptap
```
src/                      # 组件源码
rollup.config.js          # 构建配置
dist/                     # 构建产物（cjs、esm、d.ts、css）
```

## 开发状态

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
