---
sidebar_position: 2
---

# 快速上手

## 环境准备

### 系统要求

| 工具 | 版本要求 | 安装命令 |
|---|---|---|
| Node.js | ≥ 18.0.0 | [官网下载](https://nodejs.org/) |
| pnpm | ≥ 8.0.0 | `npm install -g pnpm` |
| Git | 最新版 | [官网下载](https://git-scm.com/) |

### 验证安装

```bash
node --version    # v18.0.0+
pnpm --version    # 8.0.0+
git --version     # 2.0.0+
```

## 项目初始化

### 1. 获取代码

```bash
git clone <your-repo-url>
cd yishan
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动项目

```bash
# 方式1：启动所有服务
pnpm dev

# 方式2：单独启动
pnpm dev:admin    # 管理后台
pnpm dev:docs     # 文档站点
pnpm dev:storybook # 组件预览
```

## 创建第一个页面

### 1. 使用CLI创建页面

```bash
# 创建管理后台页面
pnpm gen:page admin/users

# 创建组件
pnpm gen:component UserCard
```

### 2. 手动创建页面

```typescript
// apps/yishan-admin/app/admin/users/page.tsx
import { UserTable } from '@/components/admin/user-table'

export default function UsersPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">用户管理</h1>
      <UserTable />
    </div>
  )
}
```

## 开发调试

### 常用命令

```bash
# 开发命令
pnpm dev              # 启动开发环境
pnpm build           # 构建生产版本
pnpm start           # 启动生产环境
pnpm lint            # 代码检查
pnpm format          # 代码格式化

# 测试命令
pnpm test            # 运行测试
pnpm test:watch      # 监听测试
pnpm test:coverage   # 测试覆盖率
```

### 调试技巧

1. **React DevTools** - 安装浏览器扩展
2. **TypeScript** - VS Code 内置支持
3. **Tailwind CSS** - 智能提示和预览
4. **ESLint** - 实时错误提示

## 下一步

- [组件使用指南](/components/button)
- [项目结构说明](/guide/project-structure)
- [开发规范](/guide/best-practices)