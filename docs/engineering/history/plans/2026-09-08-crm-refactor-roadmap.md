# CRM 模块重构路线图（按产品文档全面对齐）

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。
> 本 plan 是**总路线图**，按 Phase 拆分；每个 Phase 是一个独立可执行的子 plan，由该 phase 的实施者开新文件继承总规约。

**Goal:** 以 `docs/products/crm` 13 份文档为唯一真相来源，对照已定型的 `crm_lead / crm_lead_activity / crm_pool` 代码风格，重构 CRM 模块全部业务能力，**允许 break change**（一切以文档为准，不为旧实现做兼容垫层）。

**Architecture:** 严格继承 `crm_lead` 已定型的代码风格；跨对象活动采用 `entityType + entityId` 联合 polymorphic 索引；金额以分单位整数存储；枚举统一进新建的 `sys_enum` 通用表；模块结构按既有 `module/<id>/{db,repositories,services,schemas,routes,tests,config}` 演进。

**Tech Stack:** Fastify 5 + Drizzle + TypeBox + JWT（既有）；前端 Umi Max + Ant Design Pro 6 + dayjs（既有）。

**Source of Truth:**
- `docs/products/crm/README.md`
- `docs/products/crm/市场管理/{线索,线索池}.md`
- `docs/products/crm/客户管理/{客户,客户公海,联系人}.md`
- `docs/products/crm/销售管理/{商机,产品,报价单,合同,回款,拜访,工单}.md`

**Style Baseline（继承自 `apps/yishan-api/src/modules/crm/services/lead.service.ts` + `schemas/lead.schema.ts`）：**
1. Repository 薄：纯数据访问，零业务规则
2. Service 厚：业务规则 + 事务 + 审计
3. Update 接口白名单字段，owner/status/pool/converted 走专门业务接口
4. createdBy / ownerUserId 始终由 `currentUser` 推导，拒绝前端伪造
5. 状态机用常量 + 显式 if，不引入库
6. 关键变更写 `crm_activity` 审计事件（type 决定 UI 过滤）
7. `computeDataScope(currentUser)` 计算数据范围；无权限返回「不存在」
8. `CrmErrorCode` 集中管理
9. `CrmPermissions` 冻结对象 + `registerPermissions`
10. `Type.Union([Type.Literal...])` 替代 `Type.String({ enum })`；时间用 `format: 'date-time'`
11. 跨表 join 不直引：service 层多次查询 + JS 合并

---

## Phase 概览

| Phase | 范围 | 工作量 | Break Change | 预计文件 |
| --- | --- | --- | --- | --- |
| **0：基础设施** | 新建 `sys_enum` 通用枚举表 + admin 端枚举中心；金额工具 `Money`（分单位）；枚举 ↔ 前端同步机制 | 中 | 新增，不破坏旧 | ~10 个新文件 |
| **1：市场 + 客户增量** | crm_activity polymorphic 化；crm_lead_activity 并入；客户/联系人枚举外键化；客户公海入池时间；联系人决策角色 | 中 | **break**：需迁移 SQL；前端需替换 status 字段 | ~15 文件 |
| **2：销售前段** | 商机 + 产品目录 + 报价单（含版本、行金额、状态机） | 大 | 新增模块 | ~30 文件 |
| **3：销售后段** | 合同 + 回款计划/实际/核销 + 计算口径 | 大 | 新增 | ~25 文件 |
| **4：拜访 + 工单建模** | 拜访复用 crm_activity(type='visit')；工单表建但不挂业务接口 | 小 | 新增 | ~10 文件 |

> **执行建议**：Phase 0 必须最先完成；Phase 1 与 Phase 2 可并行（不同模块不同文件）；Phase 3 必须等 Phase 2（合同依赖报价）；Phase 4 可与 Phase 3 并行。

---

## Global Constraints（全部 Phase 通用）

- 所有 Drizzle 迁移**只增不删**，旧列先 `addColumn` 再写双写脚本，最后 `dropColumn`；本任务允许 break change，所以最后一步允许 `dropColumn`
- 金额一律 `DECIMAL(18,2)` + `BIGINT cents`（×100 存储）；前端 JSON 用 number（整数分）传输
- 名字常量集中到 `schemas/<entity>.schema.ts` 顶部，label 集中到 `services/<entity>.service.ts` 顶部 `*_LABELS`
- 错误码命名 `<MODULE>_<ENTITY>_<RULE>`，新增条目进 `schemas/error-codes.ts`
- 权限码命名 `crm:<entity>:<action>`，新增进 `schemas/permissions.ts`
- 测试用 Vitest，每 Service 一组覆盖 happy path + 关键边界（pool 隔离、状态机迁移、并发领取）
- OpenAPI 一旦变更必须跑 `pnpm --filter yishan-admin openapi` 重生成并提交

---

## Phase 0：基础设施（sys_enum + Money + 枚举中心）

**Files（新建）：**
- `apps/yishan-api/src/modules/core/db/schema.ts` — 追加 `sys_enum` 表
- `apps/yishan-api/src/modules/core/repositories/enum.repository.ts`
- `apps/yishan-api/src/modules/core/services/enum.service.ts`
- `apps/yishan-api/src/modules/core/schemas/enum.schema.ts`
- `apps/yishan-api/src/modules/core/routes/api/v1/admin/enums/index.ts`
- `apps/yishan-api/src/utils/money.ts` — `Money.cents(...)` / `Money.fromYuan(...)` / `Money.format(...)`
- `apps/yishan-api/src/utils/date-range.ts` — 期间重叠、池内时长计算
- `apps/yishan-admin/src/modules/crm/settings/enums/index.tsx` — 枚举中心页面
- `apps/yishan-api/src/modules/crm/drizzle/0010_create-sys-enum.sql`

**Interfaces:**
- 消费：core `db/schema.ts`、`registerPermissions`
- 生产：`sys_enum` 表 + 枚举中心 CRUD + 枚举查询 API（前端按 `type + code` 拉取）

**Step 1：建 sys_enum 表**
- 字段：`id / type / code / name / sort / enabled / createdAt / updatedAt`
- 唯一索引：`(type, code)`
- 索引：`(type, enabled, sort)`
- type 值域（写死在 TypeScript 字典）：`crm_industry / crm_customer_level / crm_customer_status / crm_lead_status / crm_opportunity_stage / crm_opportunity_pipeline / crm_opportunity_lost_reason / crm_visit_result / crm_ticket_priority / crm_ticket_type / crm_payment_method`

**Step 2：迁移 crm 现有 status/source 两张表**
- 把 `crm_customer_status.name` 拷贝进 `sys_enum(type='crm_customer_status', code=旧 code, name=name)`
- 把 `crm_customer_source.name` 拷贝进 `sys_enum(type='crm_customer_source', ...)`
- 业务表加 `status_code varchar(32)` + `source_code varchar(32)` 新列；后台双写
- Phase 1 完成验证后 `DROP TABLE crm_customer_status / crm_customer_source`

**Step 3：Money 工具**
- `Money.cents(n: number)` / `Money.yuan(n: number)` / `Money.fromYuanString(s)`
- `Money.sum([...])` 解决 JS 浮点累加误差
- 配合 Drizzle：`bigint('amount_cents', { mode: 'number' })`
- 测试覆盖 0 / 负数 / 大数（> Number.MAX_SAFE_INTEGER）/ 精度截断

**Step 4：枚举中心 admin 页面**
- `ProTable` 列表 + 按 type 过滤 + 内联编辑启用/排序
- 不允许删除已引用的枚举项（提示但不阻断 UI，service 层拒绝）

**Step 5：枚举查询 API**
- `GET /api/admin/enums?type=crm_opportunity_stage` → `[{code, name, sort}]`
- 缓存 60s（in-process map，避免每页请求都打 DB）
- 前端用 `useEnumList('crm_opportunity_stage')` 拉取；首屏 SSR 一次注入

**验收：**
- `sys_enum` 增删改查 + type 过滤可用
- Money 工具单测全绿
- admin 端能看到 11 种 CRM 枚举且可编辑启用状态

---

## Phase 1：市场 + 客户增量（polymorphic + 枚举外键 + 入池时间）

**目标：** 把现有 crm_customer / crm_contact / crm_activity / crm_lead_activity 与文档对齐；为 Phase 2 腾出 polymorphic 基础。

**Files（修改）：**
- `apps/yishan-api/src/modules/crm/db/schema.ts` — crm_activity 加 `entityType + entityId`；crm_lead_activity 标记 deprecated
- `apps/yishan-api/src/modules/crm/drizzle/0020_crm-activity-polymorphic.sql`
- `apps/yishan-api/src/modules/crm/drizzle/0021_crm-customer-enum-fk.sql`
- `apps/yishan-api/src/modules/crm/drizzle/0022_crm-contact-role-status.sql`
- `apps/yishan-api/src/modules/crm/repositories/{activity,lead-activity,customer,contact}.repository.ts`
- `apps/yishan-api/src/modules/crm/services/{activity,lead,lead-activity,lead-conversion,customer,contact}.service.ts`
- `apps/yishan-api/src/modules/crm/schemas/{activity,lead,customer,contact,error-codes,permissions}.ts`
- `apps/yishan-api/src/modules/crm/routes/v1/{customers,contacts,activities,leads,pool}/index.ts`
- `apps/yishan-api/src/modules/crm/config/system-menu.json`
- `apps/yishan-admin/src/modules/crm/{customers,contacts,activities,leads,lead-pool,pool,settings}/...`（按文档表字段重排）

**Interfaces:**
- 消费：Phase 0 的 sys_enum、Money、枚举中心
- 生产：
  - `crm_activity.entityType ∈ {lead, customer, opportunity, contract}` + `entityId int`
  - `crm_lead_activity` 标记 deprecated，数据双写到 `crm_activity(type='lead_followup')` 后由 Phase 2 后端 drop
  - `crm_customer.pool_entered_at datetime`（公海时效）
  - `crm_customer.industry_code` / `crm_customer.level_code` 外键到 sys_enum
  - `crm_contact.role_code` / `crm_contact.status_code`
  - `crm_customer.status_code` 取代旧 `statusId`

**Step 1：crm_activity polymorphic 化**
- 加列：`entityType varchar(32) NOT NULL` + `entityId int NOT NULL` + `entityRefType` 冗余（用于视图）
- 删列（最后一步）：`customerId`（已迁到 entityType='customer' + entityId）
- 索引：`(entityType, entityId, occurredAt)`
- 旧 `crm_lead_activity` 双写进 `crm_activity(entityType='lead', entityId=leadId, type='lead_followup')`
- 旧 `crm_activity.customerId` 数据迁移为 `entityType='customer' + entityId=customerId`
- `LeadActivityService` 改造为内部仍写两表（向后兼容旧 query）；新业务只写 crm_activity

**Step 2：客户枚举外键化**
- `crm_customer` 加 `level_code varchar(32)` + `industry_code varchar(32)` + `status_code varchar(32)`
- 后台把 `level/industry/statusId` 同步进新列；保留双写一段时间
- 服务层读路径优先新列
- 前端把"客户状态"控件换成 `<ProFormSelect request={...crmEnumRequest('crm_customer_status')} />`

**Step 3：客户公海入池时间**
- 加 `pool_entered_at` 列；每次 assign(null) / 退回公海时刷新
- repository 提供 `findPublic(poolEnteredBefore, poolEnteredAfter)` 用于池内时长筛选
- 删除旧的 `poolStatus` 字段（用 `ownerUserId IS NULL` 判定）

**Step 4：联系人角色 + 状态**
- 加 `role_code` + `status_code`
- 加 `crm_contact_role` 枚举 type，admin 端可维护
- 服务层校验：主联系人每客户最多 1 个，停用联系人不能作为新商机主要联系人

**Step 5：活动 type 扩展**
- 保留现有 `phone / meeting / email / visit / task / note / status_change / owner_change / qualification / profile_edit / owner_change`，**新增 `lead_followup` 类型用于吸收 crm_lead_activity**
- 不变 entry 写入路径（已有调用点）

**Step 6：菜单与权限增量**
- `CRM-客户-状态` 权限独立（仅管理员维护 sys_enum）
- 把"工作台 → 待办"接入"下一步跟进"计算：`next_follow_up_at < now() AND owner_user_id = me`

**验收：**
- 现有线索/线索池/客户/联系人/活动所有页面与现有 E2E 用例通过
- 客户列表可按"客户级别 / 行业 / 状态"过滤且 dropdown 来源为 sys_enum
- 客户公海按入池时间排序显示，池内时长正确计算
- 联系人主联系人唯一性由 DB partial unique index 兜底

**测试要点：**
- 联系人把另一个联系人设为主联系人，旧主联系人 `is_primary` 自动失效（DB trigger 或 service 事务）
- 已停用联系人不能作为新商机的主要联系人

---

## Phase 2：销售前段（商机 + 产品 + 报价单）

**目标：** 商机预测、产品目录、报价版本管理三大能力上线。

**Files（新建）：**
- `apps/yishan-api/src/modules/crm/db/schema.ts` — 追加 crm_opportunity / crm_opportunity_item / crm_product / crm_product_category / crm_unit / crm_quotation / crm_quotation_item / crm_quotation_status_log
- `apps/yishan-api/src/modules/crm/drizzle/0030_crm-opportunity.sql`
- `apps/yishan-api/src/modules/crm/drizzle/0031_crm-product.sql`
- `apps/yishan-api/src/modules/crm/drizzle/0032_crm-quotation.sql`
- `apps/yishan-api/src/modules/crm/repositories/{opportunity,product,quotation}.repository.ts`
- `apps/yishan-api/src/modules/crm/services/{opportunity,product,quotation}.service.ts`
- `apps/yishan-api/src/modules/crm/schemas/{opportunity,product,quotation}.schema.ts`
- `apps/yishan-api/src/modules/crm/routes/v1/{opportunities,products,quotations}/index.ts`
- `apps/yishan-api/src/modules/crm/config/system-menu.json` — 新增销售管理节点
- `apps/yishan-admin/src/modules/crm/{opportunities,products,quotations}/...`

**Interfaces:**
- 消费：sys_enum（crm_opportunity_stage / crm_opportunity_pipeline / crm_opportunity_lost_reason）、Money、polymorphic activity
- 生产：
  - `crm_opportunity` 列表 + 看板（按 stageCode 分列）
  - `crm_opportunity_stage_log`（每次推进/回退写一条）
  - `crm_product` 增删改查 + 启停用
  - `crm_quotation` 版本化：同一商机最新已发送版本 + 草稿多版本
  - `crm_quotation_item`：数量/单价/折扣/税率 → 行金额 cents；总金额 cents = Σ 行金额

**Step 1：crm_opportunity 模型**
- 字段：`name / customerId / contactId? / ownerUserId / ownerDepartmentId / pipelineCode / stageCode / stageEnteredAt / expectedAmountCents / expectedCloseDate / nextActionAt / lostReasonCode? / wonAt / lostAt / version`
- 索引：`(ownerUserId, stageCode)`、`(customerId, stageCode)`
- 状态机：枚举列表由 sys_enum 维护；`advanceStage / rollBackStage` 显式 if
- 写 crm_activity(type='opportunity_stage_change')

**Step 2：管道看板视图**
- 后端：`GET /api/crm/opportunities?view=kanban&pipelineCode=xxx` 返回按 stageCode 分组的结果
- 前端：`<KanbanView columns={stages} items={itemsByStage} />`
- 拖拽改 stage → `PATCH /api/crm/opportunities/:id/stage` → 写 stage_change 审计

**Step 3：crm_product 模型**
- 字段：`name / code(unique) / categoryCode / unitCode / standardPriceCents / taxRateBp(基点, 1300=13%) / enabled / description / createdAt / updatedAt / deletedAt`
- 不管理库存；删除 = 软删除
- 报价时**快照**产品名/单位/单价/税率

**Step 4：crm_quotation 模型**
- `crm_quotation`：`quotationNo / version / customerId / opportunityId / contactId? / ownerUserId / status(draft/sent/accepted/rejected/voided) / validUntil / totalCents / taxCents / netCents / remark / createdAt / updatedAt`
- `crm_quotation_item`：`quotationId / productId / productNameSnapshot / unitSnapshot / quantityCents(int 4 位小数×10000) / unitPriceCents / discountBp / taxRateBp / lineAmountCents`
- 唯一：`quotationNo` + `(opportunityId, version)` 复合
- 状态机：草稿可编辑；发送后只能走接受/拒绝/作废；接受后不可作废
- 同一商机同一时刻只允许 1 个 `accepted`；其他均为历史版本

**Step 5：版本化与金额**
- 编辑草稿：覆盖同一 record
- 已发送报价修改：复制为 `version+1` 的新草稿；保留历史
- 行金额：`lineAmount = round(qty × unitPrice × (1 - discount) × (1 + taxRate))`
- 总金额：`Σ lineAmount`
- 单元测试：精度、累加误差、四舍五入口径

**Step 6：菜单与权限**
- 销售管理一级菜单：`商机 / 产品 / 报价单`
- 权限码：`crm:opportunity:{list,create,update,stage,won,lost,transfer}`、`crm:product:{list,create,update,enable}`、`crm:quotation:{list,create,update,send,accept,reject,void}`

**验收：**
- 商机列表 + 管道看板可切换
- 阶段推进/回退/赢单/丢单各写一条 crm_activity
- 丢单必须选丢单原因
- 报价从商机创建 → 编辑草稿 → 发送 → 接受 → 合同带入 数据完整
- 同一商机再次接受时旧报价状态变更为 `superseded`

---

## Phase 3：销售后段（合同 + 回款）

**目标：** 合同作为最终签约事实；回款计划/实际/核销构成金额真相。

**Files（新建）：**
- `apps/yishan-api/src/modules/crm/db/schema.ts` — crm_contract / crm_payment_plan / crm_payment_actual / crm_payment_writeoff
- `apps/yishan-api/src/modules/crm/drizzle/0040_crm-contract.sql`
- `apps/yishan-api/src/modules/crm/drizzle/0041_crm-payment.sql`
- `apps/yishan-api/src/modules/crm/repositories/{contract,payment-plan,payment-actual}.repository.ts`
- `apps/yishan-api/src/modules/crm/services/{contract,payment-plan,payment-actual}.service.ts`
- `apps/yishan-api/src/modules/crm/schemas/{contract,payment}.schema.ts`
- `apps/yishan-api/src/modules/crm/routes/v1/{contracts,payments}/index.ts`
- `apps/yishan-admin/src/modules/crm/{contracts,payments}/...`

**Interfaces:**
- 消费：sys_enum（crm_payment_method）、polymorphic activity、Money
- 生产：
  - `crm_contract`：`contractNo / name / customerId / opportunityId? / quotationId? / amountCents / signedAt / effectiveAt / expiresAt / status(draft/pending/active/completed/voided) / ownerUserId / attachmentIds[] / description`
  - `crm_payment_plan`：`contractId / periodNo / plannedDate / plannedAmountCents / writtenOffCents(派生) / status(pending/partial/paid/overdue, 计算)`
  - `crm_payment_actual`：`contractId / receivedAt / amountCents / methodCode / operatorUserId / remark`
  - `crm_payment_writeoff`：`actualId / planId / amountCents / createdAt`（多对多桥接）

**Step 1：crm_contract**
- 创建：`fromAcceptedQuotation(quotationId)` 自动带入金额、客户、商机
- 状态机：草稿 → 待签约 → 履约中 → 已完成/已作废
- 履约中金额变更：创建变更记录（`crm_contract_change_log`），不允许直接改 amountCents
- 写 crm_activity(type='contract_status_change')

**Step 2：crm_payment_plan**
- 计划合计 ≤ 合同金额（DB check + service 校验双层）
- 计划项状态计算：定时 job `computePaymentPlanStatus(plan)`：
  - `pending`：未到计划日
  - `partial`：已核销 < 计划
  - `paid`：已核销 == 计划
  - `overdue`：今日 > 计划日 且 未 paid

**Step 3：crm_payment_actual + 核销**
- 实际回款允许超额回款（超额部分可结转下一个 plan）
- 核销策略：FIFO（默认）+ 手动指定
- 冲销：实际回款不允许物理删除，仅创建负向核销 + 审计

**Step 4：定时任务**
- `apps/yishan-api/src/scripts/jobs/payment-status.ts`
- `node-cron` 每小时跑一次 `computeAllPendingPlans()`
- 计算写入 `crm_payment_plan.status` 字段（同事务内写活动通知）

**Step 5：合同应收摘要**
- `GET /api/crm/contracts/:id/payment-summary` 返回
  ```
  { contractAmountCents, plannedCents, paidCents, pendingCents, overdueCents, overdueItems: [...] }
  ```

**验收：**
- 合同从商机赢单或报价接受自动创建
- 回款计划合计校验通过 / 失败正确
- 实际回款登记并核销后计划状态正确翻转
- 逾期状态由 job 正确计算

---

## Phase 4：拜访 + 工单建模

**目标：** 拜访复用活动；工单仅建表与文档字段一致，业务接口延后。

**Files（新建）：**
- `apps/yishan-api/src/modules/crm/db/schema.ts` — crm_ticket（仅 schema）+ crm_activity 已有 type='visit' 走通
- `apps/yishan-api/src/modules/crm/drizzle/0050_crm-visit-fields.sql`（给 crm_activity 加 visit_result / planned_at / location / participants）
- `apps/yishan-api/src/modules/crm/drizzle/0051_crm-ticket.sql`
- `apps/yishan-admin/src/modules/crm/visits/...`

**Interfaces:**
- 消费：sys_enum（crm_visit_result）、polymorphic activity
- 生产：
  - `crm_activity(type='visit')` 加 `plannedAt / location / participants(逗号分隔) / visitResultCode / summary` 列
  - `crm_ticket` 表：`ticketNo / title / customerId / contactId? / contractId? / productId? / typeCode / priorityCode / status(open/processing/pending_confirm/closed) / ownerUserId / slaDueAt / description / solution / createdAt / closedAt`
  - **不挂任何业务路由**：表保留供 Phase 5 P1 使用
  - 拜访独立列表页 `/crm/visits`：查询 `crm_activity WHERE type='visit'`，按 `plannedAt` 排序

**验收：**
- 拜访可以从客户/商机详情创建
- 拜访在独立列表页与关联对象详情时间线均可查询
- 工单表已建但无 API；任何对它的引用都会编译期报错（防止误用）

---

## 跨 Phase 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| polymorphic 数据迁移不一致 | 时间线查询漏数据 | Phase 1 完成后跑对账脚本：旧 crm_lead_activity / crm_activity.customerId 行数 vs 新 entityType='lead' / 'customer' 行数 |
| sys_enum type 漂移 | 前端 dropdown 找不到 | TypeScript 字典集中（`packages/shared-crm-enums`），后端插入时校验 |
| Money 单位混淆 | 金额错位 | 所有 repository 写入路径统一 `amountCents`，CI 加 lint 禁止 schema.ts 出现 `decimal` 列 |
| 报价/合同/回款金额计算误差 | 财务数据不准 | Money 工具单测覆盖 100+ 边界；service 层所有计算走 Money API |
| 工作台提醒过载 | 用户关掉提醒 | 工作台"下一步"过滤掉 status=closed/won/lost/contact_invalid + 已完成活动 + 已转化的对象 |

---

## 验收总则

每个 Phase 完成后必须：

1. 跑 `pnpm --filter yishan-api test` + `pnpm --filter yishan-admin test`，新增测试必须包含
2. `pnpm --filter yishan-admin openapi` 重生成并提交
3. 在 `apps/yishan-admin/src/modules/crm/<new-page>/` 下有对应页面
4. 更新对应 `docs/products/crm/**/*.md`（如果实施过程中发现文档有遗漏，回写文档）
5. 在 PR 描述里列出：本 Phase 引入了哪些新权限码、新错误码、新枚举 type、新菜单路径

---

## 执行顺序建议（人）

1. **Phase 0**：约 1 人日，建基础设施
2. **Phase 1**：约 2-3 人日，是后续 Phase 的地基，先做
3. **Phase 2**：可拆 2 人并行（商机 + 产品 / 报价单），约 3-4 人日
4. **Phase 3**：约 2-3 人日
5. **Phase 4**：约 1 人日

合计：~10-14 人日的实施量。

---

## 子 plan 文件（按 Phase 拆分）

实施时按以下文件名开新 plan，避免单文件过长：

- `docs/superpowers/plans/2026-09-08-crm-phase0-foundations.md`
- `docs/superpowers/plans/2026-09-08-crm-phase1-market-customer.md`
- `docs/superpowers/plans/2026-09-08-crm-phase2-sales-front.md`
- `docs/superpowers/plans/2026-09-08-crm-phase3-sales-back.md`
- `docs/superpowers/plans/2026-09-08-crm-phase4-visit-ticket.md`

每个子 plan 继承本文件的 **Global Constraints** + **Style Baseline**，并把本文件的 Phase Step 拆成可勾选 checkbox。
