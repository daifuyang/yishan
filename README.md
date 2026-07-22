# 移山通用管理系统 (Yishan Universal Management System)

一个基于 React/Ant Design Pro 前端、Fastify 后端与 Docusaurus 文档的 monorepo 项目，为 zerocmf.com 打造的通用管理基座。

## 相关链接

- 演示站点：https://admin.zerocmf.com
  测试账号请联系维护者按需申请，避免公开固定凭证
- GitHub 仓库：https://github.com/zerocmf/yishan

## 项目结构

```
yishan/
├── apps/
│   ├── yishan-admin/                 # 管理后台前端（Ant Design Pro + Umi 4）
│   ├── yishan-api/                   # 后端服务（Fastify + Drizzle + TypeBox + JWT）
│   ├── yishan-docs/                  # 文档站点（Docusaurus 3）
│   └── yishan-components/
│       └── yishan-tiptap/            # TipTap React 组件库（Rollup）
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 环境要求

- Node 与 pnpm 版本以 `.tool-versions` 和根 `package.json#packageManager` 为准
- 建议使用 asdf / mise / fnm 等工具读取 `.tool-versions` 自动切换

## 五分钟启动

```bash
# 1. 安装所有依赖（在仓库根目录）
pnpm install

# 2. 先构建共享组件库（admin 的依赖）
pnpm --filter yishan-tiptap build

# 3. 启动管理后台（Umi 开发服务器）
pnpm --filter yishan-admin dev

# 4. 启动后端（TypeScript watch + Fastify）
pnpm --filter yishan-api dev

# 5. 启动文档站点（Docusaurus 开发模式）
pnpm --filter yishan-docs start
```

## 模块发现

Yishan 通过 `apps/yishan-api/src/modules/<id>/` 装载业务能力。`routes.ts` 同时导出 `meta`（id / enabled）和一个默认 Fastify 插件；Core 在 boot 时用 `@fastify/autoload` 扫描并挂载。运行时启停由 `sys_module.enabled` 控制——首次 sync 该模块时若行不存在则用 `meta.enabled`（缺省 `true`）INSERT，已有行的 `enabled` 永不覆盖。

模块形态、依赖方向、生成物约束见 `ARCHITECTURE.md` §5 与 `AGENTS.md` §3。

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
pnpm --filter yishan-api db:generate     # 生成 Drizzle schema
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
- ORM：Drizzle
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
src/core/repositories/    # Drizzle 访问封装
src/core/mappers/         # DTO 映射
src/plugins-runtime/      # 插件运行时（发现、生命周期、持久化）
drizzle/                  # Drizzle SQL 迁移（DDL 唯一来源）
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

## 贡献流程

1. Fork 后从 `main` 创建特性分支。
2. 修改前阅读 `AGENTS.md`、`ARCHITECTURE.md`。
3. 提交前按 `AGENTS.md` §7 跑完对应改动范围的 app `lint/test/build`。
4. 遵循 `CONTRIBUTING.md` 中的提交信息与 PR 规范。

## 许可证

MIT License