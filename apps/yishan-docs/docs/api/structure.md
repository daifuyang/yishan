---
title: 目录结构
---

# 目录结构

核心结构如下：

```text
apps/yishan-api
├─ src/
│  ├─ plugins/
│  │  ├─ external/           # 数据库、JWT、Redis、Swagger 等
│  │  └─ app/                # 应用级插件（密码策略等）
│  ├─ routes/
│  │  ├─ api/v1/auth         # 登录/登出/刷新/当前用户
│  │  └─ api/v1/admin/*      # 系统管理模块路由
│  ├─ schemas/               # TypeBox 定义与响应模型
│  ├─ services/              # 业务服务层
│  ├─ models/                # Prisma 相关模型封装
│  ├─ utils/response.ts      # 统一响应工具
│  └─ app.ts                 # 应用入口
└─ prisma/schema.prisma      # 数据模型
```