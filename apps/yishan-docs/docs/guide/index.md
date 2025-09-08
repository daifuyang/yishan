---
sidebar_position: 1
sidebar_label: 系统介绍
---

# 移山快速开发平台

基于 Next.js 15 + TypeScript + Tailwind CSS 的现代化全栈开发解决方案，采用 Monorepo 架构设计，为团队协作和代码复用提供最佳实践。

## ✨ 核心特性

- **现代化技术栈** - Next.js 15 App Router、React 19、TypeScript 5.8、Tailwind CSS 4
- **组件化架构** - 基于 shadcn/ui 的企业级组件库，支持主题定制和响应式设计
- **Monorepo 管理** - 使用 pnpm workspace 统一管理多包依赖，提升代码复用率
- **开发效率** - 热重载、Turbopack 构建优化、自动代码分割
- **类型安全** - 全链路 TypeScript 支持，从组件到 API 的完整类型定义
- **文档驱动** - Docusaurus 驱动的现代化文档站点，支持 MDX 和搜索

## 🎯 技术架构

### 技术栈
- **前端框架**: Next.js 15 (App Router + Turbopack)
- **语言**: TypeScript 5.8
- **样式**: Tailwind CSS 4 + CSS Variables
- **组件库**: shadcn/ui + Radix UI
- **包管理**: pnpm workspace
- **构建工具**: tsup + Vite

### 项目结构

```
yishan/
├── apps/
│   ├── yishan-admin/          # 管理后台应用
│   │   ├── app/               # Next.js App Router
│   │   ├── components/        # 业务组件
│   │   └── lib/              # 工具函数
│   └── yishan-docs/          # 文档站点
│       ├── docs/             # 文档内容
│       ├── blog/             # 技术博客
│       └── src/              # 自定义页面
├── packages/
│   └── shadcn/              # 共享组件库
│       ├── components/       # 通用组件
│       ├── lib/             # 工具库
│       └── dist/            # 构建输出
└── pnpm-workspace.yaml      # Monorepo 配置
```

## 🚀 快速开始

### 环境要求

- **Node.js**: ≥ 18.0.0 (推荐 20.x)
- **包管理器**: pnpm ≥ 8.0.0
- **Git**: 用于版本控制

### 安装与启动

```bash
# 克隆项目
git clone git@github.com:daifuyang/yishan.git
cd yishan

# 安装所有依赖
pnpm install

# 启动开发环境
pnpm dev:admin      # 启动管理后台
pnpm dev:docs       # 启动文档站点
pnpm dev:shadcn     # 启动组件库开发

# 构建生产版本
pnpm build          # 构建所有包
```

### 开发工作流

```bash
# 组件库开发
pnpm --filter @yishan/shadcn dev

# 管理后台开发
pnpm --filter yishan-admin dev

# 文档站点开发
pnpm --filter yishan-docs start
```

## 📊 性能指标

- **构建时间**: Turbopack 增量构建，开发启动 < 1s
- **包体积**: 基于 Tree-shaking 的优化，生产包体积减少 40%
- **类型检查**: 全项目类型检查 < 5s
- **热更新**: 毫秒级热重载，保持应用状态

## 🔧 开发规范

- **代码风格**: ESLint + Prettier 自动格式化
- **提交规范**: Conventional Commits 标准化提交信息
- **分支策略**: Git Flow 工作流，feature/、hotfix/ 前缀
- **代码审查**: Pull Request 模板 + 自动化检查

## 📚 文档导航

- [快速上手](/docs/guide/quick-start) - 5分钟环境配置与第一个页面
- [组件文档](/docs/components) - 完整的组件使用指南与示例
- [管理后台](/docs/admin) - 后台系统架构与开发最佳实践
- [最佳实践](/docs/guide/best-practices) - 代码规范、性能优化、部署指南
