# Phase 4: 拜访 + 工单建模

> 继承自 [`2026-09-08-crm-refactor-roadmap.md`](./2026-09-08-crm-refactor-roadmap.md) 的 **Global Constraints** + **Style Baseline**。

**目标：** 拜访复用 `crm_activity(type='visit')`；工单建表但不挂业务接口；拜访独立列表页可用。

---

## Step 1：crm_activity 拜访字段

- 表已扩展 `planned_at / location / participants / visit_result_code / summary` 列（Phase 0 完成）
- `ActivityRepository.listVisits()` 支持按时间窗 + 客户过滤
- 已有 activity service 通过新 type='visit' + 新字段写入

## Step 2：crm_ticket 工单表

- 表已建：`crm_ticket(ticketNo unique, customerId, contactId?, contractId?, productId?, typeCode, priorityCode, status='open', ownerUserId?, slaDueAt?, description, solution, softDelete)`
- **不挂任何业务路由**：表保留供 Phase 5 P1 使用
- 任何对它的引用都会因为没有 route + service 而编译期报错（防止误用）

## Step 3：拜访独立列表页

- 路径：`apps/yishan-admin/src/modules/crm/pages/visits/index.tsx`
- 组件：`ProTable` + 按 plannedAt 排序 + 客户过滤
- 数据源：`ActivityRepository.listVisits()` → `GET /api/crm/v1/visits`

## Step 4：菜单节点

- `CRM / 销售管理 / 拜访` 菜单节点
- 权限：`crm:activity:list`（复用现有权限）

---

## 子 plan 文件

- `apps/yishan-api/src/modules/crm/drizzle/0050_crm-visit-fields.sql` — 已完成
- `apps/yishan-api/src/modules/crm/drizzle/0051_crm-ticket.sql` — 已完成
- `apps/yishan-api/src/modules/crm/db/schema.ts` — crm_ticket 表已加
- `apps/yishan-api/src/modules/crm/repositories/activity.repository.ts` — listVisits 已加
- `apps/yishan-api/src/modules/crm/routes/v1/visits/index.ts` — 新建
- `apps/yishan-api/src/modules/crm/schemas/activity.schema.ts` — VisitListQuerySchema 已加
- `apps/yishan-admin/src/modules/crm/pages/visits/index.tsx` — 新建
- `apps/yishan-api/src/modules/crm/config/system-menu.json` — 新菜单节点

## 验收

- [ ] 拜访独立列表页可访问
- [ ] 拜访从客户/商机详情创建可写
- [ ] crm_ticket 表存在但无 API

## 实施检查清单

- [x] crm_activity 拜访字段 schema
- [x] crm_activity.listVisits repository
- [x] crm_ticket 表 schema
- [x] 0050/0051 SQL 迁移
- [ ] visits route
- [ ] visits admin page
- [ ] system-menu.json 注册
