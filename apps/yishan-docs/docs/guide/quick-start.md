---
sidebar_position: 2
---

# 快速上手

## 前置要求

确保已安装：
- **Node.js** ≥ 18.0.0 ([下载](https://nodejs.org/))
- **pnpm** ≥ 8.0.0 (`npm install -g pnpm`)
- **Git** ([下载](https://git-scm.com/))

验证环境：
```bash
node -v  # v18+
pnpm -v  # 8+
git --version
```

## 开始开发

### 1. 克隆项目
```bash
git clone git@github.com:daifuyang/yishan.git
cd yishan
```

### 2. 安装依赖
```bash
pnpm install
```

### 3. 启动服务
```bash
# 全部启动
pnpm dev

# 单独启动
pnpm dev:admin   # 管理后台 (http://localhost:3000)
pnpm dev:docs    # 文档站点 (http://localhost:3001)
pnpm dev:shadcn  # 组件库开发
```

## 项目结构

```
yishan/
├── apps/
│   ├── yishan-admin/     # Next.js 15 管理后台
│   └── yishan-docs/      # Docusaurus 文档站点
├── packages/
│   └── shadcn/          # 共享组件库
└── pnpm-workspace.yaml  # Monorepo 配置
```

## 开发工作流

### 创建页面
```typescript
// apps/yishan-admin/app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>
    </div>
  )
}
```

### 使用组件
```typescript
import { Button } from '@zerocmf/yishan-shadcn'

<Button variant="default" size="sm">
  主要操作
</Button>
```

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 开发模式 |
| `pnpm build` | 构建所有项目 |
| `pnpm lint` | 代码检查 |
| `pnpm clean` | 清理缓存 |
| `pnpm type-check` | TypeScript 检查 |

## 开发工具

- **VS Code** - 推荐编辑器
- **React DevTools** - 浏览器扩展
- **Tailwind CSS IntelliSense** - 样式提示
- **ESLint** - 实时检查

## 下一步

- [项目结构详解](/docs/guide/project-structure)
- [组件文档](/docs/components/button)
- [最佳实践](/docs/guide/best-practices)