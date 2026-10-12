---
title: 技术栈与命令
---

# 技术栈与命令

## 依赖概览

- `@umijs/max`（Umi Max v4）
- `antd` v6、`@ant-design/pro-components`
- `react` 19、`typescript`（版本以产品 package.json 为准）
- 代码质量：`@biomejs/biome`

详见 `apps/demo/admin/package.json`。

## 常用命令

- 开发：`pnpm --filter @yishan/demo-admin dev`
- 构建：`pnpm build:admin`（根命令先构建共享 TipTap）
- 预览：`pnpm --filter @yishan/demo-admin preview`
- 单测：`pnpm --filter @yishan/demo-admin test`
- Lint：`pnpm --filter @yishan/demo-admin lint`
