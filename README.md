# 移山通用管理系统 (Yishan Universal Management System)

一个基于现代技术栈的快速开发管理系统 monorepo 项目，专为 zerocmf.com 打造的通用管理解决方案。

## 🎯 项目愿景

移山通用管理系统旨在为开发者提供一套完整、高效、可扩展的后台管理系统解决方案。通过现代化的技术栈和最佳实践，实现快速开发和部署。

## 📁 项目结构

```
yishan/
├── apps/                     # 应用层
│   ├── yishan-admin/        # 管理后台应用 (Next.js 15)
│   └── yishan-docs/         # 项目文档站点 (Docusaurus)
├── packages/                  # 共享包和组件库
│   └── shadcn/              # shadcn/ui 组件库 (TypeScript + Rollup)
├── package.json              # 根项目配置
├── pnpm-workspace.yaml       # pnpm 工作空间配置
├── pnpm-lock.yaml           # 依赖锁定文件
└── README.md                # 项目说明文档
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
# 安装所有依赖
pnpm install

# 启动文档站点
pnpm --filter yishan-docs dev

# 启动管理后台
pnpm --filter yishan-admin dev
```

### 开发工作流

```bash
# 安装所有依赖
pnpm install

# 启动文档站点开发模式
pnpm --filter yishan-docs dev

# 启动管理后台开发模式
pnpm --filter yishan-admin dev

# 构建所有项目
pnpm build

# 构建特定项目
pnpm --filter @yishan/shadcn build
pnpm --filter yishan-docs build
pnpm --filter yishan-admin build

# 运行测试
pnpm test
```

## 📦 项目组成

### 1. 管理后台应用 (yishan-admin)
基于 Next.js 15 构建的现代化管理后台，包含：
- **技术栈**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **UI组件**: shadcn/ui, Radix UI
- **认证**: NextAuth.js
- **数据库**: Prisma ORM
- **状态管理**: Zustand
- **表单处理**: React Hook Form + Zod
- **部署**: Vercel 优化

### 2. 项目文档站点 (yishan-docs)
基于 Docusaurus 构建的项目文档中心，包含：
- 项目架构文档
- 开发指南
- API 文档
- 最佳实践
- 更新日志
- 组件使用示例

### 3. 共享组件库 (@yishan/shadcn)
基于 shadcn/ui 的共享 UI 组件库，特点：
- **技术栈**: TypeScript, Rollup, Tailwind CSS
- **组件**: 基于 shadcn/ui 的现代化组件
- **构建**: Rollup 构建，支持 CommonJS 和 ES modules
- **类型**: 完整的 TypeScript 类型声明 (.d.ts)
- **样式**: 支持 CSS 提取和优化
- **发布**: 支持 npm 包发布

## 🛠️ 技术栈

### 前端技术
- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript 5.6+
- **UI库**: shadcn/ui + Radix UI
- **样式**: Tailwind CSS 4.x
- **状态管理**: Zustand
- **表单**: React Hook Form + Zod
- **HTTP**: Axios / fetch

### 后端技术
- **框架**: Next.js 15 API Routes
- **ORM**: Prisma 6.x
- **数据库**: PostgreSQL (推荐) / MySQL / SQLite
- **认证**: NextAuth.js v5
- **文件上传**: UploadThing
- **缓存**: Redis (可选)

### 开发工具
- **包管理**: pnpm 10.x
- **代码规范**: ESLint 9.x + Prettier
- **Git Hooks**: Husky + lint-staged
- **UI文档**: Storybook (即将集成)
- **测试**: Vitest + Playwright
- **构建**: Rollup, Next.js build
- **部署**: Vercel (推荐) / Docker

## 📁 目录详解

### apps/yishan-admin/
```
yishan-admin/
├── app/                     # Next.js 15 App Router
│   ├── (auth)/             # 认证相关页面
│   ├── (dashboard)/        # 管理后台页面
│   ├── api/                # API 路由
│   └── globals.css         # 全局样式
├── components/             # 业务组件
├── lib/                    # 工具函数和配置
├── public/                 # 静态资源
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖
└── tsconfig.json           # TypeScript 配置
```

### apps/yishan-docs/
```
yishan-docs/
├── blog/                   # 博客文章
├── docs/                   # 文档内容
│   ├── api/               # API 文档
│   ├── components/        # 组件文档
│   └── guides/          # 使用指南
├── src/                   # 自定义页面和组件
├── static/               # 静态资源
├── docusaurus.config.ts  # Docusaurus 配置
└── sidebars.ts          # 文档侧边栏配置
```

### packages/shadcn/
```
shadcn/
├── components/            # shadcn/ui 组件
│   └── ui/              # 基础 UI 组件
├── lib/                 # 工具函数
├── dist/                # 构建输出
│   ├── index.js         # CommonJS 构建
│   ├── index.esm.js     # ES modules 构建
│   ├── index.d.ts       # 类型声明
│   └── index.css        # 样式文件
├── rollup.config.js     # Rollup 构建配置
├── tsconfig.json        # TypeScript 配置
└── package.json         # 包配置
```

## 📖 文档导航

### 快速入门
- [环境搭建](./docs/development.md#环境搭建) - 开发环境配置
- [项目启动](./docs/development.md#项目启动) - 启动开发服务器
- [代码规范](./docs/development.md#代码规范) - ESLint + Prettier 配置

### 开发指南
- [组件开发](./docs/components.md) - 如何开发新组件
- [API开发](./docs/api.md) - 如何创建 API 接口
- [数据库操作](./docs/database.md) - Prisma 使用指南
- [认证集成](./docs/authentication.md) - NextAuth.js 集成

### 部署指南
- [Vercel部署](./docs/deployment.md#vercel部署) - 一键部署到 Vercel
- [Docker部署](./docs/deployment.md#docker部署) - Docker 容器化部署
- [服务器部署](./docs/deployment.md#服务器部署) - 传统服务器部署

## 🚦 开发状态

### 已完成 ✅
- [x] 项目初始化 (monorepo)
- [x] pnpm 工作空间配置
- [x] 管理后台基础框架 (Next.js 15)
- [x] 文档站点 (Docusaurus)
- [x] 共享组件库 (@yishan/shadcn)
- [x] TypeScript 类型声明生成
- [x] Tailwind CSS 4.x 集成
- [x] shadcn/ui 组件集成
- [x] 构建系统配置 (Rollup)

### 进行中 🚧
- [ ] 管理后台核心页面开发
- [ ] 用户认证系统
- [ ] 权限管理系统
- [ ] 数据表格组件
- [ ] 图表组件集成
- [ ] Storybook 文档

### 计划中 📋
- [ ] 文件管理系统
- [ ] 系统监控面板
- [ ] 主题系统 (深色/浅色)
- [ ] 国际化支持 (i18n)
- [ ] 实时通知系统
- [ ] 数据导入/导出
- [ ] 代码生成器

## 🔧 脚本命令

### 根项目
```bash
pnpm install          # 安装所有依赖
pnpm build            # 构建所有项目
pnpm dev              # 启动所有开发服务器
pnpm clean            # 清理所有构建产物
```

### 子项目
```bash
# 管理后台
pnpm --filter yishan-admin dev      # 开发模式
pnpm --filter yishan-admin build     # 构建
pnpm --filter yishan-admin start     # 生产模式

# 文档站点
pnpm --filter yishan-docs dev        # 开发模式
pnpm --filter yishan-docs build      # 构建
pnpm --filter yishan-docs serve      # 本地预览

# 组件库
pnpm --filter @yishan/shadcn build   # 构建组件库
pnpm --filter @yishan/shadcn dev     # 开发模式
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看我们的 [贡献指南](./docs/contributing.md) 了解如何参与项目。

### 贡献流程
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 🌐 相关链接

- [官方网站](https://zerocmf.com)
- [文档站点](https://docs.zerocmf.com)
- [GitHub仓库](https://github.com/zerocmf/yishan)
- [NPM包](https://www.npmjs.com/package/@yishan/shadcn)

---

<p align="center">
  <strong>移山通用管理系统</strong><br>
  为开发者而生，为效率而设计
</p>