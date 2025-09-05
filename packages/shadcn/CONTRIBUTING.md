# 贡献指南

感谢您对 `@yishan/shadcn` 组件库的贡献！本指南将帮助您了解如何参与项目开发。

## 🚀 快速开始

### 环境要求

- Node.js 18+ 或 20+
- pnpm 10.9.0+
- Git

### 开发环境设置

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd yishan/packages/shadcn
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **启动开发模式**
   ```bash
   pnpm dev
   ```

## 📁 项目结构

```
packages/shadcn/
├── components/          # 组件源码
│   └── ui/             # UI 组件
├── lib/                # 工具函数
├── dist/               # 构建输出
├── types/              # 类型定义
├── index.ts            # 入口文件
├── index.css           # 样式文件
└── *.config.*          # 配置文件
```

## 🧩 添加新组件

### 1. 创建组件文件

在 `components/ui/` 目录下创建新组件文件：

```bash
touch components/ui/new-component.tsx
```

### 2. 组件模板

使用以下模板创建新组件：

```tsx
import * as React from "react"
import { cn } from "../../lib/utils"

export interface NewComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  // 添加您的 props 类型
}

const NewComponent = React.forwardRef<HTMLDivElement, NewComponentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("your-base-classes", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
NewComponent.displayName = "NewComponent"

export { NewComponent }
```

### 3. 更新入口文件

在 `index.ts` 中导出新组件：

```ts
export * from "./components/ui/new-component"
```

### 4. 添加样式

如果有特定的样式需求，在 `index.css` 中添加：

```css
@layer components {
  .your-component-class {
    @apply your-tailwind-classes;
  }
}
```

## 🎨 样式规范

### Tailwind CSS 使用

- 使用 Tailwind CSS 工具类进行样式设计
- 遵循 Tailwind 的设计系统
- 使用 `@apply` 指令提取重复的类组合

### 颜色系统

- 使用 CSS 变量定义颜色主题
- 支持明暗主题切换
- 遵循 shadcn/ui 的颜色规范

## 🧪 测试

### 手动测试

1. **构建项目**
   ```bash
   pnpm build
   ```

2. **在示例项目中测试**
   ```bash
   cd ../../apps/yishan-admin
   pnpm dev
   ```

### 测试清单

- [ ] 组件渲染正常
- [ ] 样式正确应用
- [ ] 响应式设计工作正常
- [ ] 无障碍属性正确
- [ ] TypeScript 类型正确

## 📋 代码规范

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 使用 Prettier 格式化代码

### 命名规范

- 组件使用 PascalCase
- 文件使用 kebab-case
- CSS 类使用 kebab-case

### 提交信息

使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

类型说明：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建或辅助工具

## 🔍 审查流程

### Pull Request 模板

```markdown
## 描述
简要描述您的更改

## 类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 代码重构

## 测试
- [ ] 手动测试通过
- [ ] 样式检查通过
- [ ] 类型检查通过

## 截图
如果有 UI 更改，请添加截图
```

### 审查清单

- [ ] 代码符合规范
- [ ] 功能测试通过
- [ ] 文档已更新
- [ ] 无破坏性变更

## 📝 发布流程

1. **更新版本**
   ```bash
   pnpm version patch|minor|major
   ```

2. **构建和测试**
   ```bash
   pnpm build
   ```

3. **发布**
   ```bash
   pnpm publish
   ```

## ❓ 常见问题

### 开发问题

**Q: 样式不生效？**
A: 确保 PostCSS 配置正确，重新构建项目

**Q: 类型错误？**
A: 检查 TypeScript 配置和类型定义

**Q: 构建失败？**
A: 检查依赖版本和配置文件

### 获取帮助

- 查看 [README.md](./README.md)
- 检查 [CHANGELOG.md](./CHANGELOG.md)
- 提交 Issue 或 Discussion

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 创建 Pull Request
- 发送邮件