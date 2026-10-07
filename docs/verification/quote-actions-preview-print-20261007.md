# 报价 / 商机表格操作与内部预览打印验收

日期：2026-10-07。当前工作区直接修改，未提交或部署。

## 修改文件

- Admin：`src/modules/crm/components/drawer/tabs/QuotationsTab.tsx`、`OpportunitiesTab.tsx`。
- Admin：`src/modules/crm/pages/quotations/index.tsx`、`domain/statuses.ts`、`domain/quoteActions.ts`。
- Admin：`components/quotation/QuoteActions.tsx`、`QuoteFormModal.tsx`、`QuoteCreateModal.tsx`、`QuoteVoidModal.tsx`、`QuoteDetailModal.tsx`。
- Admin：`src/pages/q/[token].tsx`、`index.module.less`、`services/crm.ts`、`utils/quotationMoney.ts`。
- API：`src/modules/crm/services/quotation.service.ts`、`repositories/quotation.repository.ts`、`schemas/quotation.schema.ts`、`routes/v1/quotations/index.ts`。
- OpenAPI：`apps/yishan-api/openapi.json`、Admin `services/generated/crm.ts` 和 `typings.d.ts`（生成器同步输出其他已有生成文件；保留原有 shop 兼容接口）。
- 测试：`quoteActions.test.ts`、`QuoteCreateModal.test.tsx`、`QuoteDetailModal.test.tsx`、`PublicQuotePage.test.tsx`、`quotationMoney.test.ts`、API `quotation-share.test.ts`、`quotation-response.test.ts`、`quotation-preview-route.test.ts`。

## 操作规则

名称始终打开详情，没有重复“查看”。报价操作列固定最右，140px；名称250px，日期84px（当年显示月日，悬停显示完整日期），负责人64px。商机操作列104px。

统一 `getQuoteActions` 同时用于客户报价 Tab、全局报价列表与报价详情。

| 报价状态 | 直接动作 | More |
| --- | --- | --- |
| 草稿且从未分享 | 编辑、分享 | 删除 |
| 草稿且曾分享 | 分享 | 作废 |
| 已发送 | 分享 | 作废 |
| 已作废及其他关闭状态 | — | 无 |

按现有 `crm:quotation:update/send/void/delete` 权限显示。分享继续使用已有 send 权限，没有新增权限点。是否曾分享使用 SQL EXISTS 返回的 `hasShare`，包括已过期、已停用记录。服务端同步阻止已分享草稿编辑/删除；生成分享与编辑共用报价行锁，避免并发绕过锁定。

编辑复用创建表单，保存使用现有更新 API；保留旧明细的产品ID、折扣和税率。作废使用原因表单，调用已有作废 API。删除确认成功后关闭详情。首次生成分享后刷新列表动作。

分享入口复用详情中的生成 Modal：无分享记录时自动打开生成交互，有记录时滚动到现有横向分享区域。正式发送动作仍调用原发送接口，保持草稿→已发送及商机推进事务；动作移到分享区域，编辑不发送。

商机统一映射：需求确认→方案，方案沟通→报价，商务报价→谈判，商务谈判/赢单/输单无主推进动作。不修改状态机。

## 明确未实现项

全仓库搜索没有找到 revise / new-version API、版本复制 Action 或原有 QuoteEditModal / QuoteVoidModal。编辑、作废已通过现有 API 补齐 UI；用户要求不新增版本业务，因此没有伪造“新版本”按钮或接口。已发送 More 当前只有作废；已作废当前为“—”；详情当前也没有新版本 Footer。已向用户说明并请求已有实现位置。

## 内部预览与打印

- 内部地址 `/q/preview?preview=1&quotationId=<id>` 使用受登录、报价权限和数据范围保护的 `/quotations/:id/preview`。
- 客户复制链接仍为原 `/q/<token>`，公开接口继续累加查看；公开参数无法绕过统计。
- 内部预览及打印均复用客户报价白名单，内部优惠原因不出现在响应、页面或打印中。
- 详情新增“打印 / 导出 PDF”，打印地址追加 `print=1`，加载完成后打开打印窗口；页面也支持手动打印。
- A4、14mm页边距，隐藏按钮/内部预览标识，去背景和装饰边框；明细行及汇总避免跨页断裂。
- PDF验证生成一页，MediaBox约595×842pt，标题使用报价名称。
- 已被此前预览污染的历史次数没有重置。

## 沙盘证据

客户23：上海禾味餐饮管理有限公司。报价3和1均已发送，金额¥66,000，列表显示“分享 + ···”，无编辑。作废菜单打开原因表单后取消，未更改业务状态。

商机2为商务报价，显示谈判；商机1为商务谈判，显示“—”。名称详情入口保留。

报价3内部预览并刷新：share7的viewCount维持1，首次/最近查看均保持2026-10-07T03:49:58Z。匿名预览接口401。

对报价1已知客户公开链接进行一次访问：公开state=ok，viewCount从8增加至9。该增加属于本次公开访问验收。

截图：`quote-actions-table.png`、`opportunity-actions-table.png`、`quote-print-preview.png`。PDF：`quote-print-a4.pdf`。没有创建新报价、推进商机、发送、作废、删除、重新生成或停用沙盘业务记录。

## 工程验证

- Admin typecheck/lint通过；保留31条既有warning和1条info。
- Admin 24个测试套件，169个测试通过。
- API 53个测试文件，505个测试通过，20个集成测试按配置跳过。
- API `build:ts`通过。
- OpenAPI dump及Admin客户端再生成通过。
- Admin production build通过。
- 根目录 `pnpm test`、`pnpm build`通过（TipTap/Admin/Docs）。
- 根目录 `pnpm lint`失败于未改动的小程序原有组件属性/类型错误（例如Tag的outline、ButtonSize、Card的title）；Admin和Docs检查通过。未扩展修复到小程序。
- 独立代码复核发现并修复：编辑Modal层级、分享后列表动作陈旧、删除详情后错误重载；复核未发现剩余重要回归。
- 前后台最后重新启动：Admin8000，API3100。
