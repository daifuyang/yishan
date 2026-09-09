# Phase 3: 销售后段（合同 + 回款）

> 继承自 [`2026-09-08-crm-refactor-roadmap.md`](./2026-09-08-crm-refactor-roadmap.md) 的 **Global Constraints** + **Style Baseline**。

**目标：** 合同作为最终签约事实；回款计划/实际/核销构成金额真相。

**前置依赖：** Phase 2 的 `crm_quotation`（accepted 报价才能产生合同）。

---

## Step 1：crm_contract

- 表：`contractNo(unique) / name / customerId / opportunityId? / quotationId? / amountCents(BIGINT) / signedAt / effectiveAt / expiresAt / status(draft/pending/active/completed/voided) / ownerUserId / attachmentIds(json) / description`
- 索引：`(customerId, status)`, `(ownerUserId, status)`, `(opportunityId)`, `(quotationId)`
- 状态机：草稿 → 待签约 → 履约中 → 已完成/已作废
- 创建入口：`ContractService.createFromAcceptedQuotation(quotationId)`
- 履约中金额变更：写 crm_contract_change_log（暂不实现 change_log 子表，使用 crm_activity(type='contract_status_change') 暂代）

## Step 2：crm_payment_plan

- 表：`contractId / periodNo / plannedDate / plannedAmountCents(BIGINT) / status(pending/partial/paid/overdue)`
- 计划合计 ≤ 合同金额（DB check + service 校验双层）
- status 由 `computePaymentPlanStatus` 计算（Phase 3 写一次性函数 + 内存 job；Phase 5 接 node-cron）

## Step 3：crm_payment_actual

- 表：`contractId / receivedAt / amountCents / methodCode / operatorUserId / remark`
- 关联到 contract；不直接关联到 plan
- 核销策略：FIFO（默认）

## Step 4：crm_payment_writeoff

- 表：`actualId / planId / amountCents / createdAt`（多对多桥接）
- 实际回款分摊到具体计划

## Step 5：CRON job

- 位置：`apps/yishan-api/src/scripts/jobs/payment-status.ts`
- 入口：CLI 触发（生产环境由 FC cron 触发）
- 逻辑：遍历未 paid plan，重算 status；写 crm_activity 通知

## Step 6：合同应收摘要

- `GET /api/crm/v1/contracts/:id/payment-summary` 返回
  ```
  { contractAmountCents, plannedCents, paidCents, pendingCents, overdueCents, overdueItems }
  ```

---

## 子 plan 文件（待 Phase 3 实施时细化）

- `apps/yishan-api/src/modules/crm/db/schema.ts` — 追加 4 张表
- `apps/yishan-api/src/modules/crm/drizzle/0040_crm-contract.sql`
- `apps/yishan-api/src/modules/crm/drizzle/0041_crm-payment.sql`
- `apps/yishan-api/src/modules/crm/repositories/{contract,payment-plan,payment-actual,payment-writeoff}.repository.ts`
- `apps/yishan-api/src/modules/crm/services/{contract,payment-plan,payment-actual}.service.ts`
- `apps/yishan-api/src/modules/crm/schemas/{contract,payment}.schema.ts`
- `apps/yishan-api/src/modules/crm/routes/v1/{contracts,payments}/index.ts`
- `apps/yishan-admin/src/modules/crm/{contracts,payments}/...`

## 验收

- [ ] 合同从报价接受自动创建
- [ ] 回款计划合计校验通过
- [ ] 实际回款登记并核销后计划状态正确翻转
- [ ] 逾期状态由 job 正确计算

## 状态

- [ ] 全部 Phase 3 实施（pending Phase 2 completion）
- [ ] 实际工作中由子 Agent 并行实施
