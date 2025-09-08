---
sidebar_position: 3
---

# 项目结构

## 整体架构

基于 **pnpm workspace** 的 monorepo 架构，采用 **Next.js 15** + **TypeScript** + **Tailwind CSS** 技术栈。

```
yishan/
├── apps/
│   ├── yishan-admin/     # Next.js 15 管理后台
│   └── yishan-docs/      # Docusaurus 文档站点
├── packages/
│   └── shadcn/          # 共享组件库
├── pnpm-workspace.yaml  # 工作空间配置
└── package.json         # 根目录配置
```

## 应用结构

### yishan-admin (管理后台)

**Next.js 15** 应用，使用 App Router 架构。

```
yishan-admin/
├── app/                  # App Router 目录
│   ├── layout.tsx       # 根布局
│   ├── page.tsx         # 首页
│   └── globals.css      # 全局样式
├── components/          # 业务组件
├── lib/                # 工具函数
├── public/             # 静态资源
├── next.config.ts      # Next.js 配置
├── tailwind.config.js  # Tailwind 配置
└── tsconfig.json       # TypeScript 配置
```

### yishan-docs (文档站点)

**Docusaurus 3** 驱动的文档系统。

```
yishan-docs/
├── docs/               # 文档内容
│   ├── guide/         # 使用指南
│   └── components/    # 组件文档
├── src/               # 自定义组件
├── static/            # 静态文件
├── docusaurus.config.ts  # 站点配置
└── tailwind.config.js    # Tailwind 配置
```

## 共享组件库

### shadcn (组件库)

基于 **shadcn/ui** 的共享组件库，使用 **Vite** + **TypeScript** 构建。

```
shadcn/
├── components/        # 组件目录
│   ├── ui/           # shadcn/ui 基础组件
│   ├── block/        # 业务区块组件
│   └── pro/          # 高级业务组件
├── lib/              # 工具函数
│   └── utils.ts      # 通用工具
├── hooks/            # 自定义 Hooks
│   └── use-mobile.ts # 移动端检测
├── types/            # 类型定义
├── src/              # 开发预览
├── tsup.config.ts    # 构建配置
└── vite.config.ts    # Vite 配置
```

## 目录规范

### 命名约定

| 类型 | 规范 | 示例 |
|---|---|---|
| 组件文件 | PascalCase | `UserCard.tsx` |
| 工具文件 | camelCase | `useAuth.ts` |
| 目录命名 | kebab-case | `user-management` |
| 样式文件 | kebab-case | `user-card.module.css` |

### 文件组织

```typescript
// 组件结构示例
components/
├── ui/                    # 基础UI组件
├── block/                 # 业务区块
├── pro/                   # 高级组件
└── [feature]/            # 功能相关组件

// 工具函数结构
lib/
├── utils.ts              # 通用工具
├── api/                  # API封装
└── hooks/                # 自定义Hooks
```

## 模块系统

### 组件导入

```typescript
// 从共享库导入
import { Button } from '@yishan/shadcn'

// 本地组件导入
import { UserTable } from '@/components/admin/user-table'

// 工具函数导入
import { cn } from '@yishan/shadcn/lib/utils'
```

### 路径配置

**tsconfig.json** 路径映射：

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@yishan/shadcn": ["../../packages/shadcn"]
    }
  }
}
```

## 开发工作流

### 启动命令

```bash
# 开发模式
pnpm dev                 # 全部启动
pnpm dev:admin          # 仅管理后台
pnpm dev:docs           # 仅文档站点
pnpm dev:shadcn         # 仅组件库

# 构建命令
pnpm build              # 全部构建
pnpm build:admin        # 仅管理后台
pnpm build:docs        # 仅文档站点
```

### 代码规范

- **TypeScript** 严格模式
- **ESLint** 代码检查
- **Prettier** 代码格式化
- **Tailwind CSS** 样式系统