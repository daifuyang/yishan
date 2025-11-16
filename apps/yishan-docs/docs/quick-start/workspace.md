---
title: 工作空间与脚本
---

# 工作空间与脚本（pnpm）

本项目使用 pnpm 工作空间进行依赖与脚本统一管理。

## 统一安装

```bash
pnpm install # 或 pnpm i
```

## 过滤运行（子项目）

```bash
# 开发
pnpm --filter yishan-admin dev
pnpm --filter yishan-api dev
pnpm --filter yishan-docs start

# 构建
pnpm --filter yishan-admin build
pnpm --filter yishan-api start       # 启动时自动构建
pnpm --filter yishan-docs build

# 仅安装某个子项目依赖
pnpm --filter yishan-admin i
pnpm --filter yishan-api i
pnpm --filter yishan-docs i
```

## 批量运行

```bash
# 对所有工作空间运行某脚本（需各项目定义同名脚本）
pnpm -r build       # 递归执行 build
pnpm -r test        # 递归执行 test
```

建议始终在项目根目录运行安装与批量脚本，确保跨项目依赖一致。子项目特定操作使用 `--filter` 精准命中目标。