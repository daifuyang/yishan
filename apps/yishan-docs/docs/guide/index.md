---
sidebar_position: 1
sidebar_label: 指南首页
---

# 移山快速开发平台

基于 Next.js 15 + TypeScript + Tailwind CSS 的现代化全栈开发解决方案。

## ✨ 特性

- **现代化技术栈** - Next.js 15, TypeScript, Tailwind CSS
- **组件化设计** - 基于 shadcn/ui 的丰富组件库
- **开发效率** - 热重载、自动代码分割、优化构建
- **全栈支持** - 前后端一体化开发体验

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18.0.0
- pnpm ≥ 8.0.0

### 安装启动

```bash
# 克隆项目
git clone <repository-url>
cd yishan

# 安装依赖
pnpm install

# 启动开发环境
pnpm dev          # 启动所有服务
pnpm dev:admin    # 仅启动管理后台
pnpm dev:docs     # 仅启动文档站点
```

访问地址：
- 管理后台: http://localhost:3000
- 文档站点: http://localhost:3001

## 📁 项目结构

```
yishan/
├── apps/
│   ├── yishan-admin/     # 管理后台
│   └── yishan-docs/      # 文档站点
├── packages/
│   └── shadcn/          # 共享组件库
└── pnpm-workspace.yaml  # 工作空间配置
```

## 📚 文档导航

- [快速上手](/guide/quick-start) - 5分钟上手教程
- [组件文档](/components) - 组件使用指南
- [管理后台](/admin) - 后台开发文档
- [最佳实践](/guide/best-practices) - 开发规范与技巧