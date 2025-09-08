---
sidebar_position: 3
---

# 项目结构

## 目录结构

```
yishan/
├── apps/                     # 应用目录
│   ├── yishan-admin/        # 管理后台
│   │   ├── app/            # Next.js App Router
│   │   ├── components/     # 业务组件
│   │   ├── lib/           # 工具函数
│   │   └── public/        # 静态资源
│   └── yishan-docs/       # 文档站点
│       ├── docs/          # 文档内容
│       ├── src/           # 自定义组件
│       └── static/        # 静态文件
├── packages/               # 共享包
│   └── shadcn/          # 组件库
│       ├── components/   # UI组件
│       ├── lib/         # 工具函数
│       └── types/       # 类型定义
└── pnpm-workspace.yaml   # 工作空间配置
```

## 核心目录说明

### apps/yishan-admin

管理后台应用，基于 Next.js 15 App Router。

```
yishan-admin/
├── app/                  # 路由目录
│   ├── (auth)/         # 认证相关页面
│   ├── (dashboard)/    # 仪表板页面
│   ├── admin/          # 管理功能
│   └── api/            # API路由
├── components/          # 业务组件
│   ├── admin/         # 后台管理组件
│   ├── common/        # 通用组件
│   └── ui/            # UI组件
├── lib/               # 工具函数
│   ├── api/           # API封装
│   ├── hooks/         # 自定义Hooks
│   └── utils/         # 工具函数
└── public/            # 静态资源
```

### packages/shadcn

共享组件库，基于 shadcn/ui。

```
shadcn/
├── components/        # UI组件
│   ├── ui/           # 基础UI组件
│   └── custom/       # 业务组件
├── lib/              # 工具函数
├── hooks/            # 自定义Hooks
└── types/            # 类型定义
```

## 命名规范

### 文件命名

- 组件文件：PascalCase (`UserCard.tsx`)
- 工具文件：camelCase (`useAuth.ts`)
- 样式文件：kebab-case (`user-card.module.css`)

### 目录命名

- 路由目录：kebab-case (`user-management`)
- 组件目录：kebab-case (`user-card`)
- 工具目录：camelCase (`apiClient`)

## 模块说明

### 路由模块

```typescript
// app/admin/users/page.tsx
export default function UsersPage() {
  // 页面组件
}

// app/admin/users/layout.tsx
export default function UsersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 布局组件
}
```

### 组件模块

```typescript
// components/admin/user-table.tsx
import { User } from '@/types/user'

interface UserTableProps {
  users: User[]
}

export function UserTable({ users }: UserTableProps) {
  // 组件实现
}
```

### 工具模块

```typescript
// lib/api/user.ts
import { User } from '@/types/user'

export async function getUsers(): Promise<User[]> {
  // API实现
}
```