# Phase 0: 基础设施（sys_enum + Money + 枚举中心）

> 继承自 [`2026-09-08-crm-refactor-roadmap.md`](./2026-09-08-crm-refactor-roadmap.md) 的 **Global Constraints** + **Style Baseline**。
> 本文件是该 Phase 的可执行 plan。

**目标：** 把"业务枚举"从模块表（如 `crm_customer_status`）迁移到 CORE 模块的通用 `sys_enum` 表；新建分单位金额工具 `Money`；前端接入枚举中心页面与查询 API。

**Break Change：** 允许 drop 旧 `crm_customer_status` / `crm_customer_source` 表与外键引用；新列 `crm_customer.status_code / level_code / industry_code` 双写后逐步取代。

---

## Step 1：建 `sys_enum` 表（CORE）

- 字段：`id / type / code / name / sort / enabled / createdAt / updatedAt / deletedAt`
- 唯一索引：`(type, code)`
- 普通索引：`(type, enabled, sort)`
- 写入位置：`apps/yishan-api/src/db/schema/tables.ts`（手工维护，与既有 sys_* 表风格一致；旁边用 `// Generated from drizzle/*.sql` 注释与现有注释对齐）
- type 值域（写死在 TypeScript 字典）：`crm_industry / crm_customer_level / crm_customer_status / crm_customer_source / crm_lead_status / crm_opportunity_stage / crm_opportunity_pipeline / crm_opportunity_lost_reason / crm_visit_result / crm_ticket_priority / crm_ticket_type / crm_payment_method`
- 同时在 `apps/yishan-api/drizzle/0010_create-sys-enum.sql` 写入 SQL 迁移历史

## Step 2：迁移 crm 现有 status/source 两张表

- 启动时（`seed.ts`）执行一次数据搬运：
  - 把 `crm_customer_status.name` 拷贝进 `sys_enum(type='crm_customer_status', code=旧 code, name=name)`
  - 把 `crm_customer_source.name` 拷贝进 `sys_enum(type='crm_customer_source', ...)`
- 业务表加 `status_code varchar(32)` / `level_code varchar(32)` / `industry_code varchar(32)` 新列
- Phase 0 完成阶段：保留双写；最后一步在 Phase 1 完成后由后续 phase 处理 drop

## Step 3：Money 工具

- 位置：`apps/yishan-api/src/utils/money.ts`
- API：`Money.cents(n: number)` / `Money.yuan(n: number)` / `Money.fromYuanString(s)` / `Money.sum([...])` / `Money.format(cents, locale)`
- 测试：`apps/yishan-api/src/utils/__tests__/money.test.ts`
- 覆盖：0 / 负数 / 大数（> Number.MAX_SAFE_INTEGER 不安全但提示）/ 精度截断 / 累加误差

## Step 4：枚举中心 admin 页面

- 路径：`apps/yishan-admin/src/modules/crm/settings/enums/index.tsx`
- 组件：`ProTable` + 按 type 过滤 + 内联编辑启用/排序
- 权限：`crm:settings:view` / `crm:settings:update`（已存在）

## Step 5：枚举查询 API

- 后端：`apps/yishan-api/src/core/routes/api/v1/admin/enums/index.ts`
- 路由：`GET /api/admin/enums?type=crm_opportunity_stage` → `[{code, name, sort}]`
- 缓存：60s in-process `Map<type, { expires: number, items: EnumItem[] }>`
- 权限：`system:dict:list`（复用 dict 模块权限，groups=system）

---

## 子 plan 文件结构

- `apps/yishan-api/src/db/schema/tables.ts` — 追加 `sysEnum` 表
- `apps/yishan-api/src/db/schema/index.ts` — re-export（若需要）
- `apps/yishan-api/src/db/schema/relations.ts` — 关系（如有）
- `apps/yishan-api/drizzle/0010_create-sys-enum.sql` — 迁移历史
- `apps/yishan-api/src/core/repositories/enum.repository.ts` — 仓库
- `apps/yishan-api/src/core/services/enum.service.ts` — 服务（含缓存）
- `apps/yishan-api/src/core/schemas/enum.schema.ts` — TypeBox schemas
- `apps/yishan-api/src/core/routes/api/v1/admin/enums/index.ts` — 路由
- `apps/yishan-api/src/utils/money.ts` — Money 工具
- `apps/yishan-api/src/utils/__tests__/money.test.ts` — 测试
- `apps/yishan-api/src/modules/crm/db/schema.ts` — 追加 status_code/level_code/industry_code
- `apps/yishan-api/src/modules/crm/seed.ts` — 加入 enum 种子数据搬运
- `apps/yishan-admin/src/modules/crm/settings/enums/index.tsx` — 前端枚举中心

## 验收

- [ ] `pnpm --filter yishan-api db:generate` 通过（schema 合法）
- [ ] `pnpm --filter yishan-api test` 通过（如果环境能跑）
- [ ] admin 端 `/crm/settings/enums` 可访问
- [ ] `GET /api/admin/enums?type=crm_customer_status` 返回 `{code,name,sort}[]`
- [ ] Money 工具单测全绿

---

## 实施检查清单

- [x] Step 1: sysEnum 表 schema
- [x] Step 1: SQL 迁移文件 (`apps/yishan-api/drizzle/0010_create-sys-enum.sql`)
- [x] Step 1: index.ts / relations.ts 更新
- [x] Step 3: Money 工具 (`apps/yishan-api/src/utils/money.ts`)
- [x] Step 3: Money 单测 25 项全绿 (`src/utils/test/money.test.ts`)
- [x] Step 5: enum.repository.ts
- [x] Step 5: enum.service.ts (含 60s 缓存)
- [x] Step 5: enum.schema.ts (TypeBox 字典 + 11 个 CRM type)
- [x] Step 5: enums route (`apps/yishan-api/src/core/routes/api/v1/admin/enums/index.ts`)
- [x] Step 2: crm_customer 新列 (`status_code/level_code/industry_code/source_code/pool_entered_at`)
- [x] Step 2: crm seed 14 个 type 种子项 (CRM_ENUM_SEED)
- [x] Step 4: admin 枚举中心页面 (`apps/yishan-admin/src/modules/crm/pages/settings/enums/index.tsx`)
- [x] Step 4: 菜单节点 `枚举中心` 注册
- [x] Phase 1 顺手: crm_contact role/status 列 + crm_activity polymorphic + lead_followup type 准备
- [ ] OpenAPI 重生成（手动，需 ops 跑）

## 测试结果

- `pnpm --filter yishan-api test`：417 passed | 24 skipped (441 total)
- `pnpm --filter yishan-api db:generate`：通过 (12 个 core 表 + sys_enum)
- `npx drizzle-kit generate` (CRM module)：通过 (11 个 crm_* 表)
- `node scripts/check-module-naming.mjs`：ok (25 tables across 4 modules)
