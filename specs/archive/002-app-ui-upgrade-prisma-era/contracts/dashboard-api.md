# API Contracts: yishan-app 品牌基线与驾驶舱 MVP

**Feature**: 002-app-ui-upgrade
**Date**: 2026-06-03

本 feature 涉及的 API 契约。本期**仅新增 1 个接口**（聚合接口），其他接口均复用现有 API。

## 新增接口

### `GET /api/v1/app/dashboard/stats`

**功能**：首页驾驶舱聚合数据（4 个关键数字）

**权限**：仅管理员（`admin` 或 `super_admin` 角色）

**请求**：
```http
GET /api/v1/app/dashboard/stats
Authorization: Bearer <access_token>
```

**响应（200）**：
```json
{
  "success": true,
  "code": 0,
  "message": "ok",
  "data": {
    "userTotal": 128,
    "deptTotal": 12,
    "todayLogin": 47,
    "online": 8
  },
  "timestamp": "2026-06-03T10:30:00.000Z"
}
```

**响应（403，非管理员）**：
```json
{
  "success": false,
  "code": 40301,
  "message": "需要管理员权限",
  "timestamp": "2026-06-03T10:30:00.000Z"
}
```

**响应（401，未登录）**：
```json
{
  "success": false,
  "code": 40101,
  "message": "未登录或 token 已过期",
  "timestamp": "2026-06-03T10:30:00.000Z"
}
```

**TypeBox Schema**：
```ts
export const DashboardStatsResp = Type.Object({
  success: Type.Boolean(),
  code: Type.Integer(),
  message: Type.String(),
  data: Type.Object({
    userTotal: Type.Integer({ minimum: 0 }),
    deptTotal: Type.Integer({ minimum: 0 }),
    todayLogin: Type.Integer({ minimum: 0 }),
    online: Type.Integer({ minimum: 0 }),
  }),
  timestamp: Type.String({ format: 'date-time' }),
});
```

## OpenAPI 注册

接口注册到 `apps/yishan-api/src/core/routes/api/v1/app/dashboard/index.ts`，tag 为 `app-dashboard`：

```ts
const dashboard: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stats', {
    preHandler: [fastify.authenticate, requireAdmin],
    schema: {
      summary: '首页驾驶舱聚合数据',
      description: '返回 4 个关键数字（用户/部门/今日登录/在线），仅管理员可访问',
      operationId: 'appDashboardStats',
      tags: ['app-dashboard'],
      security: [{ bearerAuth: [] }],
      response: { 200: DashboardStatsResp },
    },
  }, handler);
};
```

## 复用接口（不修改）

以下接口**已存在**且本期**仅消费**，不修改契约：

| 接口 | 用途 | 现有位置 |
|------|------|----------|
| `GET /api/v1/app/menus/tree` | 应用 Tab 渲染菜单树 | `apps/yishan-api/src/core/routes/api/v1/app/menus/index.ts` |
| `GET /api/v1/app/users/me/login-logs` | 首页"最近登录" | `apps/yishan-api/src/core/routes/api/v1/app/users/index.ts` |
| `GET /api/v1/app/auth/me` | 我的页面获取当前用户 | `apps/yishan-api/src/core/routes/api/v1/app/auth/index.ts` |
| `POST /api/v1/app/auth/logout` | 退出登录 | `apps/yishan-api/src/core/routes/api/v1/app/auth/index.ts` |
| `PUT /api/v1/app/users/me` | 修改个人资料 | `apps/yishan-api/src/core/routes/api/v1/app/users/index.ts` |
| `PUT /api/v1/app/users/me/password` | 修改密码 | `apps/yishan-api/src/core/routes/api/v1/app/users/index.ts` |

## 客户端 API 封装

`apps/yishan-app/src/api/dashboard.ts`（新增）：

```ts
import type { DashboardStats } from './types';
import { request } from './client';

export const dashboardApi = {
  getStats: () =>
    request.get<DashboardStats>('/api/v1/app/dashboard/stats'),
};
```

`apps/yishan-app/src/api/types.ts`（新增类型）：

```ts
export interface DashboardStats {
  userTotal: number;
  deptTotal: number;
  todayLogin: number;
  online: number;
}
```

`apps/yishan-app/src/api/index.ts`（导出）：

```ts
export { dashboardApi } from './dashboard';
```

## 错误码约定

| 场景 | HTTP | 业务码 | 客户端处理 |
|------|------|--------|------------|
| 未登录 | 401 | 40101 | 跳转到登录页 |
| 非管理员 | 403 | 40301 | 隐藏统计卡，降级为普通用户视图 |
| 服务异常 | 500 | 50001 | 显示「数据加载失败，点击重试」 |
| 网络超时 | - | - | 客户端超时 3s，触发 retry |

## 性能契约

| 指标 | 目标 |
|------|------|
| P50 响应时间 | ≤ 100ms（命中缓存） |
| P95 响应时间 | ≤ 500ms（未命中缓存） |
| 并发能力 | ≥ 100 QPS（Redis 缓存命中时） |
| 缓存命中后端负载 | ≈ 0 DB 查询 |
