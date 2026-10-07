# CRM 核心模型 Demo 数据审计（2026-10-07）

本次仅连接本地 Docker MySQL `yishan`（客户 23），执行了只读查询。未执行合并、删除、软删除或其它写入。完整 before 证据（字段中的 `token_hash` 已排除）保存在被 `.gitignore` 忽略的 `tmp/crm-demo-audit/`：`before.json`、`downstream.json`、`repair-dry-run.json`；`rollback-before.sql` 是原始行的恢复用 UPDATE 脚本，分享 token 不在备份中。

## 商机诊断

| ID | 创建时间 | 阶段 | 金额 | 预计成交 | 负责人 | 关联报价 | Activity（metadata.opportunityId） |
| ---: | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | 2026-10-06 15:27:38 | `negotiation` 商务谈判 | ¥60,000 | 2026-10-31（DB：2026-10-30 16:00） | 1 愚公 | 1、4 | 10 |
| 2 | 2026-10-07 11:35:54 | `quotation` 商务报价 | ¥60,000 | 2026-10-31（DB：2026-10-30 16:00） | 1 愚公 | 3 | 19 |

两行 `customer_id=23`，名称均为“禾味餐饮 CRM 数字化项目”，金额、预计成交日和负责人完全相同。ID 1 的活动 29、31、34、36 明确形成“需求确认 → 方案沟通 → 商务报价 → 商务谈判”，并且报价 1 与版本 4 都属于该机会；活动 60 记录 V1 → V2。ID 2 从 `opportunity_created` 开始，紧接着创建报价 3，并在验收操作中反复生成/停用分享链接。已有验收记录 `docs/verification/quote-final-ux-20261007.md` 也明确写着“原商机 1 已在商务谈判；验收创建同名商机副本 2”。因此 ID 2 确认为本地验收副本，ID 1 为 canonical；判断依据是活动时间线、报价关联和文档证据，而不是名称或阶段单一字段。

`crm_opportunity_stage_log` 当前行数为 0；阶段历史完整保存在 `crm_activity.metadata`（`eventType=opportunity_stage_changed`）中。合同、回款、直接成交、商机产品意向均为 0，未发现其它下游引用。

## 报价诊断

| Quote ID | 原单号 | 原名称 | 状态 | 金额 | root/source | Items | Shares | 判定 |
| ---: | --- | --- | --- | ---: | --- | ---: | ---: | --- |
| 1 | `Q-20261006-0001` | 禾味餐饮 CRM 数字化项目第一版报价 | `sent` | ¥66,000 | root=1/source=NULL | 4 | 1（active，查看 9 次） | 真实 V1 |
| 4 | `Q-20261006-0001-R2` | 禾味餐饮 CRM 数字化项目第二版报价 | `draft` | ¥64,000 | root=1/source=1 | 4 | 0 | 真实 V2，当前版本 |
| 3 | `Q-20261007-0001` | 禾味餐饮 CRM 数字化项目第一版报价 | `sent` | ¥66,000 | root=3/source=NULL | 4 | 6（1 active，验收期间反复停用/重建） | 本地验收副本 |

Quote 1 → Quote 4 是已有稳定版本关系；版本 4 的活动 60 记录 `sourceQuoteId=1`、`rootQuoteId=1`，金额从 ¥66,000 调整为 ¥64,000。Quote 3 与 Quote 1 的明细金额相同、版本均为 1，但其创建时间、机会关联、单号日期、分享操作和 17 条活动均对应 2026-10-07 的第二次验收，不能按名称合并进同一版本链。

三个报价各有 4 条 `crm_quotation_item`，共 12 条；报价状态日志 2 条。合同和回款为 0。Quote 3 的 6 条分享记录中最后一条仍为 `active`，并且有客户查看记录；按本次约束，“有 Share 的历史报价不可删除”。它可以在机会合并时保留原报价身份并只迁移 `opportunity_id`，不能删除或并入真实 V1/V2 版本链。

## Dry-run 与修复结论

`apps/yishan-api/scripts/repair-crm-demo.mjs` 是显式 ID 的修复守卫，默认只读：

```text
node apps/yishan-api/scripts/repair-crm-demo.mjs
```

输出 canonical=1、duplicate=2、真实报价=[1,4]、测试报价=3，统计活动、明细、分享及下游引用。Quote 3 的分享历史不会阻断机会合并：`--apply` 会在强断言和同一事务中把机会 2 的报价/报价系列关联改到机会 1，把活动 metadata/entity、阶段日志和产品意向迁移到机会 1，然后软归档机会 2；Quote 3 的内容、明细、分享和活动全部保留为独立报价系列。脚本没有被执行写入。

本次不执行 `--apply`。因此当前数据库仍是 2 条机会、3 条报价。按脚本完成合并后的安全预期是 1 条 canonical Opportunity，但报价系列应保留 2 组：真实主链（Quote 1/V1、Quote 4/V2）和保留历史 Share 的验收系列（Quote 3/V1）。不能为了得到“报价单 1”而隐藏或删除后者；Series UI 应明确过滤/标识归档验收系列，或由产品另行批准历史分享迁移方案。
