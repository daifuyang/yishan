---
sidebar_position: 1
---

# 管理后台文档

移山管理后台是基于Next.js 15构建的企业级管理界面，提供现代化的用户体验和强大的功能。

## 🎯 功能特性

### 📊 仪表板
- 实时数据展示
- 图表可视化
- 快捷操作入口

### 👥 用户管理
- 用户列表和详情
- 权限控制
- 角色管理

### ⚙️ 系统配置
- 应用设置
- 主题切换
- 国际化支持

## 🏗️ 技术架构

### 前端技术栈
- **Next.js 15** - React全栈框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式系统
- **shadcn/ui** - UI组件库

### 核心依赖
```json
{
  "next": "^15.0.0",
  "react": "^18.2.0",
  "typescript": "^5.0.0",
  "tailwindcss": "^3.4.0",
  "@radix-ui/react-*": "latest"
}
```

## 🚀 快速开始

### 环境准备
```bash
# 确保Node.js版本 >= 18
node --version

# 安装pnpm（如果未安装）
npm install -g pnpm
```

### 启动开发服务器
```bash
# 从项目根目录
cd apps/yishan-admin

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3000 查看管理后台。

## 📁 项目结构

```
yishan-admin/
├── app/                    # Next.js 13+ App Router
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 首页
│   └── admin/             # 管理后台路由
├── components/            # React组件
│   ├── ui/               # shadcn/ui组件
│   └── custom/           # 自定义组件
├── lib/                  # 工具函数和配置
│   └── utils.ts          # 通用工具
├── public/               # 静态资源
└── package.json          # 项目配置
```

## 🎨 主题系统

### 深色模式支持
管理后台内置深色模式切换功能：

```typescript
// 在组件中使用
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  
  return (
    <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? "☀️" : "🌙"}
    </Button>
  )
}
```

### 颜色系统
基于Tailwind CSS的扩展颜色系统：
- 主色调：slate色系
- 强调色：blue、green、red等语义色
- 支持自定义品牌色

## 🔧 开发指南

### 添加新页面

1. **创建页面文件**
```typescript
// app/admin/users/page.tsx
export default function UsersPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">用户管理</h1>
      {/* 页面内容 */}
    </div>
  )
}
```

2. **添加到导航**
在侧边栏配置中添加新页面链接。

### 使用组件

#### 基础组件
```typescript
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function MyComponent() {
  return (
    <Card>
      <Button>点击我</Button>
    </Card>
  )
}
```

#### 表单处理
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(2, "名称至少2个字符"),
  email: z.string().email("请输入有效邮箱"),
})

export function UserForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  })
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* 表单字段 */}
      </form>
    </Form>
  )
}
```

## 📱 响应式设计

管理后台采用移动优先的响应式设计：

- **移动端** (< 768px): 折叠侧边栏，底部导航
- **平板端** (768px - 1024px): 缩小侧边栏，优化布局
- **桌面端** (> 1024px): 完整侧边栏，充分利用空间

## 🔐 权限管理

### 路由守卫
```typescript
// app/admin/layout.tsx
import { redirect } from "next/navigation"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()
  
  if (!session?.user) {
    redirect("/login")
  }
  
  return <>{children}</>
}
```

## 📊 数据展示

### 表格组件
集成现代化的数据表格：
- 排序和筛选
- 分页加载
- 批量操作
- 导出功能

### 图表集成
支持多种图表类型：
- 折线图：趋势分析
- 柱状图：对比数据
- 饼图：占比展示
- 仪表盘：关键指标

## 🧪 测试策略

### 单元测试
```typescript
import { render, screen } from "@testing-library/react"
import { Button } from "@/components/ui/button"

test("renders button with text", () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText("Click me")).toBeInTheDocument()
})
```

### 端到端测试
使用Playwright进行关键流程测试：
- 用户登录流程
- 数据CRUD操作
- 权限验证

## 🚀 部署指南

### 构建生产版本
```bash
pnpm build
```

### 部署到Vercel
```bash
vercel --prod
```

### Docker部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

---

下一步：[组件库文档](../components) →