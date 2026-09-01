# Feature Specification: CRM v1.2 — 交互全量升级

**Feature Branch**: `004-crm-v1.2-ux-overhaul`

**Created**: 2026-09-01

**Status**: Draft

**Input**:
- Yishan CRM v1.0 MVP 已落地（2026-08-31），8 张 `crm_*` 表 / 8 个 Repository / 5 个 Service / 6 个 route plugin / 9 个前端页面
- Yishan CRM v1.1 已落地 spec/plan/tasks（详情页 Tabs / 顶部 QuickFollowBar / UserPicker / 列表 SmartViewTabs）。本 spec **不引用** v1.1 文档，所有相关设计在本 spec 内**完全自包含重写**，方便独立阅读。
- 国内头部 CRM 平台对标：悟空 CRM / 销售易 / XTools / 纷享销客 / Salesforce 国内版（2026-09-01 调研）
- 仓库前端页面规范 `apps/yishan-admin/CLAUDE.md`（PageContainer / ProTable / ProForm / valueEnum / dayjs 时间格式）
- 上轮（2026-09-01）三档现状梳理：P0 仓库规范违例点 / P1 大厂标配能力 / P2 差异化能力。本 spec **收窄为 US1-US7，全部 P0+P1 一并实施**（取消 US8 移动端 / US9 数据看板，挪至 v2.x）

---

## Context & Background

CRM v1.0 后端架构正确（事务 / CAS / 数据范围 / 业务码段 33xxx 全部到位，315 个测试全绿），但前端 UX 与国内头部 CRM 仍有 5 类差距。本 spec 对应消除这 5 类差距：

| 差距类别 | 现状 | 头部 CRM 做法 |
|---|---|---|
| **A. 仓库规范违例** | 详情页 577 行 5 处违反 `CLAUDE.md`（自写 `<table>` / `breadcrumb: {}` / `subTitle` 用 Space / `window.prompt` / 纵向堆叠）；公海页用 `<Button type="link">`；转交/释放 Modal 用 `document.getElementById` | 严格遵守 antd/pro-components 规范 |
| **B. 大厂标配能力** | 列表无批量、无高级筛选、查重只在创建后弹 Modal；工作台数字平铺无行动引导；跟进无富文本无模板；跟进提醒缺失；字典值不在列表显示 | 销售易 / 纷享销客：批量+筛选+查重+富文本跟进+提醒全套 |
| **C. 跟进页空白** | `apps/yishan-admin/src/modules/crm/pages/activities/index.tsx` 仅 51 行（一个空骨架），跟进全部埋在详情页 | 悟空 CRM：独立跟进聚合页，按客户/联系人/方式/时间 filter |
| **D. 设置页只 CRUD** | tags/statuses/sources 三个字典页只 CRUD，无排序、无跟进模板、无客户评分 | 销售易：字典可拖拽排序，进阶字典（评分/模板）独立管理 |
| **E. 工作台只是数据看板** | 6 个数字卡 + 2 个 Timeline，无图表无排行无下钻 | 纷享销客：工作台 = 行动中心 + 图表 + 排行 |

> **本 spec 自包含设计 v1.1 的 4 个 US**：因为本 spec 不引用 v1.1，已落地的 v1.1 US1-Tabs / US2-QuickFollowBar / US3-UserPicker / US4-SmartViewTabs 的设计在本 spec 各 US 内**重述**（标注「v1.1 已落地，本 US 在其上扩展」），保证读者无需打开 v1.1 文档也能读懂。

---

## Goals (本期必达)

- **A. 仓库规范违例全部清零**：详情页 5 处违例、公海 1 处违例、列表 2 处违例，全部按 `CLAUDE.md` 重写
- **B. 7 大页面交互全部对标大厂头部**：详情页 / 列表 / 公海 / 工作台 / 跟进 / 联系人 / 设置，每页至少 1 项可测量的体验改进
- **C. 后端能力补齐支撑前端**：批量操作、查重 GET、字段 join、提醒调度、跟进模板表、评分表全部 schema + API 落地
- **D. 单测与回归覆盖**：每个 US 配套后端 vitest + 前端 Jest，端到端冒烟全过

## Non-Goals (本期不做)

- **v1.3**：24h 撤销认领 / 沉睡客户 cron 回收 / 认领配额 / 移动端 / 客户附件 Tab 复用 sys_attachment（独立 spec）
- **v2.x**：话术库 / 客户画像 / 销售漏斗 BI / 微信小程序 CRM（独立 spec）
- **自定义字段平台 / DSL**：与 CRM 边界守则冲突，明确不做
- **AI 自动写跟进 / AI 客户评分**：依赖后续 LLM 接入，本期不做

---

## Architecture Overview

### 后端新增能力

| 类别 | 新增表 / 端点 | 用途 |
|---|---|---|
| 批量 | `POST /api/crm/v1/customers/batch-transfer`、`POST /api/crm/v1/customers/batch-tag`、`POST /api/crm/v1/pool/batch-claim`、`POST /api/crm/v1/customers/import`、`GET /api/crm/v1/customers/export` | 批量操作 + 导入导出 |
| 查重 | `GET /api/crm/v1/customers/check-duplicate?keyword=&type=` | 实时查重（前端 debounce 调用） |
| 提醒 | 新表 `crm_notification`、`GET /api/crm/v1/notifications/unread-count`、`POST /api/crm/v1/notifications/:id/read`、cron `crm-cron-recall` 每日 03:00 触发 | 跟进提醒（铃铛红点 + 桌面通知） |
| 富文本 | `crm_activity.content` 由 `varchar(2000)` 改 `mediumtext`，新增 `crm_activity.contentHtml mediumtext` | 跟进富文本 TipTap 输出 |
| 跟进模板 | 新表 `crm_follow_up_template`（id / name / contentHtml / type / isSystem / sort / enabled） | 跟进模板预设 |
| 客户评分 | 新表 `crm_customer_score`（customerId / grade / score / updatedAt） + `crm_customer.grade` 计算列 | 销售易 ABCD 评分 |
| 列表 join | `GET /api/crm/v1/customers` 响应新增 `statusName / sourceName / ownerUserName / ownerDepartmentName / tags[]` | 列表字典值映射显示 |

### 前端新增组件

| 组件 | 路径 | 用途 |
|---|---|---|
| `BulkActionBar` | `apps/yishan-admin/src/modules/crm/components/BulkActionBar/` | ProTable 顶部批量操作条 |
| `AdvancedFilterDrawer` | `apps/yishan-admin/src/modules/crm/components/AdvancedFilterDrawer/` | 高级筛选抽屉 |
| `DuplicateChecker` | `apps/yishan-admin/src/modules/crm/components/DuplicateChecker/` | Drawer 内嵌查重实时提示 |
| `FollowTemplatePicker` | `apps/yishan-admin/src/modules/crm/components/FollowTemplatePicker/` | 跟进模板选择器 |
| `ReminderBadge` | `apps/yishan-admin/src/modules/crm/components/ReminderBadge/` | 顶部铃铛 + 红点 |
| `CustomerScoreTag` | `apps/yishan-admin/src/modules/crm/components/CustomerScoreTag/` | 客户评分 A/B/C/D 标签 |
| `RichFollowEditor` | `apps/yishan-admin/src/modules/crm/components/RichFollowEditor/` | TipTap 富文本跟进编辑器 |
| `DragSortableTable` | `apps/yishan-admin/src/modules/crm/components/DragSortableTable/` | 设置页拖拽排序 |

### 设计原则

1. **彻底遵守 `apps/yishan-admin/CLAUDE.md` 页面规范**（P0 全部清零）
2. **遵循 v1.1 已落地的架构决策**：ProForm / UserPicker / SmartViewTabs / Tabs / valueEnum / dayjs 全栈标准
3. **每个 US 都附独立测试**：后端 vitest + 前端 Jest + 至少 1 个 E2E 冒烟
4. **后端枚举必须 closed union**：防止前端拼字符串绕过校验（参考 v1.1 plan §III）

---

## User Scenarios & Testing

### User Story 1 — 客户详情页：仓库规范清零 + Tabs 化 + 富文本跟进条

**作为销售**，我打开客户详情，第一屏默认是"跟进记录" Tab，顶部有一个常驻的富文本快速跟进条，输入 200 字以内用 TipTap 简化条（Ctrl+Enter 提交），超过 200 字自动展开完整跟进表单。我能直接写跟进、看历史、查联系人，不用滚屏。

**为什么 P1：** 详情页是销售日活最高频的页面。当前 577 行详情页有 5 处违反仓库 `CLAUDE.md` 规范（自写 `<table>` / `breadcrumb: {}` / `subTitle` 用 `<Space>` / `window.prompt` / 纵向堆叠），任何 copy-pattern 都会扩散违例。本 US 同时解决规范违例和体验升级。

**独立测试：** 进入 `/crm/customer-detail?id=1`，验证：
1. 顶部面包屑自动生成（不传 `breadcrumb: {}`）
2. `header.subTitle` 不再是 `<Space><Tag>` 结构
3. 默认 Tab 是"跟进记录"，不是"概览"
4. 顶部 `QuickFollowBar` 是 TipTap 富文本编辑器，能加粗、列表、emoji
5. Ctrl+Enter 提交跟进，200 字以下走快路径、超过走完整表单
6. 联系人表格用 antd `<Table>` 不用自写 `<table>`
7. 释放/转交 Modal 用 ProForm 不再 `window.prompt`
8. 跟进内容渲染富文本（不 escape HTML）

**Acceptance Scenarios:**

1. **Given** 销售小张打开 `/crm/customer-detail?id=1`（客户 ABC 科技，已有 5 条跟进）
   **When** 页面加载
   **Then** 顶部显示面包屑 "CRM / 客户管理 / ABC 科技"
   **And** 客户名称下显示客户评分标签 A/B/C/D（如有）
   **And** 默认 Tab 是"跟进记录"，跟进 Timeline 全部展示
   **And** 顶部 QuickFollowBar 可见（公海客户早返 null）
2. **Given** 小张在 QuickFollowBar 输入"已和客户王经理沟通，明确了需求是 XXX"
   **And** 内容 22 字 < 200 阈值
   **And** 小张按 Ctrl+Enter
   **When** 请求完成
   **Then** 新跟进出现在 Timeline 顶部
   **And** "上次跟进"时间更新为 now
   **And** "下次跟进"时间不变（如未设）
   **And** 不弹任何 Modal
3. **Given** 小张输入 220 字内容
   **When** 文字数超过 200 阈值
   **Then** QuickFollowBar 自动展开完整表单（跟进方式 / 联系人 / 下次跟进时间 / 完整富文本编辑器）
   **And** 表单校验通过后，点"提交"完成
4. **Given** 小张是客户 ABC 的负责人
   **When** 小张点"转交"
   **Then** 弹出 ProForm Modal，里面是 UserPicker（v1.1 已落地）
   **And** 不是 `window.prompt` 弹窗
5. **Given** 客户 ABC 处于公海
   **When** 任何销售打开详情
   **Then** QuickFollowBar 不渲染（早返 null）
   **And** 顶部显示"认领"按钮

**覆盖仓库规范违例点（必须清零）：**
- [ ] (P0-1) `header.breadcrumb: {}` 删除
- [ ] (P0-2) `header.subTitle` 改为纯文本或 ProDescriptions，不混 `<Space>`
- [ ] (P0-3) 自写 `<table>` 替换为 antd `<Table>` 或 ProTable
- [ ] (P0-4) `window.prompt('目标用户 ID')` 替换为 UserPicker Modal
- [ ] (P0-5) 4 个堆叠 div 改为 `<Tabs>` 切"基本信息/联系人/跟进记录/流转记录"

---

### User Story 2 — 我的客户列表：批量 + 高级筛选 + 查重实时提示

**作为销售**，我能在我的客户列表里多选客户批量转交 / 批量打标签 / 批量导出 Excel。我能打开"高级筛选"抽屉按"客户状态 + 来源 + 标签 + 创建时间 + 最近跟进时间 + 负责人"组合筛选。我新建客户时输入名称，0.5 秒内抽屉内显示"疑似重复"提示，让我立即知道该不该继续。

**为什么 P1：** 销售每日操作几十上百客户，没有批量 = 灾难。查重只在创建后弹 Modal 太晚——大厂都是在用户输入时就提示。

**独立测试：** 进入 `/crm/customers`，验证：
1. ProTable 顶部出现 `rowSelection` 多选 checkbox
2. 选中 ≥1 行后，顶部出现"已选 N 项"操作条，含"批量转交 / 批量打标签 / 批量删除 / 批量导出"
3. 工具栏多出"高级筛选"按钮，点击弹 Drawer
4. 高级筛选 Drawer 字段：状态 / 来源 / 标签多选 / 创建时间区间 / 最近跟进时间区间 / 负责人
5. 点击"新建客户"，DrawerForm 名称输入框右侧出现"检测中 / 疑似重复：XXX（负责人：XXX），点击查看"提示
6. ProTable 列 `statusId` 显示"待跟进"等中文而不是 `1`
7. `province / city` 字段用 `ProFormRegionCascader`（仓库已有）不是文本框

**Acceptance Scenarios:**

1. **Given** 小张在 `/crm/customers` 看到 50 个客户
   **When** 小张勾选 5 个客户
   **Then** 顶部出现 BulkActionBar："已选 5 项 [批量转交] [批量打标签] [批量删除] [批量导出]"
2. **Given** 小张点"批量转交"
   **When** UserPicker 弹出，小张选"李四"并填原因
   **Then** 5 个客户的 `ownerUserId` 同时更新为李四
   **And** 5 条 `crm_customer_transfer` 日志写入（type='transfer'）
   **And** 列表自动 reload
3. **Given** 小张点"高级筛选"
   **When** Drawer 打开
   **Then** 字段：客户状态（多选）/ 来源（多选）/ 标签（多选）/ 创建时间区间 / 最近跟进时间区间 / 负责人（UserPicker 多选）
   **And** 点"应用筛选"，ProTable 重新请求 URL 参数聚合
4. **Given** 小张点"新建客户"，在名称输入框输入"ABC 科技"
   **And** debounce 500ms 后调用 `GET /api/crm/v1/customers/check-duplicate?keyword=ABC&type=enterprise`
   **Then** 返回命中列表，DrawerForm 内显示"⚠️ 发现 2 个疑似重复：ABC 科技（张经理）、ABC 科技股份（李经理），点击查看"
   **And** 点击行名直接跳转对应客户详情
5. **Given** 列表返回数据
   **Then** `statusId=1` 显示"待跟进"中文，`ownerUserId=2` 显示"张经理"而非 `2`

**API 新增/修改：**
- `POST /api/crm/v1/customers/batch-transfer` body: `{customerIds: number[], toUserId: number, reason?: string}` → `{success: number, failed: [{id, code, message}]}`
- `POST /api/crm/v1/customers/batch-tag` body: `{customerIds: number[], tagIds: number[], mode: 'add'|'remove'|'replace'}`
- `POST /api/crm/v1/customers/import` multipart Excel → 异步任务，返回 taskId
- `GET /api/crm/v1/customers/export` query: 同 list 参数 → Excel 下载
- `GET /api/crm/v1/customers/check-duplicate?keyword=&type=` → `[{id, name, ownerUserName}]`
- `GET /api/crm/v1/customers` 响应 join: `statusName / sourceName / ownerUserName / ownerDepartmentName / tags[{id, name, color}]`

---

### User Story 3 — 公海页：批量认领 + 认领后不跳详情

**作为销售**，我在公海里能看到所有可认领的客户，能多选批量认领（一次领 5-10 个），认领成功后留在公海继续翻页，不强制跳详情。

**为什么 P1：** 销售早晨"捞客户"是高频动作。逐条点认领 + 跳转详情 = 强制中断流。当前公海还有 `<Button type="link">` 违反规范。

**独立测试：** 进入 `/crm/pool`，验证：
1. ProTable 多选 checkbox 启用
2. 选中 ≥1 行后，顶部出现"已选 N 项 [批量认领]"
3. 点"认领"后：
   - 成功：toast "已认领 N 个客户"，行变灰但留在表格
   - 部分失败（被别人抢）：toast "成功 N 个，M 个已被其他销售认领"
4. 单条认领按钮是 `<a>` 链接，不再是 `<Button type="link">`
5. 单条认领成功后 toast "已认领"，**不跳详情页**

**Acceptance Scenarios:**

1. **Given** 小张在 `/crm/pool` 看到 30 个公海客户
   **When** 小张勾选 8 个
   **Then** 顶部出现"已选 8 项 [批量认领]"
2. **Given** 小张点"批量认领"
   **Then** 后端 `POST /api/crm/v1/pool/batch-claim` 处理 8 个
   **And** 6 个成功（pool_status 变 owned，ownerUserId=小张），2 个失败（已被其他销售认领）
   **And** 前端 toast 显示 "已认领 6 个客户，2 个已被其他销售认领"
   **And** 失败行保留在表格（不消失）
3. **Given** 小张单条点"认领"按钮
   **Then** 后端 CAS 成功，toast "已认领"
   **And** **不跳详情页**（v1.0 行为是跳详情，本 US 移除）

**API 新增/修改：**
- `POST /api/crm/v1/pool/batch-claim` body: `{customerIds: number[]}` → `{success: number, failed: [{id, code, message}]}`。每个 claim 用事务包裹，CAS `WHERE pool_status='public'` 防并发。

---

### User Story 4 — 工作台：从数据看板升级为行动中心

**作为销售**，我打开工作台，看到 3 张大行动卡（今日待跟进 N / 待认领公海 N / 本月新增 N），数字本身可点击下钻。下方有 Tab 切换"我的客户 / 本周跟进 / 最近动态"，加上图表三件套（销售漏斗 / 跟进方式分布 / 客户来源占比），加上团队排行榜。

**为什么 P1：** 大厂工作台 = 行动中心。当前 6 个数字平铺没引导，没图表没排行。

**独立测试：** 进入 `/crm/dashboard`，验证：
1. 顶部 3 张行动卡：今日待跟进 / 待认领公海 / 本月新增（数字醒目，颜色按紧急度）
2. 点击"今日待跟进 N" → 跳转 `/crm/customers?view=today`
3. Tab 切"我的客户 / 本周跟进 / 最近动态"，内容加载
4. 图表三件套：
   - 销售漏斗（按客户状态分阶段计数）：用 antd Charts 或 ECharts
   - 跟进方式分布饼图：电话/微信/拜访/会议/邮件/其他
   - 客户来源占比饼图：来源 1/来源 2/...
5. 团队排行榜：本月成交数 Top 5 销售
6. 顶部铃铛（ReminderBadge）显示未读跟进提醒数

**Acceptance Scenarios:**

1. **Given** 小张今天有 3 个客户待跟进
   **When** 小张打开 `/crm/dashboard`
   **Then** "今日待跟进"卡显示红色数字 3
   **And** 鼠标 hover 显示"立即查看"
   **And** 点击跳转 `/crm/customers?view=today`
2. **Given** 小张点"我的客户" Tab
   **Then** 显示前 10 个客户列表 + "查看全部"链接
3. **Given** 小张点"销售漏斗"图
   **Then** 显示按"待跟进 / 初步沟通 / 需求确认 / 方案报价 / 已成交 / 已流失"分阶段的漏斗
4. **Given** 团队本月销售冠军是李四（成交 12 单）
   **Then** 排行榜显示"🥇 李四 12 单"、"🥈 王五 8 单"...

**API 新增/修改：**
- `GET /api/crm/v1/dashboard` 响应扩展：
  - `counters: { myCustomers, pendingFollowUp, todayNew, publicPool, weekFollowUps, monthNew }`（已有）
  - 新增 `funnel: [{statusId, statusName, count}]`
  - 新增 `activityByType: [{type, count}]`
  - 新增 `customerBySource: [{sourceId, sourceName, count}]`
  - 新增 `ranking: [{userId, realName, dealCount}]`（本月成交数 Top 5，仅 super_admin / sales_lead 可见）
- 排行榜权限：仅 `crm:dashboard:view` 且 `super_admin / sales_lead` 可见，普通销售不返回此字段

---

### User Story 5 — 跟进页：从 51 行空白重写为跟进聚合中心

**作为销售**，我能打开独立的"跟进记录"页，按客户 / 联系人 / 跟进方式 / 时间范围 filter，看到所有我参与过的跟进（不只是单客户的）。顶部有 QuickFollowBar 快捷写跟进，跟进内容富文本渲染。

**为什么 P1：** 当前 `activities/index.tsx` 仅 51 行（一个空骨架），跟进全在客户详情页。销售做周报、月报时需要"我这周跟进过哪些客户"的全局视角，详情页解决不了。

**独立测试：** 进入 `/crm/activities`，验证：
1. 顶部 QuickFollowBar（独立模式下不绑 customerId）
   - 实际是"快速记录一次跟进"：选客户 → 选跟进方式 → 写富文本 → 提交
2. 跟进列表按时间倒序展示全部跟进
3. Filter 抽屉：客户（UserPicker-like 客户搜索）/ 联系人 / 跟进方式（多选）/ 时间范围
4. 跟进内容是富文本渲染（不 escape HTML）
5. 跟进 Timeline 显示操作人头像、跟进方式 chip、时间、富文本摘要（>200 字折叠）
6. 点击跟进跳到对应客户详情

**Acceptance Scenarios:**

1. **Given** 小张打开 `/crm/activities`
   **Then** 顶部显示"快速记录跟进"卡片：客户搜索框 / 跟进方式 / 富文本编辑器 / 提交
2. **Given** 小张点"客户搜索框"输入"ABC"
   **Then** 联想出我的客户中名称含 ABC 的（复用 `GET /api/crm/v1/customers?keyword=ABC&scope=mine`）
3. **Given** 小张填好跟进后提交
   **Then** 新跟进追加到列表顶部
   **And** 同时更新对应客户的 `last_follow_up_at`
4. **Given** 小张打开 filter 抽屉
   **Then** 字段：客户（多选，搜索）/ 联系人（多选）/ 跟进方式（多选 chip）/ 时间范围（近 7 天 / 近 30 天 / 本月 / 自定义）
   **And** 应用后列表刷新
5. **Given** 跟进内容含 `<strong>重点</strong>`
   **Then** 渲染时显示加粗的"重点"，不显示 HTML 标签

**API 新增/修改：**
- `GET /api/crm/v1/activities` 新增独立列表 endpoint：query `{customerIds?, contactIds?, types?, occurredFrom?, occurredTo?, page, pageSize}` → 返回 activities 列表（join customerName / contactName / operatorUserName）
- 鉴权：仅返回 `operatorUserId = currentUser.id` 或 `customer.ownerUserId = currentUser.id` 或 super_admin / sales_lead 范围内的活动

---

### User Story 6 — 联系人页：头像显示 + 归属客户跳转 + ContactsTab 升级

**作为销售**，我在联系人列表看到每个联系人的头像（或首字 avatar fallback）、姓名、归属客户名（可点击跳转）。在客户详情页 ContactsTab，联系人表用 antd `<Table>`，支持按"主联系人"过滤、按部门排序。

**为什么 P1：** 联系人是客户沟通的实际对象，重要程度仅次于客户名。当前 `/crm/contacts` 仅 200 行 + 没有任何视觉层次。

**独立测试：** 进入 `/crm/contacts`，验证：
1. 列表每行有 avatar（首字 fallback 颜色按部门 hash）
2. "所属客户"列显示客户名（不是 `#123`），可点击跳转客户详情
3. 增加 filter：客户 / 主联系人 / 部门 / 职位
4. 详情页 ContactsTab 用 antd Table，行操作：编辑 / 删除 / 设为主联系人 / 拨打（mobile）
5. ContactsTab 支持按"主联系人"过滤、按部门排序

**Acceptance Scenarios:**

1. **Given** 小张在 `/crm/contacts`
   **When** 小张输入客户名"ABC"搜索
   **Then** 列表只显示 ABC 客户的联系人
2. **Given** 联系人列表返回数据
   **Then** "所属客户"列显示"ABC 科技有限公司"，点击跳转 `/crm/customer-detail?id=123`
   **And** 头像显示首字"王"（fallback 颜色按部门 hash）
3. **Given** 小张在客户详情 ContactsTab
   **Then** 表格用 antd `<Table>`，支持列排序
   **And** 点"设为主联系人"图标星标，该联系人 `isPrimary=1`

**API 修改：**
- `GET /api/crm/v1/contacts` 响应 join: `customerName, departmentName, ownerUserName`
- `POST /api/crm/v1/contacts/:id/set-primary` 新增 endpoint（v1.0 没有，需新增）

---

### User Story 7 — 设置页：拖拽排序 + 跟进模板 + 客户评分

**作为销售管理员**，我在"客户状态" / "客户来源" / "标签" 设置页能拖拽排序，决定下拉显示顺序。我在"跟进模板"页能预设跟进内容模板（销售在跟进时一键填充）。系统自动按客户跟进频次 / 最近跟进时间 / 成交状态算评分 A/B/C/D。

**为什么 P1：** 大厂都把"字典可排序 + 模板预设 + 客户评分"作为基础 CRM 能力。

**独立测试：** 进入 `/crm/settings/{statuses,sources,tags,templates,scores}`，验证：
1. 三个字典页表格行支持拖拽排序（antd Table + react-sortable-hoc 或 dnd-kit）
2. 排序结果实时持久化（`PATCH /api/crm/v1/settings/{type}/:id` body `{sort: number}` 或批量 `POST /api/crm/v1/settings/{type}/reorder` body `{ids: number[]}`）
3. 跟进模板页：列表 + 新建模板 Drawer（name / type / contentHtml）+ 启用/禁用
4. 客户评分：在客户列表 / 详情页显示 A/B/C/D chip（颜色：绿/蓝/橙/红）

**Acceptance Scenarios:**

1. **Given** 销售管理员在 `/crm/settings/statuses`
   **When** 拖拽"待跟进"到"初步沟通"之后
   **Then** 后端 `POST /api/crm/v1/settings/statuses/reorder` body `{ids: [2,1,3,4,5,6]}`
   **And** 前端列表重排
   **And** 后续 ProFormSelect / valueEnum 显示顺序按新排序
2. **Given** 销售管理员新建跟进模板"首次拜访"
   **Then** DrawerForm 字段：名称 / 跟进方式 / 富文本内容 / 启用
   **And** 保存后出现在模板列表
3. **Given** 销售在详情页写跟进时
   **Then** 跟进方式下拉旁出现"📋 模板"按钮，点击弹出 FollowTemplatePicker
   **And** 选模板后富文本自动填充
4. **Given** 客户 ABC 跟进频次高、最近跟进 ≤ 7 天、有成交记录
   **Then** 客户评分计算为 A
   **And** 详情页和列表显示绿色 A chip

**API 新增：**
- `POST /api/crm/v1/settings/{tags|statuses|sources}/reorder` body `{ids: number[]}` → 批量更新 sort
- `GET / POST / PATCH / DELETE /api/crm/v1/settings/templates` 新增跟进模板 CRUD
- `POST /api/crm/v1/settings/scores/recalculate` body `{customerIds?}` 触发评分重算（cron 每日凌晨自动跑）
- `GET /api/crm/v1/settings/scores/rules` 返回评分规则（A/B/C/D 阈值）

**Schema 新增：**
- `crm_follow_up_template`：id / name / type / contentHtml mediumtext / isSystem / sort / enabled / creatorId / createdAt / updatedAt / deletedAt
- `crm_customer_score`：customerId PK / score int / grade enum('A','B','C','D') / computedAt

**评分规则（v1.2 简化版）：**
- A：最近跟进 ≤ 7 天 且 跟进次数 ≥ 5 且 状态 ∈ {已成交, 方案报价}
- B：最近跟进 ≤ 14 天 且 跟进次数 ≥ 3
- C：最近跟进 ≤ 30 天
- D：最近跟进 > 30 天 或 状态=已流失

---

## 仓库规范违例点（必须全部清零）

按 `apps/yishan-admin/CLAUDE.md` 复核当前 7 个 CRM 页面，本 spec 落地后必须全部满足：

| 违例点 | 当前文件 | 当前代码 | 本 spec 修正位置 |
|---|---|---|---|
| `header.breadcrumb: {}` 显式关面包屑 | `customer-detail/index.tsx:205` | `breadcrumb: {}` | US1 删除 |
| `header.subTitle` 用 `<Space>` | `customer-detail/index.tsx:194-204` | `<Space><Tag>...</Tag></Space>` | US1 改 ProDescriptions |
| 自写 `<table>` | `customer-detail/index.tsx:312-352` | `<table>...</table>` | US1 改 antd Table |
| `window.prompt` 取值 | `customer-detail/index.tsx:125,133,140` | `window.prompt('目标用户 ID')` | US1 改 ProForm Modal + US3 改 UserPicker |
| 纵向堆叠 | `customer-detail/index.tsx` 多处 | 多个 div 堆叠 | US1 改 Tabs |
| `<Button type="link">` 在操作列 | `pool/index.tsx:77` | `<Button type="link">认领</Button>` | US3 改 `<a>` |
| `document.getElementById` 取表单值 | `customers/index.tsx:356,378-379,381` | `(document.getElementById('crm-release-reason') as ...)` | US1 改 ProForm Modal |
| `ProFormDigit` 输入 ID | `customers/index.tsx:294-304,327-338` | 数字 ID 字段用 ProFormDigit | US1 改 ProFormSelect/ProFormTree |
| `province/city` 用 ProFormText | `customers/index.tsx:319-320,568-569` | 文本输入省份城市 | US2 改 ProFormRegionCascader |
| 操作列 `width: 220` 太宽 | `customers/index.tsx:187` | `width: 220` | US2 改 160 + "更多"下拉 |
| 时间用 `toLocaleString()` | 多处 | `new Date(x).toLocaleString()` | US1/4/5 改 `dayjs(x).format('YYYY-MM-DD HH:mm:ss')` |
| 编辑 Drawer 初始值丢字段 | `customers/index.tsx:55` | `setEditing({id, name:'', type:'enterprise'} as CustomerDetail)` | US1 先 getCustomer(id) 再 setEditing |

---

## API 总览（spec 范围）

| Method | Path | 新增/修改 | 用途 |
|---|---|---|---|
| GET | `/api/crm/v1/customers` | 修改（响应 join） | 列表字典值映射 |
| POST | `/api/crm/v1/customers/batch-transfer` | 新增 | 批量转交 |
| POST | `/api/crm/v1/customers/batch-tag` | 新增 | 批量打标签 |
| POST | `/api/crm/v1/customers/import` | 新增 | Excel 导入 |
| GET | `/api/crm/v1/customers/export` | 新增 | Excel 导出 |
| GET | `/api/crm/v1/customers/check-duplicate` | 新增 | 实时查重 |
| POST | `/api/crm/v1/pool/batch-claim` | 新增 | 批量认领 |
| GET | `/api/crm/v1/dashboard` | 修改（响应扩展） | 工作台图表 + 排行榜 |
| GET | `/api/crm/v1/activities` | 新增 | 独立跟进聚合页 |
| GET | `/api/crm/v1/contacts` | 修改（响应 join） | 联系人归属客户名 |
| POST | `/api/crm/v1/contacts/:id/set-primary` | 新增 | 设为主联系人 |
| POST | `/api/crm/v1/settings/tags/reorder` | 新增 | 标签排序 |
| POST | `/api/crm/v1/settings/statuses/reorder` | 新增 | 状态排序 |
| POST | `/api/crm/v1/settings/sources/reorder` | 新增 | 来源排序 |
| CRUD | `/api/crm/v1/settings/templates` | 新增 | 跟进模板 CRUD |
| POST | `/api/crm/v1/settings/scores/recalculate` | 新增 | 评分重算 |
| GET | `/api/crm/v1/settings/scores/rules` | 新增 | 评分规则 |
| GET | `/api/crm/v1/notifications/unread-count` | 新增 | 未读提醒数 |
| POST | `/api/crm/v1/notifications/:id/read` | 新增 | 标记已读 |

---

## Schema 变更

### 新增表

```sql
-- 跟进模板
CREATE TABLE crm_follow_up_template (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(16) NOT NULL DEFAULT 'other',
  content_html MEDIUMTEXT NOT NULL,
  is_system TINYINT NOT NULL DEFAULT 0,
  sort INT NOT NULL DEFAULT 0,
  enabled TINYINT NOT NULL DEFAULT 1,
  creator_id INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  deleted_at DATETIME
);

-- 客户评分
CREATE TABLE crm_customer_score (
  customer_id INT PRIMARY KEY,
  score INT NOT NULL DEFAULT 0,
  grade ENUM('A','B','C','D') NOT NULL DEFAULT 'D',
  computed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(0)
);

-- 通知（跟进提醒 + 系统通知）
CREATE TABLE crm_notification (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,           -- 接收人
  type VARCHAR(32) NOT NULL,     -- follow_up_overdue / follow_up_today / customer_assigned / ...
  title VARCHAR(200) NOT NULL,
  content VARCHAR(1000),
  link VARCHAR(255),              -- 跳转链接
  is_read TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  read_at DATETIME
);
```

### 修改表

```sql
-- crm_activity.content 由 varchar(2000) 改为 MEDIUMTEXT（支持富文本）
ALTER TABLE crm_activity MODIFY COLUMN content MEDIUMTEXT NOT NULL;
ALTER TABLE crm_activity ADD COLUMN content_html MEDIUMTEXT AFTER content;
```

---

## 权限码新增

| code | label | group | 用途 |
|---|---|---|---|
| `crm:customer:batch` | CRM-批量操作 | crm | 批量转移/打标签/删除 |
| `crm:customer:import` | CRM-客户导入 | crm | Excel 导入 |
| `crm:customer:export` | CRM-客户导出 | crm | Excel 导出 |
| `crm:pool:batch-claim` | CRM-批量认领 | crm | 公海批量认领 |
| `crm:activity:view-all` | CRM-查看所有跟进 | crm | 跟进聚合页查看他人跟进（sales_lead / super_admin） |
| `crm:settings:reorder` | CRM-字典排序 | crm | 拖拽排序 |
| `crm:settings:template` | CRM-跟进模板管理 | crm | 模板 CRUD |
| `crm:settings:score` | CRM-评分管理 | crm | 评分重算 + 规则 |
| `crm:notification:view` | CRM-提醒查看 | crm | 铃铛提醒 |

---

## Cron 任务

| 名称 | 时间 | 用途 |
|---|---|---|
| `crm-cron-score-recalc` | 每日 02:00 | 重算所有客户评分 |
| `crm-cron-followup-remind` | 每日 08:30 | 生成今日待跟进通知 + 写入 crm_notification |
| `crm-cron-overdue-remind` | 每日 09:00 | 生成超期未跟进通知（next_follow_up_at < today） |

> v1.3 才做"沉睡客户自动回收"cron（v1.2 不动）

---

## 测试覆盖

### 后端（vitest）

每个新增/修改 endpoint 必须有测试，覆盖：
- 正常路径
- 权限边界（无权限 401 / 403）
- 数据范围（SELF / DEPARTMENT / ALL）
- 边界值（空列表 / 大数据量 / 并发）

### 前端（Jest）

每个新增组件 + 每个 US 至少有 1 个集成测试：
- 组件 render / 交互
- 列表 ProTable request 参数
- DrawerForm onFinish
- 路由跳转

### E2E 冒烟（全栈）

启动 API + Admin 后跑：
1. 详情页默认 Tab 是"跟进记录"
2. QuickFollowBar Ctrl+Enter 提交
3. 公海批量认领
4. 列表批量转交
5. 工作台 3 个数字卡可点击下钻
6. 跟进页 filter 生效

---

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| `crm_activity.content` varchar(2000) → MEDIUMTEXT 迁移 | 数据丢失（理论）| MySQL varchar→text 是 in-place 无损 ALTER；备份 + migration 测试 |
| TipTap 富文本 XSS | 跟进内容包含 `<script>` 执行 | 服务端 sanitize（DOMPurify 或 strip script）；前端 readonly 时也走 sanitize |
| 批量操作性能 | 1000 客户批量更新慢 | 后端分批 100/批；前端进度条；超时 30s |
| 评分规则调整 | 销售对评分有意见 | 评分规则写在 settings 表可调；recalculate 不阻塞主路径 |
| 通知表数据膨胀 | 一年后几百万条 | 90 天前自动归档（v2.x），或加 created_at 分区 |
| 排行榜暴露业绩数据 | 销售抵触 | 仅 super_admin / sales_lead 可见；其他角色不返回 ranking 字段 |
| 后端枚举 closed union | 前端拼字符串绕过 | TypeBox `Type.Union([Literal('xxx'),...])` 严格校验 |

---

## Success Criteria

- 详情页 5 处仓库规范违例点全部清零（grep 验证）
- 公海 1 处违例清零
- 列表 6 处违例清零
- 7 个 US 全部落地 + 全部单测通过
- 全栈 E2E 冒烟全过
- `pnpm --filter yishan-api test` ≥ 350 个测试全绿
- `pnpm --filter yishan-admin test` ≥ 30 个测试全绿
- `pnpm lint` 0 error
- `pnpm build` 通过

---

## Out of Scope (v1.3+ 候选)

- 24h 撤销认领（v1.3）
- 沉睡客户自动回收 cron（v1.3）
- 客户评分细则调整 + 自动评估（v1.3，已在 v1.2 评分基础上）
- 认领配额防囤客（v1.3）
- 客户附件 Tab 复用 sys_attachment（v1.3）
- 微信小程序 CRM（v2.x）
- 数据看板 BI / 销售漏斗 v2（v2.x）
- 话术库 / 模板中心扩展（v2.x）

---

## References

- 仓库页面规范：`apps/yishan-admin/CLAUDE.md`
- v1.0 MVP README：`apps/yishan-api/src/modules/crm/README.md`
- v1.1 spec/plan/tasks：`specs/003-crm-v1.1-optimization/`
- 对标产品：悟空 CRM、销售易、XTools、纷享销客、Salesforce 国内版（2026-09-01 调研）
- TipTap 富文本编辑器：`apps/yishan-components/yishan-tiptap`
- 省市区级联选择器：`<ProFormRegionCascader>`（Yishan Core 已有，复用 `sys_region` 表）
