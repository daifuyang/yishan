# CRM 产品规格文档规范化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为全部 CRM 产品文档补齐统一、可实现和可测试的字段与交互规格。

**Architecture:** CRM 总览保存全局交互约定，避免对象文档重复定义；客户、客户公海、联系人和销售对象分别补充字段契约、关键交互、页面状态及 Given-When-Then 验收。维持现有业务模型和目录。

**Tech Stack:** Markdown、Git、PowerShell、ripgrep。

**Spec:** `docs/superpowers/specs/2026-09-10-crm-product-specification-standard.md`

## Global Constraints

- 保留现有业务模型、字段、状态、权限与页面骨架，不以文档重构改变产品范围。
- 所有高风险操作必须写清前置条件、确认、成功反馈、失败恢复与审计。
- 公共交互只在 CRM 总览定义；对象文档只记录特有差异。

---

### Task 1: 建立 CRM 全局交互规范

**Files:**
- Modify: `docs/products/crm/README.md`

- [x] 新增通用交互与反馈章节，覆盖列表、抽屉、表单、空态、错误、冲突、权限与时间线。
- [x] 使用 `rg -n '通用交互|加载|空态|并发|时间线' docs/products/crm/README.md` 验证各类规则均存在。

### Task 2: 补强客户管理交互规格

**Files:**
- Modify: `docs/products/crm/客户管理/客户.md`
- Modify: `docs/products/crm/客户管理/客户公海.md`
- Modify: `docs/products/crm/客户管理/联系人.md`

- [x] 为字段表补充默认/回显、编辑范围、联动校验与错误提示。
- [x] 为列表、抽屉、Tabs、生命周期、公海归属、联系人迁移定义触发、反馈、异常恢复。
- [x] 将验收细化为可观察的权限、校验和冲突场景，并由全局验收口径约束。

### Task 3: 补强销售管理交互规格

**Files:**
- Modify: `docs/products/crm/销售管理/商机.md`
- Modify: `docs/products/crm/销售管理/报价单.md`
- Modify: `docs/products/crm/销售管理/合同.md`
- Modify: `docs/products/crm/销售管理/回款.md`
- Modify: `docs/products/crm/销售管理/拜访.md`
- Modify: `docs/products/crm/销售管理/产品.md`
- Modify: `docs/products/crm/销售管理/工单.md`

- [x] 为各对象增加字段契约、关键状态操作、页面状态与可测试验收。
- [x] 明确金额、关联对象、状态迁移和作废/删除等约束的用户反馈。

### Task 4: 一致性验证与提交

**Files:**
- Verify: `docs/products/crm/**/*.md`

- [x] 使用 `git diff --check` 验证 Markdown 无空白错误。
- [x] 使用 `rg -L '交互细则|关键操作|页面状态' docs/products/crm/**/*.md` 验证对象文档均具备核心规格章节。
- [x] 逐份核对字段契约、交互、页面状态、权限和验收；提交 CRM 文档。
