---
sidebar_position: 1
sidebar_label: 组件库首页
---

# 组件库

移山项目组件库文档。

移山组件库是基于 shadcn/ui 构建的现代化 React 组件库。

## 安装

```bash
# 安装组件库
pnpm add @yishan/shadcn

# 安装单个组件
npx shadcn-ui@latest add button
```

## 使用方式

```tsx
import { Button } from '@yishan/shadcn'

export default function App() {
  return (
    <Button variant="default" size="lg">
      开始使用
    </Button>
  )
}
```

## 组件列表

### 基础组件

| 组件 | 说明 | 状态 |
|---|---|---|
| [Button](/docs/components/button) | 按钮组件 | ✅ |
| [Input](/docs/components/input) | 输入框组件 | ✅ |
| [Card](/docs/components/card) | 卡片容器 | ✅ |

### 表单组件

| 组件 | 说明 | 状态 |
|---|---|---|
| Form | 表单容器 | 🚧 |
| Select | 选择器 | 🚧 |
| Checkbox | 复选框 | 🚧 |
| Switch | 开关 | 🚧 |

### 反馈组件

| 组件 | 说明 | 状态 |
|---|---|---|
| Toast | 轻提示 | 🚧 |
| Dialog | 对话框 | 🚧 |
| Alert | 警告提示 | 🚧 |

### 数据展示

| 组件 | 说明 | 状态 |
|---|---|---|
| Table | 表格 | 🚧 |
| Avatar | 头像 | 🚧 |
| Badge | 徽章 | 🚧 |

## 状态说明

- ✅ **已发布** - 稳定可用
- 🚧 **开发中** - 功能开发中
- 💡 **计划中** - 待开发组件

## 主题系统

支持深色模式和自定义主题：

```tsx
import { useTheme } from 'next-themes'

function ThemeAwareComponent() {
  const { theme } = useTheme()
  
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <Button>自适应按钮</Button>
    </div>
  )
}
```