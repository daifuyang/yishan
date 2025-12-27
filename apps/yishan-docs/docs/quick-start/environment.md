---
title: 环境准备
---

# 环境准备

为保证前后端顺利运行，请准备以下环境：

- Node.js ≥ 20（前端 `yishan-admin` 要求）
- 包管理器：`pnpm`
- MySQL 8.x（用于后端数据库）
- Redis（可选，用于缓存）

## 安装依赖（工作空间）

在项目根执行一次依赖安装：

```bash
pnpm install # 或 pnpm i
```

如需仅安装某个子项目依赖：

```bash
pnpm --filter yishan-api i
pnpm --filter yishan-admin i
pnpm --filter yishan-docs i
```

## 后端（yishan-api）环境
1. 初始化环境配置：
   ```bash
   cp .env.example .env
   # 按需修改 DATABASE_URL、JWT_SECRET、PORT 等
   ```
   核心配置参考 `.env.example`：包括数据库、JWT、Redis、端口与定时任务等。
2. 初始化数据库：
   ```bash
   pnpm --filter yishan-api db:init
   pnpm --filter yishan-api db:seed
   ```

## 前端（yishan-admin）环境

1. 开发代理默认指向后端 `http://localhost:3000`，配置位于 `config/proxy.ts`。

## 文档站点（yishan-docs）环境

1. 启动开发：
   ```bash
   pnpm --filter yishan-docs start -- --port 4000
   ```
