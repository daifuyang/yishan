# CRM MVP 产品文档实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `docs/products/crm` 更新为面向小型通用 B2B 团队的完整 CRM MVP 产品文档，覆盖获客到回款闭环，并保留表格化页面设计风格。

**Architecture:** 文档以 README 定义产品定位、对象关系和全局规则，再由 12 份模块文档承接对象边界、流程、页面、数据、功能、权限、规则、边界、MVP 和验收。所有页面设计使用 Markdown 表格描述布局、搜索、列表、详情和表单；文档只定义目标产品，不以现有实现为边界。

**Tech Stack:** Markdown、Git。

**Spec:** `docs/superpowers/specs/2026-09-08-crm-mvp-design.md`

## Global Constraints

- 仅修改 `docs/products/crm` 下的 README 和既有 12 份模块 Markdown 文档。
- 不新增业务模块、业务代码、UI、数据库、接口、依赖或导航变更。
- 全部内容使用中文，不使用 emoji、Frontmatter 或无意义占位内容。
- 保留既有统一章节层级；每个模块的一级标题必须与文件名一致。
- 页面设计必须使用 Markdown 表格，明确页面区块、字段名、控件或展示类型、校验、回显和操作规则。
- 枚举由设置维护；业务页面仅展示枚举名称，不展示编码或 ID。
- 线索池和客户公海不使用下次跟进日期或逾期提醒；需要运营时效时使用独立入池时间与池内时长。
- P0 覆盖线索到回款的闭环；工单为 P1，拜访复用活动模型并提供独立查询与统计。

---

### Task 1: 更新 CRM 总览与文档规范

**Files:**
- Modify: `docs/products/crm/README.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-09-08-crm-mvp-design.md` 的第 1、2、3、4、5、6、7 节。
- Produces: 所有模块文档共享的产品定位、对象关系、MVP 范围、全局配置和统一页面规则。

- [ ] **Step 1: 写入产品定位与目标用户**

在“产品定位”和“目标用户”中明确：产品面向尚未使用 CRM 的小型通用 B2B 销售团队；目标是让团队持续获知客户、负责人、下一步和回款距离；角色包括系统管理员、销售主管、销售人员和 P1 售后人员。

- [ ] **Step 2: 写入核心业务闭环与对象关系**

使用文本关系说明“来源枚举 → 线索 → 客户/联系人 → 商机 → 报价单 → 合同 → 回款”，并说明线索池、客户公海、活动、拜访和工单的边界。

- [ ] **Step 3: 写入模块划分、MVP 范围与后续演进**

将线索到回款列为 P0；将评分、自动分配、自动化、审批、电子签、财务同步、工单完整流程列为后续演进；说明拜访是活动类型，工单为 P1。

- [ ] **Step 4: 写入全局产品规则**

在“核心对象关系”补充：负责人和公海归属独立于状态、活动跨对象关联、枚举由设置维护并仅回显名称、金额和回款状态的计算口径、关键变更可审计；在“后续演进”说明权限、配置与审计以及经营口径的深化方向。

- [ ] **Step 5: 校验 README**

Run: `Get-Content -Raw 'docs/products/crm/README.md'`

Expected: 所有既有标题均保留，内容覆盖定位、用户、闭环、模块、对象、MVP 与演进，不含占位词。

### Task 2: 完善市场管理文档

**Files:**
- Modify: `docs/products/crm/市场管理/线索.md`
- Modify: `docs/products/crm/市场管理/线索池.md`

**Interfaces:**
- Consumes: README 的全局规则；设计说明第 3、4、5、6、7 节。
- Produces: 可将潜在客户从录入、归属、跟进、资格判断和转化推进至客户、联系人与可选商机的市场管理说明。

- [ ] **Step 1: 重写线索对象与流程**

定义线索状态“待处理、跟进中、已合格、已无效”，并明确负责人、公海归属和转化事件独立；定义合格后创建或关联客户、联系人，商机可选创建。

- [ ] **Step 2: 将线索页面设计改为完整表格**

为列表、详情和新建/编辑分别提供表格：列表包含关键字、状态、负责人、来源、创建时间等搜索字段及身份、状态、负责人、下一步、来源、创建时间、操作等列；详情包含资料、资格判断、活动时间线、关联对象和转化动作；表单包含字段、类型、必填和校验。

- [ ] **Step 3: 重写线索池规则与页面表格**

明确线索池只展示无负责人的线索；页面不展示下次跟进和逾期；列表及详情使用入池时间、池内时长作为后续运营时效口径；领取与分配后才可维护下一步。

- [ ] **Step 4: 写入市场管理权限、边界与验收**

区分管理员、销售主管、销售人员的数据范围和领取、分配、转化权限；写明重复提示、无负责人无提醒、不可重复转化、无效线索处理与并发领取边界。

- [ ] **Step 5: 校验市场管理文档**

Run: `rg -n '来源 #ID|TODO|待补充|XXX|下次跟进.*线索池|线索池.*逾期' 'docs/products/crm/市场管理'`

Expected: 无匹配；两份文档的页面设计均含 Markdown 表格。

### Task 3: 完善客户管理文档

**Files:**
- Modify: `docs/products/crm/客户管理/客户.md`
- Modify: `docs/products/crm/客户管理/客户公海.md`
- Modify: `docs/products/crm/客户管理/联系人.md`

**Interfaces:**
- Consumes: README 的对象关系、统一页面规范和权限模型；设计说明第 3、4、5、6 节。
- Produces: 以客户为关系主体、以联系人为人员主体、以客户公海为无负责人视图的客户管理说明。

- [ ] **Step 1: 重写客户与客户公海的对象边界**

明确客户表示合作主体而非交易阶段；客户状态为“正常、停用”；客户公海是负责人为空的客户视图；客户池内时效使用入池时间和池内时长，不使用下次跟进日期。

- [ ] **Step 2: 写入客户页面表格**

为客户列表定义关键字、状态、负责人、级别、行业、来源、创建时间搜索；定义客户名称、级别、行业、负责人、关联商机、最近活动、创建时间和操作列；为详情定义基本资料、联系人、商机、报价、合同、回款与活动时间线布局。

- [ ] **Step 3: 写入联系人页面表格**

定义联系人列表、详情和表单，包含姓名、客户、部门、职位、决策角色、手机、电话、邮箱、微信、负责人和创建时间；明确一个联系人必须归属客户，决策角色为设置维护的枚举。

- [ ] **Step 4: 写入权限、重复提示、边界和验收**

定义按客户负责人和部门的数据范围，联系人继承客户可见性；定义公司名称、手机、电话、邮箱的重复提示；定义停用客户、已关联商机/合同、客户退回公海和联系人归属变更边界。

- [ ] **Step 5: 校验客户管理文档**

Run: `Get-ChildItem 'docs/products/crm/客户管理' -File -Filter '*.md' | ForEach-Object { Select-String -Path $_.FullName -Pattern '^\|.*\|$' }`

Expected: 三份文档均包含页面设计表格，一级标题分别为客户、客户公海和联系人。

### Task 4: 完善商机、产品与报价单文档

**Files:**
- Modify: `docs/products/crm/销售管理/商机.md`
- Modify: `docs/products/crm/销售管理/产品.md`
- Modify: `docs/products/crm/销售管理/报价单.md`

**Interfaces:**
- Consumes: 客户、联系人、活动与枚举规则；设计说明第 3、4、5、7 节。
- Produces: 以商机为销售预测对象、以产品目录和报价版本支持商业报价的销售前段说明。

- [ ] **Step 1: 写入商机模型、阶段与页面表格**

定义商机必须关联客户，可选关联联系人；字段包括名称、负责人、管道、阶段、预计金额、阶段概率、预测金额、预计成交日、下一步和丢单原因；默认阶段为需求确认、方案沟通、商务谈判、成交；赢单和丢单为结果；列表同时定义表格视图和管道看板视图。

- [ ] **Step 2: 写入产品目录模型与页面表格**

定义产品名称、编码、分类、单位、标准价、税率、启停用和说明；明确产品目录不管理库存或成本；列表与表单均以产品分类、单位和状态的设置枚举为基础。

- [ ] **Step 3: 写入报价单模型、金额和页面表格**

定义报价单关联商机和客户，包含报价编号、版本、产品明细、数量、单价、折扣、税率、金额、有效期、状态和负责人；定义明细自动汇总、同一商机只有一个有效报价、草稿/已发送/已接受/已拒绝/已作废的规则。

- [ ] **Step 4: 写入三模块权限、边界和验收**

明确商机无下一步的提醒、丢单原因必填、产品停用后不可用于新报价但历史可见、报价接受和作废的互斥、报价版本不覆盖历史的边界。

- [ ] **Step 5: 校验销售前段文档**

Run: `rg -n '预测金额|产品明细|有效报价|管道看板' 'docs/products/crm/销售管理/商机.md' 'docs/products/crm/销售管理/产品.md' 'docs/products/crm/销售管理/报价单.md'`

Expected: 四个关键经营概念均在对应文档中出现，且每份页面设计有表格。

### Task 5: 完善合同、回款、拜访与工单文档

**Files:**
- Modify: `docs/products/crm/销售管理/合同.md`
- Modify: `docs/products/crm/销售管理/回款.md`
- Modify: `docs/products/crm/销售管理/拜访.md`
- Modify: `docs/products/crm/销售管理/工单.md`

**Interfaces:**
- Consumes: 商机、报价、客户、联系人和活动规则；设计说明第 3、4、5、7 节。
- Produces: 合同到回款的经营事实、拜访的活动化表达和工单 P1 边界说明。

- [ ] **Step 1: 写入合同模型与页面表格**

定义合同关联客户和商机，可从已接受报价带入；字段包括合同编号、名称、金额、签约日期、生效日期、到期日期、状态、负责人和附件；状态为草稿、待签约、履约中、已完成、已作废；合同金额在确认后独立于报价。

- [ ] **Step 2: 写入回款计划、实际回款与页面表格**

定义合同下的回款计划和实际回款记录；计划字段包含期次、计划日期、计划金额、已核销金额和计算状态；实际回款字段包含到账日期、金额、方式、核销计划项和备注；计划合计不超过合同金额，状态不可人工编辑。

- [ ] **Step 3: 写入拜访活动化模型与页面表格**

定义拜访是活动类型，不重复创建独立销售主对象；字段包含关联对象、拜访主题、计划时间、实际时间、参与人、纪要、结果、下一步和附件；页面提供我的拜访、团队拜访和按客户/商机筛选的独立列表。

- [ ] **Step 4: 写入工单 P1 边界与页面表格**

定义工单关联客户和可选合同，状态为待受理、处理中、待确认、已关闭；P0 只保留对象边界、字段和页面设计，P1 才实现受理、分派、处理、确认、关闭及 SLA。

- [ ] **Step 5: 校验销售后段文档**

Run: `rg -n '计划金额合计不得超过合同金额|实际回款|活动类型|P1' 'docs/products/crm/销售管理/合同.md' 'docs/products/crm/销售管理/回款.md' 'docs/products/crm/销售管理/拜访.md' 'docs/products/crm/销售管理/工单.md'`

Expected: 合同、回款、拜访和工单的对象边界、金额规则和 P0/P1 取舍均可检索。

### Task 6: 全量文档一致性校验与提交

**Files:**
- Modify: `docs/products/crm/README.md`
- Modify: `docs/products/crm/市场管理/线索.md`
- Modify: `docs/products/crm/市场管理/线索池.md`
- Modify: `docs/products/crm/客户管理/客户.md`
- Modify: `docs/products/crm/客户管理/客户公海.md`
- Modify: `docs/products/crm/客户管理/联系人.md`
- Modify: `docs/products/crm/销售管理/商机.md`
- Modify: `docs/products/crm/销售管理/报价单.md`
- Modify: `docs/products/crm/销售管理/合同.md`
- Modify: `docs/products/crm/销售管理/回款.md`
- Modify: `docs/products/crm/销售管理/产品.md`
- Modify: `docs/products/crm/销售管理/拜访.md`
- Modify: `docs/products/crm/销售管理/工单.md`

**Interfaces:**
- Consumes: 全部已完成模块文档和设计说明。
- Produces: 一套标题统一、术语一致、范围清晰、无占位内容的 CRM MVP 文档集。

- [ ] **Step 1: 校验目录、文件和一级标题**

Run: `Get-ChildItem 'docs/products/crm' -Recurse -File -Filter '*.md' | ForEach-Object { $first = Get-Content $_.FullName -TotalCount 1; "$($_.FullName): $first" }`

Expected: README 和 12 份模块文件均存在；模块文件一级标题等于文件名。

- [ ] **Step 2: 校验统一章节和页面表格**

Run: `Get-ChildItem 'docs/products/crm' -Recurse -File -Filter '*.md' | Where-Object { $_.Name -ne 'README.md' } | ForEach-Object { $hasPage = Select-String -Path $_.FullName -Pattern '^## 3\. 页面设计$' -Quiet; $hasTable = Select-String -Path $_.FullName -Pattern '^\|.*\|$' -Quiet; "$($_.Name): 页面=$hasPage 表格=$hasTable" }`

Expected: 每份模块文档输出“页面=True 表格=True”。

- [ ] **Step 3: 校验禁用内容与术语冲突**

Run: `rg -n 'TODO|待补充|XXX|示例内容|来源 #ID|线索池.*下次跟进|客户公海.*下次跟进' docs/products/crm`

Expected: 无匹配。

- [ ] **Step 4: 校验 Markdown 和变更范围**

Run: `git diff --check; git status --short -- docs/products/crm`

Expected: 无空白错误；变更仅位于 CRM 产品文档路径。

- [ ] **Step 5: 提交产品文档**

Run: `git add -- docs/products/crm; git commit -m "docs: complete CRM MVP product design"`

Expected: 仅 CRM 产品文档被提交，提交说明清晰。
