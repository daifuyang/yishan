---
title: 前端概览
---

# 前端概览（yishan-admin）

技术栈基于 Umi Max 与 Ant Design Pro，提供通用的系统管理模块与完善的请求/权限封装。

## 技术栈

- 框架：Umi Max（`@umijs/max`）
- UI：Ant Design v5、Pro Components
- 语言：TypeScript
- 测试：Jest

## 关键目录

- `config/routes.ts` 路由与菜单映射
- `src/pages/system/*` 用户、角色、菜单、部门、岗位页面
- `src/services/yishan-admin/*` 请求封装与 OpenAPI 接口
- `src/utils/token.ts`、`src/utils/auth.ts` 认证与本地状态
- `src/requestErrorConfig.ts` 请求/响应拦截与错误处理

## 权限模型

前端以“路径权限”为核心，后端在 `/api/v1/auth/me` 返回 `accessPath`，前端在 `src/access.ts` 进行匹配控制。