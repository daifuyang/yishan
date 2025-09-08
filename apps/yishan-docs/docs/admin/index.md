---
sidebar_position: 1
sidebar_label: 管理后台首页
---

# 管理后台开发指南

基于 Next.js 15 App Router 的企业级管理后台开发指南。

## 快速开始

### 环境要求
- Node.js ≥ 18
- pnpm (推荐)

### 启动项目
```bash
cd apps/yishan-admin
pnpm install
pnpm dev
```

访问 http://localhost:3000

## 项目结构

```
yishan-admin/
├── app/                  # Next.js App Router
│   ├── (auth)/          # 认证页面
│   ├── (dashboard)/     # 仪表板
│   └── admin/           # 管理功能
├── components/          # 业务组件
├── lib/                # 工具函数
└── public/             # 静态资源
```

## 开发示例

### 创建管理页面

```typescript
// app/admin/users/page.tsx
import { UserTable } from '@/components/admin/user-table'

export default function UsersPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <Button>添加用户</Button>
      </div>
      <UserTable />
    </div>
  )
}
```

### 数据获取

```typescript
// lib/api/user.ts
import { useQuery } from '@tanstack/react-query'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(res => res.json())
  })
}
```

### 权限控制

```typescript
// lib/auth/guard.ts
export async function requireAuth() {
  const session = await getServerSession()
  if (!session) redirect('/login')
  return session
}
```

## 常用组件

### 统计卡片

```typescript
<StatCard
  title="总用户数"
  value="1,234"
  icon={<UsersIcon />}
  description="+12% 上月"
/>
```

### 数据表格

```typescript
<DataTable
  columns={userColumns}
  data={users}
  loading={isLoading}
/>
```

## 部署

```bash
# 构建
pnpm build

# 部署到Vercel
vercel --prod
```

---

下一步：[组件库文档](../components) →