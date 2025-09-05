---
sidebar_position: 1
---

# 组件库文档

移山组件库是基于shadcn/ui构建的现代化React组件库，提供一致、可访问、美观的用户界面组件。

## 🎯 设计原则

### 一致性
- 统一的视觉风格
- 一致的交互体验
- 标准化的API设计

### 可访问性
- 遵循WCAG 2.1标准
- 键盘导航支持
- 屏幕阅读器兼容

### 可定制性
- 支持主题定制
- 灵活的样式系统
- 可组合的组件

## 📦 安装使用

### 安装组件库
```bash
# 从项目根目录安装
pnpm add @yishan/shadcn

# 或者安装单个组件
npx shadcn-ui@latest add button
```

### 基础使用
```typescript
import { Button } from "@yishan/shadcn/components/ui/button"
import { Card } from "@yishan/shadcn/components/ui/card"

export function MyApp() {
  return (
    <Card>
      <Button variant="default" size="lg">
        开始使用
      </Button>
    </Card>
  )
}
```

## 🧩 组件分类

### 基础组件 (UI)
- [Button](./button-demo) - 按钮组件
- Card - 卡片容器
- Input - 输入框
- Label - 标签
- Textarea - 文本域

### 表单组件
- Form - 表单容器
- Select - 选择器
- Checkbox - 复选框
- Radio - 单选框
- Switch - 开关

### 反馈组件
- Toast - 轻提示
- Alert - 警告提示
- Dialog - 对话框
- Sheet - 抽屉

### 数据展示
- Table - 表格
- List - 列表
- Avatar - 头像
- Badge - 徽章

### 导航组件
- Navigation - 导航菜单
- Breadcrumb - 面包屑
- Tabs - 选项卡
- Pagination - 分页

## 🎨 主题系统

### 颜色系统
基于Tailwind CSS的语义化颜色系统：

```typescript
// 主色调
primary: {
  50: '#eff6ff',
  500: '#3b82f6',
  900: '#1e3a8a',
}

// 语义色
success: '#22c55e'
warning: '#f59e0b'
error: '#ef4444'
info: '#3b82f6'
```

### 深色模式
自动支持深色模式切换：

```typescript
// 在组件中使用
import { useTheme } from "next-themes"

export function ThemeAwareComponent() {
  const { theme } = useTheme()
  
  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <Button>自适应按钮</Button>
    </div>
  )
}
```

### 自定义主题
支持通过CSS变量自定义主题：

```css
:root {
  --primary: 221 83% 53%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --accent: 210 40% 96%;
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

.dark {
  --primary: 217 91% 60%;
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

## 🔧 开发指南

### 创建新组件

1. **使用CLI工具**
```bash
npx shadcn-ui@latest add my-component
```

2. **手动创建**
```typescript
// components/ui/my-component.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline"
}

const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border",
          variant === "default" && "bg-card text-card-foreground",
          variant === "outline" && "border-input bg-background",
          className
        )}
        {...props}
      />
    )
  }
)
MyComponent.displayName = "MyComponent"

export { MyComponent }
```

### 组件文档
每个组件都包含：
- 基础使用示例
- 属性说明
- 变体展示
- 交互演示
- 最佳实践

## 📱 响应式设计

所有组件都支持响应式设计：

```typescript
// 响应式按钮
<Button 
  className="w-full sm:w-auto md:w-48 lg:w-64"
  size={{ base: "sm", md: "lg" }}
>
  响应式按钮
</Button>
```

## ♿ 可访问性

### 键盘导航
- Tab键导航
- 回车键激活
- Esc键关闭

### 屏幕阅读器
- 适当的ARIA标签
- 语义化HTML
- 焦点管理

### 颜色对比
- WCAG 2.1 AA标准
- 支持高对比度模式
- 色盲友好配色

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

### 可访问性测试
```typescript
import { axe } from "jest-axe"
import { Button } from "@/components/ui/button"

test("should have no accessibility violations", async () => {
  const { container } = render(<Button>Accessible button</Button>)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### 视觉回归测试
使用Storybook进行组件可视化测试：

```bash
# 启动Storybook
pnpm storybook

# 运行视觉测试
pnpm test:visual
```

## 📊 组件状态

### 组件成熟度
- ✅ **稳定** - 生产环境验证
- 🔄 **测试版** - 功能完整，待验证
- 🚧 **开发中** - 功能开发中
- 💡 **计划中** - 待开发组件

### 版本管理
遵循语义化版本控制：
- 主版本：破坏性变更
- 次版本：新功能
- 修订版：Bug修复

## 🚀 最佳实践

### 性能优化
- 组件懒加载
- 样式优化
- 图片优化
- 缓存策略

### 代码规范
- TypeScript严格模式
- ESLint规则
- Prettier格式化
- 提交规范

### 文档规范
- 清晰的API文档
- 丰富的示例
- 交互式演示
- 最佳实践指南

---

开始探索：[Button组件](./button-demo) →