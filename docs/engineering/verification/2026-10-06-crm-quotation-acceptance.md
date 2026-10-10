# 商机 → 报价闭环验收记录

已完成上海禾味餐饮管理有限公司的两次真实验收。创建草稿后商机保持 `solution`；确认发送后报价为 `sent`、商机为 `quotation`。最终为报价 1、合同 0、回款 0。

## 1. 本次修改的文件

在开始任务时已有的未提交 CRM 改动上继续实现，保留这些改动。以下只列本次报价闭环涉及的文件。

管理端：

- `apps/yishan-admin/src/modules/crm/components/quotation/QuoteCreateModal.tsx`：新建报价表单，接替原 `drawer/tabs/QuotationCreateModal.tsx`。
- `apps/yishan-admin/src/modules/crm/components/quotation/QuoteDetailModal.tsx`：报价详情、确认发送和只读状态。
- `apps/yishan-admin/src/modules/crm/components/quotation/QuoteDetailModal.test.tsx`：详情、发送、失败保留输入和跨阶段 Modal 生命周期测试。
- `apps/yishan-admin/src/modules/crm/components/opportunity/OpportunityAdvanceModal.tsx`：方案沟通阶段的两个报价入口复用创建组件。
- `apps/yishan-admin/src/modules/crm/components/opportunity/OpportunityDetailModal.tsx` 及其测试：关联报价数量刷新和点击查看。
- `apps/yishan-admin/src/modules/crm/components/drawer/CustomerDrawer.tsx`：报价入口请求和客户数据刷新。
- `apps/yishan-admin/src/modules/crm/components/drawer/tabs/QuotationsTab.tsx`：报价名称、状态、金额、日期、商机、负责人及详情入口。
- `apps/yishan-admin/src/modules/crm/components/drawer/sub/ActivityTimeline.tsx`：创建报价、发送报价的动态标签。
- `apps/yishan-admin/src/modules/crm/pages/quotations/index.tsx`：全局报价列表使用 ProTable 和报价详情 Modal。
- `apps/yishan-admin/src/modules/crm/utils/quotationMoney.ts` 及其测试：整数金额计算和展示。
- `apps/yishan-admin/src/modules/crm/utils/crmEvents.ts`：报价及商机刷新事件。
- `apps/yishan-admin/src/services/crm.ts`：报价调用及类型改为复用生成客户端。
- `apps/yishan-admin/src/services/generated/crm.ts`、`index.ts`、`typings.d.ts`：生成的客户端及参数类型；保留其他模块原有客户端。

API：

- `apps/yishan-api/src/modules/crm/db/schema.ts`：报价日期、明细描述。
- `apps/yishan-api/src/modules/crm/drizzle/0066_crm-quotation-workflow.sql` 和 `meta/_journal.json`：增量迁移及登记。
- `apps/yishan-api/src/modules/crm/schemas/quotation.schema.ts`、`error-codes.ts`：请求校验、详情/列表响应、业务错误。
- `apps/yishan-api/src/modules/crm/repositories/quotation.repository.ts`：快照字段、关联名称、部门范围、行锁和明确的时间写入。
- `apps/yishan-api/src/modules/crm/services/quotation.service.ts`：事务创建、事务发送、金额与关联校验。
- `apps/yishan-api/src/modules/crm/routes/v1/quotations/index.ts`：列表使用不含明细的响应契约。
- `apps/yishan-api/src/modules/crm/repositories/opportunity.repository.ts`、`services/opportunity.service.ts`：锁定商机并复用外部事务推进状态。
- `apps/yishan-api/src/modules/crm/tests/quotation-workflow.test.ts`、`quotation-service.test.ts`：闭环、金额、权限和异常回归。
- `apps/yishan-api/src/utils/money.ts`：消除半分舍入的浮点误差。
- `apps/yishan-api/openapi.json`：同步报价契约。

## 2. Quote 最终模型

继续使用 `crm_quotation`，没有新建重复报价实体。

`id / quotationNo / name / version / customerId / opportunityId / contactId / ownerUserId / status / quoteDate / validUntil / netCents / taxCents / discountAmountCents / totalCents / remark / sentAt / acceptedAt / closedAt / creatorId / updaterId / createdAt / updatedAt / deletedAt`。

查询响应补充客户、商机、联系人、负责人名称以及关联商机的部门信息。新建接口要求客户、商机、联系人、报价日期和有效期；负责人继承商机。旧数据库的可空关联列保留兼容，但新建及发送必须通过完整关联校验。

## 3. QuoteItem 最终模型

继续使用 `crm_quotation_item`：

`id / quotationId / productId / productNameSnapshot / description / unitSnapshot / quantityCents / unitPriceCents / discountBp / taxRateBp / lineAmountCents / sortOrder / createdAt / updatedAt`。

名称、描述、单位、数量、单价和金额均保存商业快照。

## 4. 手工项目报价

支持。表单直接填写项目名称、描述、数量、单位和单价；无需产品库或 SKU。

## 5. 未来 Product / SKU 关联

`productId` 已支持可空关联。历史快照不依赖产品当前数据。当前 CRM 未新增 SKU 字段或 SKU 业务；未来可以增加可空 `skuId`，无需改变手工报价流程。

## 6. 金额存储与计算

金额使用 BIGINT 整数分；数量沿用 `quantityCents` 的 ×10000 精度。后端通过既有 Money 工具用 BigInt 乘除和逐行舍入后求和，前端预览采用相同整数口径，数据库保存服务器计算结果。

沙盘：明细金额为 `3600000 / 1200000 / 1800000 / 400000` 分，小计 `7000000` 分，最终 `6600000` 分。界面统一显示 `¥66,000`。

## 7. 折扣

沿用 `discountAmountCents` 固定金额优惠；拒绝负优惠或超过小计的优惠，不再静默钳位为零。修改草稿的优惠也会重新计算总额。既有行折扣和税率模型继续保留。

## 8. 报价编号

后端沿用 `Q-yyyyMMdd-四位序号`，唯一索引兜底；编号冲突时重试整个创建事务，最多三次。前端不生成编号。本次为 `Q-20261006-0001`，使用服务器保存日期；业务报价日期填写 `2026-10-10`。

## 9. 报价版本

沿用 `version = 1`，展示 `V1`。本次没有增加复制、V2 或版本对比动作。

## 10. 创建入口

商机详情 Footer 和客户商机 Tab 的“报价”均经 `OpportunityAdvanceModal` 中同一个 `QuoteCreateModal` 入口打开表单。方案沟通阶段不调用 advance API，也不出现“确认进入报价”。报价创建权限使用 `crm:quotation:create`。

## 11. QuoteCreateModal

组件管理打开、表单、默认值、验证、提交和错误反馈。宽度 1000px，小屏限制为视口减 32px，超高内容内部滚动。轻量客户/商机上下文、两列基本信息、Form.List 可编辑报价 Table、自动金额、整单优惠、2000 字备注；Footer 为取消/保存。保存后关闭创建表单并打开报价详情。

## 12. QuoteDetailModal

宽度 960px；标题/状态、副标题、金额/有效期/负责人、明细 Table、金额汇总、备注和次要元数据。草稿显示关闭/发送报价，发送前使用确认框；已发送只显示关闭，明细只读。发送错误保留草稿和确认框，允许重试。

## 13. 草稿后的商机阶段

真实数据库已确认创建草稿后仍为 `solution / 方案沟通`。新增创建请求的必填关联及日期是有意的 API breaking change；历史不完整草稿需补齐上下文后才能发送。

## 14. 发送 API

复用 `POST /api/crm/v1/quotations/:id/send` 和已有 `crm:quotation:send` 权限，不添加重复 quotes API。检查草稿状态、明细、正总额、有效期、商机阶段、客户/联系人一致性和数据范围。

## 15. 发送事务

报价锁、商机锁、报价状态及 sentAt、状态日志、阶段推进、客户生命周期重算与业务动态使用同一事务。任何步骤失败整体回滚。重复发送拒绝；已处于 quotation 的商机不重复推进。

除了自动化测试，还对真实本地 MySQL 注入过明细写入失败及发送动态写入失败。确认主表、阶段、动态和状态日志都没有留下部分结果。

## 16. Opportunity 状态机

复用 `OpportunityService.advanceStage()`，增加可使用调用方事务的能力；没有在报价服务复制阶段转换规则。

## 17–18. 发送后的状态

真实报价 `status = sent`，`sentAt` 已写入；商机 `stage = quotation / 商务报价`。没有继续推进商务谈判。

## 19. Activity

数据库及客户动态 UI 均验证 `quote_created`、`quote_sent`、`opportunity_stage_changed`。阶段变化为方案沟通 → 商务报价，前端没有插入动态。

## 20. 数量与刷新

客户报价 Tab 和商机详情关联报价均为 1。客户 Drawer 保持打开；发送后商机列表显示商务报价，Footer 显示谈判；报价详情变为只读。刷新浏览器后再次打开报价，四项明细和金额仍然完整。

## 21–24. 实际验证

| 检查 | 结果 |
| --- | --- |
| 管理端严格类型检查与 `pnpm --filter yishan-admin lint` | 通过；全管理端既有 31 条告警和 1 条提示，报价相关文件定向 lint 无告警 |
| `pnpm --filter yishan-api build:ts` | 通过 |
| `pnpm test` | 通过；管理端全量 126 项通过，API 当时 481 项通过 |
| 最终 API 全量测试 | 482 项通过，20 项原有环境集成测试跳过 |
| 最终管理端定向测试 | 4 个测试文件、23 项通过，覆盖客户 Drawer、商机详情、报价生命周期与金额 |
| `pnpm build` | 通过，含共享 TipTap、管理端和文档站 |
| 最终管理端 build | 通过 |
| OpenAPI 客户端生成 | 已执行成功并保留报价相关输出 |
| `git diff --check` | 通过 |
| `pnpm lint` 全仓门禁 | 未通过：进入未修改的小程序后，既有 Card/Tag/Button 属性类型错误阻塞 |

## 25. 完整沙盘结果

客户：上海禾味餐饮管理有限公司；联系人：张明远；商机：禾味餐饮 CRM 数字化项目；负责人：愚公。

先在真实浏览器录入四项和备注，报价日期 `2026-10-10`、有效期 `2026-10-20`，保存 ¥66,000 草稿，直接查询数据库确认商机仍为 solution。随后从报价详情点击发送并确认，验证报价为 sent、商机为 quotation、两个发送相关业务动态存在。最后用当前管理端重新打开客户、报价 Tab、商机详情及关联报价，验证只读详情和持久化数据。

最终：**商务报价；报价 1（已发送，V1，¥66,000）；合同 0；回款 0。**

本次新增迁移已应用并登记到本地沙盘数据库。没有继续谈判、V2、报价接受、合同或回款。

## 26. TODO 与限制

本次报价闭环没有剩余功能 TODO。其他环境需要按既有模块迁移流程应用 `0066`。全仓 lint 的小程序既有类型错误仍需独立处理。既有浏览器控制台的 ProTable 渲染期状态提示及其他 Modal 的弃用提示未在本次扩大修复范围。
