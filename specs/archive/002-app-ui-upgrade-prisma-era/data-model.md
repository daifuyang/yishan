# Data Model: yishan-app 品牌基线与驾驶舱 MVP

**Feature**: 002-app-ui-upgrade
**Date**: 2026-06-03

本 feature 涉及的**新增/修改数据模型**。现有 Prisma schema 已有 `sys_user`、`sys_dept`、`sys_login_log` 等表，本 feature 不修改表结构。

## 新增实体（仅 1 个，聚合响应）

### DashboardStats

首页驾驶舱聚合接口的响应数据结构，**不持久化**，仅作为 API 响应。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userTotal` | number (integer, int64) | ✓ | 用户总数（含所有未删除、未锁定） |
| `deptTotal` | number (integer, int64) | ✓ | 部门总数（含所有未删除） |
| `todayLogin` | number (integer, int64) | ✓ | 今日登录次数（按 `createdAt` 范围 00:00:00 ~ 23:59:59） |
| `online` | number (integer, int64) | ✓ | 当前在线人数（最近 5 分钟内有活跃会话） |

**TypeBox Schema**：
```ts
export const DashboardStatsSchema = Type.Object({
  userTotal: Type.Integer({ minimum: 0 }),
  deptTotal: Type.Integer({ minimum: 0 }),
  todayLogin: Type.Integer({ minimum: 0 }),
  online: Type.Integer({ minimum: 0 }),
});

export type DashboardStats = Static<typeof DashboardStatsSchema>;
```

**API 包装**：
```ts
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

## 数据来源映射

聚合接口的 4 个数字**全部来自现有 Prisma 表**，**不新增任何表**。

| 字段 | 数据源 SQL/Prisma 片段 |
|------|------------------------|
| `userTotal` | `prisma.sysUser.count({ where: { deletedAt: null } })` |
| `deptTotal` | `prisma.sysDept.count({ where: { deletedAt: null } })` |
| `todayLogin` | `prisma.sysLoginLog.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } })` |
| `online` | `prisma.sysLoginLog.findMany({ where: { createdAt: { gte: now - 5min } }, distinct: ['userId'] }).then(r => r.length)` |

**性能优化**：
- 4 个查询并行（`Promise.all`）
- 加 Redis 缓存 30s（key: `dashboard:stats`）
- 缓存未命中时直接打 DB，命中时直接返回

## 权限模型

聚合接口 `/api/v1/app/dashboard/stats` **仅管理员可访问**。

**权限码**：复用现有角色码 `admin` 或 `super_admin`（`sys_role.code`）。

**判断逻辑**：
```ts
const isAdmin = user.roles?.some(r => 
  r.code === 'admin' || r.code === 'super_admin'
);
if (!isAdmin) {
  throw new BusinessError(403, '需要管理员权限');
}
```

**非管理员响应**：返回 403，前端跳转到普通用户首页（隐藏 4 张统计卡）。

## 状态转换

无。聚合接口是只读快照，**没有状态机**。

## 实体关系图

```
[User] ── 1:N ──> [LoginLog]
   │
   └── N:M ──> [Role] (admin / super_admin / user)
                    │
                    └── 1:N ──> [Menu]
                    
[Dept] (独立，无关联)

[DashboardStats] (聚合视图，无表)
   ├── 来源: sysUser.count
   ├── 来源: sysDept.count  
   ├── 来源: sysLoginLog.count (今日)
   └── 来源: sysLoginLog.distinct(userId) (近 5min)
```

## 缓存策略

| 缓存层 | Key | TTL | 失效策略 |
|--------|-----|-----|----------|
| Redis | `dashboard:stats` | 30s | TTL 过期 |
| 客户端内存 | API response | 30s | 时间戳比较 |

**为什么不缓存到数据库**：
- 聚合查询代价低（4 个 count + 1 个 distinct）
- 30s 缓存足够覆盖用户连续刷新的场景
- 不引入数据不一致风险

## 数据验证规则

| 字段 | 验证 |
|------|------|
| `userTotal` | ≥ 0 整数 |
| `deptTotal` | ≥ 0 整数 |
| `todayLogin` | ≥ 0 整数 |
| `online` | ≥ 0 整数，且 ≤ userTotal |

后端异常情况：DB 查询失败时，**整个接口返回 500**，不返回部分数据（避免"3 张卡显示 1 张 loading"的体验）。
