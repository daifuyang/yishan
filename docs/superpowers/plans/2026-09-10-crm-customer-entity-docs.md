# CRM 客户实体文档重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 CRM 文档从“线索转客户”重构为以客户为唯一业务主体的生命周期与交易闭环，同时保留并完善客户详情的既有交互与关联 Tabs。

**Architecture:** 删除独立线索与线索池文档，将其可复用字段和资格判断收敛到客户生命周期。客户公海继续是负责人为空的客户视图；商机、报价、合同与回款保留既有客户归属链路。通过全量文本检索验证不存在已删除对象的入口或关联关系。

**Tech Stack:** Markdown 产品文档、Git、PowerShell、ripgrep。

**Spec:** `docs/superpowers/specs/2026-09-10-crm-customer-entity-design.md`

## Global Constraints

- 客户是唯一前台业务主体，禁止保留独立线索对象、线索池菜单或“线索转化”前置关系。
- `status` 仅表示正常或停用；`lifecycleStatus` 表示待处理、跟进中、已合格或已无效；公海仅表示归属。
- 保留客户列表、双栏详情抽屉、窄屏单栏，以及联系人、商机、报价、合同、回款五个 Tabs。
- 保留现有成熟字段、交易金额规则、权限和审计规则，合并重复描述而非简单覆盖。

---

### Task 1: 更新 CRM 总览与目录

**Files:**
- Modify: `docs/products/crm/README.md`
- Delete: `docs/products/crm/市场管理/线索.md`
- Delete: `docs/products/crm/市场管理/线索池.md`

**Interfaces:**
- Consumes: 已批准设计中的目标对象关系和目录范围。
- Produces: 不含市场管理、线索、线索池或转化链路的 CRM 总览。

- [x] **Step 1: 重写产品定位、用户、核心闭环、模块划分和对象关系**

将闭环写为“客户实体 → 生命周期 → 商机/报价/合同/回款”，并将活动关联限制为存续对象。

- [x] **Step 2: 删除独立线索和线索池文档**

删除两个文档并在删除后检查市场管理目录为空。

- [x] **Step 3: 验证目录与总览引用**

Run: `rg -n '线索|线索池|转化' docs/products/crm/README.md docs/products/crm/市场管理`

Expected: 命令不返回匹配；市场管理目录不存在。

### Task 2: 重写客户与客户公海文档

**Files:**
- Modify: `docs/products/crm/客户管理/客户.md`
- Modify: `docs/products/crm/客户管理/客户公海.md`

**Interfaces:**
- Consumes: 客户生命周期字段、客户归属规则、现有客户详情交互约束。
- Produces: 完整的客户实体、生命周期、公海、字段、页面、流程与权限规范。

- [x] **Step 1: 在客户文档中承接旧线索字段和生命周期规则**

补充 `lifecycleStatus`、意向说明、资格证据、无效原因和下一步；保留客户状态、负责人、公海和审计字段，并明确生命周期变更动作与禁用条件。

- [x] **Step 2: 完善客户详情的 Tabs 与时间线**

保留联系人、商机、报价、合同、回款五个 Tabs、数量与新建入口；明确每个 Tab 的内容、只读/可创建条件，以及生命周期与归属变更在右侧时间线的展示。

- [x] **Step 3: 将客户公海收敛为同一客户实体的归属视图**

增加生命周期筛选和展示；保留只读 Tabs；明确领取或分配后解锁跟进、生命周期变更和关联对象创建，且公海不展示下一步或逾期。

- [x] **Step 4: 验证字段、页面、流程与权限覆盖**

Run: `rg -n 'lifecycleStatus|联系人、商机、报价、合同、回款|资格证据|无效原因|领取|分配|退回' docs/products/crm/客户管理`

Expected: 两份文档均覆盖对应字段和行为；客户文档包含全部五个 Tabs。

### Task 3: 同步关联对象文档

**Files:**
- Modify: `docs/products/crm/客户管理/联系人.md`
- Modify: `docs/products/crm/销售管理/商机.md`
- Modify: `docs/products/crm/销售管理/拜访.md`

**Interfaces:**
- Consumes: 客户实体作为唯一主体、生命周期准入规则。
- Produces: 联系人、商机、拜访只关联存续客户及其下对象的文档约束。

- [x] **Step 1: 移除联系人中的线索转化前提**

联系人仅从客户详情或联系人列表创建，始终归属一个客户。

- [x] **Step 2: 更新商机创建与准入规则**

商机只能从客户或商机列表创建；客户必须正常、可见且生命周期非已无效；保留阶段、金额、预测、报价、合同、回款和权限规则。

- [x] **Step 3: 更新拜访关联对象**

拜访和活动时间线仅关联客户、联系人、商机、报价或合同；删除线索关联和所有线索状态表述。

- [x] **Step 4: 验证无残留对象引用**

Run: `rg -n '线索|线索池|转化' docs/products/crm`

Expected: 命令不返回匹配。

### Task 4: 最终文档一致性核验

**Files:**
- Verify: `docs/products/crm/README.md`
- Verify: `docs/products/crm/客户管理/客户.md`
- Verify: `docs/products/crm/客户管理/客户公海.md`
- Verify: `docs/products/crm/客户管理/联系人.md`
- Verify: `docs/products/crm/销售管理/商机.md`
- Verify: `docs/products/crm/销售管理/拜访.md`

**Interfaces:**
- Consumes: Tasks 1–3 的文档变更。
- Produces: 与设计一致、无 Markdown 结构错误和无过时引用的 CRM 文档集。

- [x] **Step 1: 检查 Markdown 文件集合和已删除目录**

Run: `Get-ChildItem -Recurse -File docs/products/crm | Select-Object -ExpandProperty FullName`

Expected: 不包含市场管理、线索或线索池文件。

- [x] **Step 2: 检查 Markdown 格式与目标词汇**

Run: `git diff --check; rg -n '线索|线索池|转化' docs/products/crm`

Expected: `git diff --check` 退出码为 0；检索无匹配。

- [x] **Step 3: 对照设计进行人工验收**

逐项确认客户实体、生命周期、公海、五个 Tabs、商机归属、活动关联、权限与审计规则均已写入相应文档。

- [x] **Step 4: 提交文档改造**

Run: `git add docs/products/crm && git commit -m "docs: center CRM on customer entity"`

Expected: 提交仅包含 CRM 产品文档改造。
