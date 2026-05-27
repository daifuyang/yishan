---
title: 目录结构
---

# 目录结构

核心结构如下：

```text
apps/yishan-api
├─ src/
│  ├─ core/
│  │  ├─ plugins/            # 数据库、JWT、Redis、Swagger、错误处理等
│  │  ├─ routes/             # 核心路由：auth、admin、system
│  │  ├─ schemas/            # TypeBox 定义与响应模型
│  │  ├─ services/           # 核心业务服务层
│  │  └─ models/             # Prisma 相关模型封装
│  ├─ plugins-runtime/       # 插件发现、生命周期、持久化
│  ├─ plugins/modules/       # 插件模块路由与 manifest
│  ├─ utils/response.ts      # 统一响应工具
│  └─ app.ts                 # 应用入口
└─ prisma/schema/*.prisma    # 多文件数据模型
```
