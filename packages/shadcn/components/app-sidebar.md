# AppSidebar 组件文档

AppSidebar 是一个可复用的侧边栏组件，基于 shadcn/ui 的 Sidebar 组件构建。

## 安装

该组件已包含在 `@zerocmf/yishan-shadcn` 包中，无需额外安装。

## 基本用法

### 1. 使用默认数据

```tsx
import { AppSidebar } from '@zerocmf/yishan-shadcn'

function MyApp() {
  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1">
        {/* 主内容区域 */}
      </main>
    </div>
  )
}
```

### 2. 使用自定义数据

```tsx
import { AppSidebar } from '@zerocmf/yishan-shadcn'
import { Home, Settings, User, FileText } from 'lucide-react'

function MyApp() {
  const sidebarData = {
    user: {
      name: "张三",
      email: "zhangsan@example.com",
      avatar: "/avatars/zhangsan.jpg",
    },
    teams: [
      {
        name: "我的团队",
        logo: Home,
        plan: "专业版",
      },
    ],
    navMain: [
      {
        title: "仪表板",
        url: "/dashboard",
        icon: Home,
        isActive: true,
        items: [
          { title: "概览", url: "/dashboard/overview" },
          { title: "分析", url: "/dashboard/analytics" },
        ],
      },
      {
        title: "文档",
        url: "/docs",
        icon: FileText,
        items: [
          { title: "指南", url: "/docs/guide" },
          { title: "API", url: "/docs/api" },
        ],
      },
      {
        title: "设置",
        url: "/settings",
        icon: Settings,
        items: [
          { title: "个人资料", url: "/settings/profile" },
          { title: "账户", url: "/settings/account" },
        ],
      },
    ],
    projects: [
      {
        name: "个人项目",
        url: "/projects/personal",
        icon: User,
      },
    ],
  }

  return (
    <div className="flex h-screen">
      <AppSidebar data={sidebarData} />
      <main className="flex-1">
        {/* 主内容区域 */}
      </main>
    </div>
  )
}
```

## 接口定义

### AppSidebarData

```typescript
interface AppSidebarData {
  user: {
    name: string
    email: string
    avatar: string
  }
  teams: Array<{
    name: string
    logo: LucideIcon
    plan: string
  }>
  navMain: Array<{
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    items?: Array<{
      title: string
      url: string
    }>
  }>
  projects: Array<{
    name: string
    url: string
    icon: LucideIcon
  }>
}
```

### AppSidebarProps

```typescript
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  data?: AppSidebarData
}
```

## 示例数据

如果你需要使用示例数据作为参考，可以从包中导入：

```tsx
import { AppSidebar, sampleData } from '@zerocmf/yishan-shadcn'

// sampleData 包含了完整的示例数据结构
```

## 注意事项

1. 确保在使用该组件的页面中引入必要的 CSS 样式
2. 图标需要使用 lucide-react 中的图标组件
3. 该组件会自动处理响应式布局
4. 支持折叠和展开功能

## 依赖

- lucide-react
- @radix-ui/react-* (通过 shadcn/ui)
- tailwindcss