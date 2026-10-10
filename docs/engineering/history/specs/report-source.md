# CRM MVP 调研来源记录

## 范围

本调研为面向小型通用 B2B 销售团队的 CRM MVP 对象模型、工作方式和表格化管理界面提供行业基线。它不评估厂商定价、部署方案或特定行业流程。

## 结论

成熟 CRM 普遍采用线索、客户/联系人、商机、活动和报价到现金的对象分层；活动和下一步是日常销售执行的中心，商机阶段和金额是漏斗管理的中心。首个 MVP 应保留这些闭环能力，而将复杂自动化、预测、审批和售后工单完整流程延后。

## 来源台账

| 结论 | 来源 | 发布者 | 日期 | 链接 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 商机承接线索后并连接报价和订单到现金 | Pursue opportunities business process overview | Microsoft | 2026-05-12 更新 | https://learn.microsoft.com/en-us/dynamics365/guidance/business-processes/prospect-to-quote-pursue-opportunities-overview | 一手产品流程资料 |
| 线索合格后可关联或创建客户、联系人和商机 | Converting Leads | Salesforce | 访问于 2026-09-08 | https://help.salesforce.com/s/articleView?id=leads_convert_parent.htm&language=en_US | 一手产品帮助资料 |
| 活动可关联线索、联系人、组织和商机并表达下一步 | Activities | Pipedrive | 2026-04-08 更新 | https://support.pipedrive.com/en/article/activities | 一手产品帮助资料 |
| 下一项活动与逾期活动用于商机优先级 | Pipeline view: how to prioritize deals | Pipedrive | 2026-09-03 更新 | https://support.pipedrive.com/en/article/how-are-deals-ordered-in-the-pipeline-view | 一手产品帮助资料 |
| 商机包含阶段、阶段进入日期、负责人和活动信息 | HubSpot's default deal properties | HubSpot | 访问于 2026-09-08 | https://knowledge.hubspot.com/properties/hubspots-default-deal-properties | 一手产品帮助资料 |
| 表格适合结构化信息的搜索、筛选、分页和操作 | Data Display | Ant Design | 访问于 2026-09-08 | https://ant.design/docs/spec/data-display/ | 官方设计规范 |

## 限制

- 厂商文档说明各自产品能力，不证明某项能力适合所有小型企业。
- 本设计中的模块优先级、状态名称、金额规则和权限取舍属于面向小型团队的综合判断。
- 未对区域性财税、电子签、隐私法规或行业合规进行专门调研；这些需求出现时应单独立项。
