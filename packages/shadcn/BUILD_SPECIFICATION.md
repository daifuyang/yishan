# @zerocmf/yishan-shadcn 组件构建规范

## 项目概述

这是一个基于 shadcn/ui 的共享组件库，提供标准化的 React 组件，支持 TypeScript、ESM/CJS 双格式输出，并包含完整的类型声明。

## 技术栈

- **构建工具**: tsup (基于 esbuild)
- **包管理**: pnpm
- **样式**: Tailwind CSS v4
- **类型**: TypeScript
- **组件库**: shadcn/ui
- **图标**: lucide-react

## 项目结构

```
packages/shadcn/
├── components/          # 组件源代码
│   ├── ui/             # shadcn/ui 基础组件
│   ├── pro/            # 业务组件
│   │   ├── proPagination/
│   │   └── proTable/
├── lib/                # 工具函数
├── hooks/              # 自定义 hooks
├── dist/               # 构建输出目录
├── index.ts            # 主入口文件
├── index.css           # 样式文件
└── tsconfig.build.json # TypeScript 构建配置
```

## 组件规范

### 文件组织规范

#### 基础组件 (ui/)
- 每个组件一个文件夹
- 文件名: `组件名.tsx`
- 导出方式: `export * from "./组件名"`

#### 业务组件 (pro/)
- 每个组件一个文件夹
- 必须包含:
  - `index.tsx` - 组件主文件
  - `README.md` - 组件文档
- 导出方式: `export { ComponentName } from "./组件名"`

### 命名规范

- **组件名**: PascalCase (如: `ProPagination`, `DataTable`)
- **文件名**: camelCase (如: `proPagination.tsx`, `dataTable.tsx`)
- **文件夹名**: camelCase (如: `proPagination/`, `dataTable/`)
- **props接口**: `组件名Props` (如: `ProPaginationProps`)

### 导出规范

#### 主入口文件 (index.ts)
```typescript
// 基础组件
export * from "./components/ui/button";
export * from "./components/ui/input";

// 业务组件
export { ProPagination } from "./components/pro/proPagination";
export { default as ProTable } from "./components/pro/proTable";
```

## 构建配置

### 构建命令

```bash
# 生产构建
pnpm build

# 开发模式构建（监听变化）
pnpm dev

# 构建样式
pnpm build:css
```

### 构建流程

1. **清理**: 清空 dist 目录
2. **TypeScript 编译**: 使用 tsup 编译 TypeScript
3. **格式输出**: 同时生成 ESM 和 CJS 格式
4. **类型声明**: 生成 .d.ts 类型声明文件
5. **样式构建**: 使用 PostCSS 处理 CSS 文件

### 构建配置详解

#### tsup.config.ts
```typescript
export default defineConfig({
  entry: ["index.ts"],           // 入口文件
  format: ["cjs", "esm"],        // 输出格式
  dts: true,                     // 生成类型声明
  splitting: false,              // 禁用代码分割
  sourcemap: true,               // 生成 sourcemap
  clean: true,                   // 清理输出目录
  tsconfig: "tsconfig.build.json", // TypeScript 配置
  external: [                    // 外部依赖
    "react",
    "react-dom",
    "clsx",
    "class-variance-authority",
    "tailwind-merge",
    "lucide-react",
  ],
});
```

#### tsconfig.build.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["index.ts", "components/**/*", "lib/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 样式规范

### Tailwind CSS 配置
- 使用 Tailwind CSS v4
- 启用 CSS 变量
- 基础颜色: neutral
- 样式前缀: 无

### 样式文件
- 主样式文件: `index.css`
- 构建输出: `dist/index.css`
- 包含所有组件样式

## 组件开发规范

### 组件模板

```typescript
"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface 组件名Props {
  // Props 定义
  className?: string;
  // ... 其他 props
}

const 组件名 = forwardRef<HTMLDivElement, 组件名Props>(
  ({ className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("基础类名", className)} {...props}>
        {/* 组件内容 */}
      </div>
    );
  }
);

组件名.displayName = "组件名";

export { 组件名 };
```

### Props 规范

- 所有 props 必须有类型定义
- 使用接口定义 props
- 可选 props 使用 `?` 标记
- 提供合理的默认值

### 样式规范

- 使用 Tailwind CSS 类名
- 使用 `cn()` 工具函数合并类名
- 避免内联样式
- 支持 `className` prop 进行样式扩展

## 发布规范

### 包信息
- 包名: `@zerocmf/yishan-shadcn`
- 版本: 遵循语义化版本 (semver)
- 入口点: `./dist/index.js`
- 类型声明: `./dist/index.d.ts`

### 文件包含
```json
{
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./index.css": "./dist/index.css"
  }
}
```

## 最佳实践

### 开发流程

1. **创建新组件**
   ```bash
   # 在相应目录创建组件文件夹
   mkdir components/pro/新组件名
   touch components/pro/新组件名/index.tsx
   touch components/pro/新组件名/README.md
   ```

2. **更新主入口**
   ```typescript
   // 在 index.ts 中添加导出
   export { 新组件名 } from "./components/pro/新组件名";
   ```

3. **测试构建**
   ```bash
   pnpm build
   ```

4. **验证类型**
   ```bash
   pnpm tsc --noEmit
   ```

### 注意事项

- **避免重复导出**: 确保每个组件只有一个入口文件
- **保持向后兼容**: 修改 API 时考虑版本兼容性
- **文档完整**: 每个业务组件必须有 README.md
- **类型完整**: 所有公共 API 必须有类型声明

## 常见问题

### 构建错误处理

1. **声明文件冲突**
   - 原因: 多个文件尝试生成相同的 .d.ts 文件
   - 解决: 确保每个组件只有一个入口文件

2. **类型检查失败**
   - 使用 `pnpm tsc --noEmit` 检查类型错误
   - 确保所有依赖都已正确安装

3. **样式丢失**
   - 检查是否正确导入了组件样式
   - 确保 Tailwind CSS 配置正确