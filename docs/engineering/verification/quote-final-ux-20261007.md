# 报价最终 UI/UX 验收（2026-10-07）

## 本轮修改文件

前端：

- `apps/yishan-admin/src/modules/crm/components/quotation/QuoteCreateModal.tsx`
- `apps/yishan-admin/src/modules/crm/components/quotation/QuoteCreateModal.test.tsx`
- `apps/yishan-admin/src/modules/crm/components/quotation/QuoteDetailModal.tsx`
- `apps/yishan-admin/src/modules/crm/components/quotation/QuoteDetailModal.test.tsx`
- `apps/yishan-admin/src/modules/crm/components/opportunity/OpportunityDetailModal.test.tsx`（新字段 fixture 适配）
- `apps/yishan-admin/src/modules/crm/utils/quotationMoney.ts`
- `apps/yishan-admin/src/modules/crm/utils/quotationMoney.test.ts`
- `apps/yishan-admin/src/pages/q/[token].tsx`
- `apps/yishan-admin/src/pages/q/index.module.less`
- `apps/yishan-admin/src/pages/q/PublicQuotePage.test.tsx`
- `apps/yishan-admin/src/services/crm.ts`
- `apps/yishan-admin/src/services/generated/crm.ts`
- `apps/yishan-admin/src/services/generated/typings.d.ts`

后端与 API 契约：

- `apps/yishan-api/src/modules/crm/db/schema.ts`
- `apps/yishan-api/src/modules/crm/schemas/quotation.schema.ts`
- `apps/yishan-api/src/modules/crm/repositories/quotation.repository.ts`
- `apps/yishan-api/src/modules/crm/services/quotation.service.ts`
- `apps/yishan-api/src/modules/crm/drizzle/0068_crm-quotation-discount-description.sql`
- `apps/yishan-api/src/modules/crm/drizzle/meta/_journal.json`
- `apps/yishan-api/src/modules/crm/tests/quotation-workflow.test.ts`
- `apps/yishan-api/src/modules/crm/tests/quotation-share.test.ts`
- `apps/yishan-api/src/modules/crm/tests/quotation-response.test.ts`
- `apps/yishan-api/openapi.json`

0068 已应用到当前本地数据库。新增字段均可空，历史报价兼容。内部优惠原因只进入内部 CRM 响应；PublicQuoteDTO 与公开响应 Schema 均为白名单。

## 实际检查结果

| 检查 | 结果 |
| --- | --- |
| Admin `tsc --noEmit` | 通过 |
| Admin `lint` | 通过；31 条现有 warning、1 条 info |
| Admin Jest 全量 | 23 个测试文件通过，153 个测试通过 |
| API Vitest 全量（最终代码） | 52 个测试文件通过，500 个测试通过；20 个集成测试跳过 |
| API `build:ts` | 通过 |
| Admin production build | 通过 |
| 根目录 `pnpm test` | 通过（Admin + API） |
| 根目录 `pnpm build` | 通过（TipTap + Admin + Docs） |
| 根目录 `pnpm lint` | 未通过：`yishan-app` 已有用户编辑页的组件/API 类型错误；Admin 与 Docs 检查通过 |
| OpenAPI 导出及 Admin 客户端生成 | 通过 |

新增测试覆盖默认有效期 +7 天、手动有效期保护、商机切换名称与手写名保护、数量尾零、优惠显隐/保存/边界、服务端金额计算、公开说明白名单、内部原因隔离、分享异常状态、生成/替换/停用确认、替换归属校验与事务回滚、秒精度有效期。

## 真实沙盘

使用客户 23「上海禾味餐饮管理有限公司」、联系人 15「张明远」、负责人「愚公」。原商机 1 已在商务谈判；验收创建同名商机副本 2，不修改原商机阶段。

通过真实客户详情 UI 创建报价 3：`Q-20261007-0001`，名称「禾味餐饮 CRM 数字化项目第一版报价」。报价日期 2026-10-07，有效期默认 2026-10-14。

| 项目 | 数量 / 单位 | 单价 |
| --- | --- | --- |
| 标准 CRM 基础方案 | 1 套 | ¥36,000 |
| 40账号方案 | 1 项 | ¥12,000 |
| 门店企业客户服务记录定制 | 1 项 | ¥18,000 |
| 实施及数据初始化 | 1 项 | ¥4,000 |

小计 ¥70,000；优惠 ¥4,000；对外说明「首期合作优惠」；内部原因「客户同时对比两家CRM供应商，为推进首次合作给予竞争性报价。」；报价金额 ¥66,000。API 返回的金额均为整数分。

实际验证：

- 状态和负责人 disabled Input 均不存在，客户显示为文字。
- 选择商机后默认名称、联系人正确；数量输入显示 1。
- 报价日期改为 10-08 时，有效期跟随到 10-15；手动改为 10-20 后再改日期，有效期仍为 10-20。
- 1024px 下 Modal 不超出视口，明细保持可操作，内容内部滚动，底部取消/保存固定。
- 保存返回 draft；商机副本仍为 solution。
- 分享链接生成与正式发送分离；草稿预览禁用，正式发送后启用。
- 正式发送返回 sent；商机副本进入 quotation。
- 原商机 1 的 negotiation 保持不变。
- 浏览器实际复制显示「链接已复制」；预览打开客户公开页。
- 重新生成新链接后，旧链接公开接口返回 revoked。
- 停用后公开接口返回 revoked，重新读取详情仍保留 revoked metadata。
- 分享区显示「客户已查看 · 最近 … · 共…次」，复制和预览各一个入口，危险操作位于 More。
- 重新打开 Modal 后当前会话 URL 仍可用。
- 全新未登录浏览器访问公开页成功；DTO 没有 internalDiscountReason，页面没有内部原因文本。
- 最终分享有效期实际落库为 `2026-10-14T15:59:59.000Z`，界面显示 2026-10-14 23:59。

最终有效公开链接：

http://localhost:8000/q/1veLuQc9HmuqNpx5kx3tpBldQ8oM8AtZ9OaaU8VXioc

现有 API 仅在生成时返回原始链接，后端继续只保存 token 哈希。前端按报价与分享记录保留当前浏览器会话链接；浏览器整页刷新后，旧链接无法从哈希还原，复制/预览提示通过 More 重新生成。

前端 8000、后端 3100 已重新启动并验证监听。未实现优惠审批、报价 V2、谈判、合同、回款、客户支付或确认。

## 页面证据

- [创建弹窗桌面](quote-create-desktop.png)
- [创建弹窗 1024px](quote-create-1024.png)
- [保存后草稿详情](quote-detail-draft.png)
- [最终分享区域](quote-share-final.png)
- [停用状态](quote-share-revoked.png)
- [公开页桌面](quote-public-desktop.png)
- [公开页手机](quote-public-mobile.png)
