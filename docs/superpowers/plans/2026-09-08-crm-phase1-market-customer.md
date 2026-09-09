# Phase 1: 市场 + 客户增量（polymorphic + 枚举外键 + 入池时间）

> 继承自 [`2026-09-08-crm-refactor-roadmap.md`](./2026-09-08-crm-refactor-roadmap.md) 的 **Global Constraints** + **Style Baseline**。

**目标：** crm_activity polymorphic 化、crm_lead_activity 数据并入、crm_customer 引入 sys_enum 外键列、公海入池时间、crm_contact 角色与状态。

---

## Step 1：crm_activity polymorphic

- 表已扩展 `entity_type / entity_id / entity_ref_type` 列（Phase 0 已完成 schema）
- `ActivityRepository.listByEntity(entityType, entityId)` 支持按 polymorphic 查询
- `ActivityRepository.listByCustomer(customerId)` 保持向后兼容，等同于 `listByEntity('customer', customerId)`
- 旧 `customerId` 列暂时保留（数据迁移期双写）

## Step 2：客户枚举外键化

- `crm_customer.status_code / source_code / level_code / industry_code` 列已加（Phase 0 完成）
- 服务层读路径优先新列；写路径新字段为主
- 验证：业务侧已有 `crm_customer_status` / `crm_customer_source` 旧表的，保留到最后一刻再 drop

## Step 3：客户公海入池时间

- 列 `pool_entered_at` 已加
- repository 暴露 `findPublic(poolEnteredBefore?, poolEnteredAfter?)`
- service 层 assign(null) / 退回公海时刷新 `pool_entered_at = now()`
- 列表视图新增"按入池时长"排序

## Step 4：联系人角色 + 状态

- 列已加（Phase 0 完成）
- ContactService.setPrimary 主联系人唯一性 service 层校验
- ContactService.update 校验：状态为 invalid 的联系人不能作为新商机主要联系人

## Step 5：活动 type 扩展

- 新增 `lead_followup` 类型用于吸收 crm_lead_activity
- LeadActivityService.create 内部双写到 `crm_activity(entity_type='lead', entity_id=leadId, type='lead_followup')`
- 旧 crm_lead_activity 表保留只读，最后一步 drop

## Step 6：菜单与权限

- 现有菜单与权限不动
- 联系人枚举值（crm_contact_role / crm_contact_status）由 admin 枚举中心维护

---

## 子 plan 文件

- `apps/yishan-api/src/modules/crm/repositories/activity.repository.ts` — 改 polymorphic 化
- `apps/yishan-api/src/modules/crm/repositories/lead-activity.repository.ts` — 双写
- `apps/yishan-api/src/modules/crm/repositories/customer.repository.ts` — 加 status_code 过滤
- `apps/yishan-api/src/modules/crm/repositories/contact.repository.ts` — 主联系人唯一性
- `apps/yishan-api/src/modules/crm/services/activity.service.ts` — polymorphic 写入
- `apps/yishan-api/src/modules/crm/services/lead-activity.service.ts` — 双写
- `apps/yishan-api/src/modules/crm/services/customer.service.ts` — pool_entered_at 刷新
- `apps/yishan-api/src/modules/crm/services/contact.service.ts` — 主联系人唯一性
- `apps/yishan-api/src/modules/crm/services/lead-conversion.service.ts` — 接受 polymorphic customerId
- `apps/yishan-api/src/modules/crm/routes/v1/activities/index.ts` — polymorphic 列表
- `apps/yishan-api/src/modules/crm/schemas/activity.schema.ts` — entityType 字面量

## 验收

- [ ] `pnpm --filter yishan-api test`：通过
- [ ] crm_lead_activity 数据双写到 crm_activity
- [ ] customer 公海按入池时间排序

## 实施检查清单

- [ ] ActivityRepository polymorphic 化
- [ ] CustomerRepository pool_entered_at 索引 + 排序
- [ ] ContactRepository primary 唯一性 service 校验
- [ ] ContactService update / setPrimary
- [ ] ActivityService create polymorphic 写入
- [ ] LeadActivityService 双写
- [ ] routes/v1/activities 支持 entityType 过滤
- [ ] schemas/activity.entityType 字面量
