# Feature Specification: CRM v1.1 — 详情页改造 + 用户选择器 + 列表智能筛选

**Feature Branch**: `003-crm-v1.1-optimization`

**Created**: 2026-08-31

**Status**: Draft → Ready for Clarify

**Input**: 悟空 CRM / 销售易 / XTools 快目标等国内头部 CRM 平台对标分析（2026-08-31 调研）；Yishan CRM 模块 MVP 已落地（v1.0），本 spec 锁定第一批（v1.1）改造以解决销售日常动作的体验崩塌问题。

---

## Context & Background

Yishan CRM MVP（`apps/yishan-api/src/modules/crm/`）已在本地 `127.0.0.1:3000` 完整跑通，包含：
- 8 张 crm_* 表（customer / contact / activity / tag / customer_tag / customer_status / customer_source / customer_transfer）
- 8 个 Repository / 5 个 Service / 1 个 Action（claim/release/transfer）
- 6 个 Route Plugin + 23 个权限码
- 9 个前端页面（dashboard / customers / customer-detail / pool / contacts / activities / settings/{tags,statuses,sources}）
- 29 个 vitest 单测全绿 + 315 个全栈测试通过
- 11 个菜单节点（CRM 一级目录 + 6 子页 + 3 设置）

调研结论：**MVP 后端架构完整且正确（事务 / CAS / 数据范围 / 业务码段都对），但前端 UX 严重落后于行业头部**。销售日常使用 CRM 的两个最高频动作 —— **看客户详情** 和 **写跟进** —— 在当前实现下都被埋在第二屏、需要 3 次点击、还要手动敲用户 ID。悟空 CRM / 销售易 / XTools 在这两个动作上有专门优化，本 spec 锁定其 v1.1 复刻。

---

## Goals (P1)

- **提升销售日活写跟进频次**：从 3 次点击 + Drawer 展开 + 提交 = 4 步操作，降到 1 次点击 + 回车 = 2 步
- **杜绝转错客户**：用 UserPicker 替代 `window.prompt('目标用户 ID')`，销售转交时按名字搜索而不是敲 ID
- **让列表能直接看出"我今天该做什么"**：从只能看"我的所有客户"，到能按"今日待办 / 超期未跟进 / 本周新增"切换视图

## Non-Goals (本期不做)

- v1.2 范围：24h 撤销认领 / 沉睡客户自动回收 cron / 客户评分 A/B/C/D / 认领配额（这些有 schema 改动，单独 spec）
- 客户附件 Tab（v1.3，复用 sys_attachment）
- 数据看板 BI / 销售漏斗（v2.x）
- 移动端详情页（v2.x）
- 话术库 / 模板中心（v2.x）
- 客户画像自动聚合（累计跟进次数、生命周期天数等 v2.x）

---

## User Scenarios & Testing

### User Story 1 — 详情页 Tabs 化 + 跟进 Tab 默认（Priority: P1）

**作为销售**，我打开客户详情后，**第一屏默认就是"跟进记录" Tab**，而不是一堆堆叠的 div。我能直接看到我和这个客户的所有沟通历史，不用滚屏。

**为什么 P1：** "看客户历史"是销售每次与客户沟通前的第一步操作（决定开场白）；当前实现下需要滚一屏才能看到，写跟进按钮也藏在右上角。这个改动把销售从"打开详情 → 滚屏 → 找到写跟进按钮"缩短到"打开详情 → 直接看到历史 → 直接写跟进"。

**独立测试：** 进入任意客户详情页（如 `/crm/customer-detail?id=1`），验证：
1. 默认显示"跟进记录" Tab（不是"概览"）
2. 跟进 Tab 内直接展示该客户的所有活动 Timeline
3. 联系人 / 流转记录 是另外两个独立 Tab，不是堆叠 div
4. Tab 切换流畅，URL 不需要刷新（用 antd Tabs 组件的纯客户端切换）

**Acceptance Scenarios:**

1. **Given** 销售小张打开 `/crm/customer-detail?id=1`（客户 ABC 科技有限公司，已有 3 条跟进）
   **When** 页面加载完成
   **Then** 第一屏直接显示 3 条跟进 Timeline，无须滚动
2. **Given** 销售小张在跟进 Tab 想看流转记录
   **When** 点击 "流转记录" Tab
   **Then** 立即显示流转 Timeline，URL hash 可选地更新为 `#transfers`，不刷新页面
3. **Given** 客户没有任何跟进
   **When** 跟进 Tab 显示 Empty 状态
   **Then** 提示"还没有跟进，去写第一条" + 写跟进 CTA 按钮
4. **Given** 旧版详情页（堆叠 div 布局）已部署
   **When** 切换到新版
   **Then** 三个区块从纵向堆叠变为 Tab 切换，DOM 节点数减少（不需要同时挂载三块内容）

---

### User Story 2 — 顶部常驻"快速跟进条"（Priority: P1）

**作为销售**，我在客户详情页**任何 Tab 下**都能在页面顶部看到一个简短的"快速跟进"输入框。我输入跟进内容按回车就提交，不用去找"写跟进"按钮、不用打开 Drawer。**当内容超过 200 字时**，输入框自动展开成完整 Drawer（带跟进方式 / 下次跟进时间等完整字段）。

**为什么 P1：** 写跟进是销售每天高频操作（每天 5-20 次），每多一次点击 / 每多一次打开 Drawer 都累计成显著的"摩擦成本"。悟空 CRM 的做法是"详情页顶部常驻输入框 + 回车提交"，销售习惯已经形成。这个改动是本 spec 业务收益最高的一项。

**独立测试：** 在客户详情页输入内容并按回车，验证：
1. 提交后立即在跟进 Tab Timeline 顶部看到新条目
2. 不需要切换 Tab、不需要打开 Drawer
3. 超过 200 字时输入框展开成 Drawer，带"跟进方式 / 下次跟进时间"两个额外字段

**Acceptance Scenarios:**

1. **Given** 销售小张在客户 ABC 详情页的"联系人" Tab
   **When** 在顶部快速跟进条输入 "客户对价格敏感，约了周三再聊" 然后按回车
   **Then** 系统以 `type='phone'`、`content='客户对价格敏感，约了周三再聊'`、`occurredAt=now()` 创建一条活动，无需任何其他字段
2. **Given** 销售小张输入了 250 字的详细跟进记录
   **When** 内容超过 200 字阈值
   **Then** 输入框下方出现展开 Drawer 的链接 "展开完整编辑器"，点击后打开 Drawer（含"跟进方式 / 联系人 / 下次跟进时间"字段），textarea 内容已带过来
3. **Given** 销售提交快速跟进成功后
   **When** 系统刷新数据
   **Then** 只刷新"客户信息 + 跟进 Timeline"，不重新拉联系人 / 流转日志（性能优化）
4. **Given** 销售在公海客户详情页
   **When** 看到快速跟进条
   **Then** 快速跟进条**不显示**或**显示但提交时返回 CRM_CUSTOMER_TRANSFER_FORBIDDEN**（公海客户不能写跟进，必须先 claim —— 当前 CustomerService.create 已经在事务里校验）

---

### User Story 3 — UserPicker 替代 window.prompt（Priority: P1）

**作为销售**，我需要转交 / 释放 / 写跟进时选人 / 选联系人。我希望弹一个能**按名字搜索**的下拉选择器（带部门树 + 头像 + 岗位），而不是用 `window.prompt` 让我敲 ID（我根本不知道 ID 是几）。

**为什么 P1：** 转错人是 CRM 系统的**高危错误**，流转日志里写错 ID 之后无法纠正，只能用补偿 transfer。当前 `window.prompt` 让销售凭记忆输 ID 极易输错，悟空 CRM 的标准做法是"选择同事"对话框。

**独立测试：** 触发转交按钮，验证：
1. 弹出 UserPicker 而非 prompt
2. 输入名字关键词（"小张"）能搜出对应用户
3. 选中后自动填 targetUserId，无需手动复制 ID
4. 同样组件复用于：转交 / 释放 / 写跟进时选联系人（已有客户联系人列表）

**Acceptance Scenarios:**

1. **Given** 销售小张在客户 ABC 详情页点击 "转交" 按钮
   **When** 转交 Dialog 打开
   **Then** 弹出"选择同事"控件（UserPicker），不是 window.prompt
2. **Given** 销售在 UserPicker 输入 "李"
   **When** 后端 `/api/crm/v1/internal/users?keyword=李` 返回用户列表
   **Then** 下拉显示所有名字含"李"的用户（"李雷 / 李梅 / ..."），含部门 / 岗位 / 头像（如有）
3. **Given** 销售选中"李雷"（ID=42）
   **When** 点击"确认转交"
   **Then** 系统以 `targetUserId=42` 调用转交接口，流转日志的 `toUserId=42, toUserName='李雷'`（前端展示人名，后端 join 出来的）
4. **Given** 销售在写跟进 Drawer 选联系人
   **When** 打开"联系人"下拉
   **Then** 仅显示**该客户**的联系人（已在 service.listByCustomerId 范围内），不需要跨客户查询
5. **Given** 后端 `/api/crm/v1/internal/users?keyword=` 接口
   **When** 权限不足的销售访问
   **Then** 返回 403（不能跨用户查询所有人的元数据；该接口至少需要 `system:user:list` 权限或新增专用 `crm:user:search`）

---

### User Story 4 — 客户列表加 valueEnum + 待办时间筛选（Priority: P1）

**作为销售**，我打开"我的客户"列表时，希望**下拉筛选项能正常使用**（当前 statusId / sourceId 列定义了但没有 valueEnum，下拉是空的），并且能按"7 天没跟进 / 30 天没跟进"快速过滤出**真正需要我今天处理的客户**。

**为什么 P1：** 列表筛选是销售**每天第一件事** —— 看今天该做什么。当前筛选器是死的，下拉空，销售只能看"所有客户"，找不到"今天待办"。

**独立测试：** 打开 `/crm/customers`，验证：
1. 顶部筛选下拉"客户状态" / "客户来源" / "负责人"都有可选项（不空）
2. 新增"下次跟进时间"区间筛选（今天 / 7 天内 / 30 天内 / 已超期）
3. 新增 4 个"智能视图" Tab：全部 / 今日待办 / 超期客户 / 本周新增
4. 默认进入"全部" Tab，切换其他 Tab 时列表自动重新加载

**Acceptance Scenarios:**

1. **Given** 销售打开 `/crm/customers`
   **When** 顶部筛选面板展开
   **Then** "客户状态"下拉显示 6 个系统预置 status（待跟进 / 初步沟通 / ...），"客户来源"显示 9 个预置 source，"负责人"显示当前用户 + 同部门用户列表
2. **Given** 销售选择"客户状态 = 待跟进"
   **When** 应用筛选
   **Then** 列表只显示 status_id 指向"待跟进"且 owner_user_id = currentUser（或同部门）的客户
3. **Given** 销售点击"今日待办" Tab
   **When** Tab 激活
   **Then** 后端按 `next_follow_up_at >= today AND next_follow_up_at < tomorrow AND pool_status=owned` 过滤（数据范围已在 computeDataScope 里处理）
4. **Given** 销售点击"超期客户" Tab
   **When** Tab 激活
   **Then** 后端按 `next_follow_up_at < today AND pool_status=owned` 过滤，按 next_follow_up_at 升序（最久没跟进的优先）
5. **Given** 切换"全部 / 今日待办 / 超期 / 本周新增" Tab
   **When** Tab 切换
   **Then** URL query string 更新（?view=overdue）以便复制链接 / 刷新回到当前视图

---

## Yishan Constitution 自检

| 原则 | 检查 | 结果 |
| --- | --- | --- |
| I. Contract-First | 新增 `GET /api/crm/v1/internal/users` 必须先在 `schemas/internal.schema.ts` 定义 TypeBox schema，再写 service / route | ✅ 计划阶段加 |
| II. Explicit Boundary Mapping | 列表 query 参数 `view / statusId / sourceId / followUpWithin` 用 lowerCamelCase，service 层映射到 Drizzle 列名（lowerCamelCase property），MySQL 列用 snake_case | ✅ 现状已合规 |
| III. Safe Dynamic Queries | 智能视图 Tab 的过滤条件必须用 closed allowlist（today / overdue / week），不允许前端传任意 SQL；`sortBy` 用 public lowerCamelCase 字段名（`nextFollowUpAt`），不暴露数据库列名 | ✅ 必须 |
| IV. Regression Coverage | UserPicker service、list query 的 4 种 view（all / today / overdue / week）必须有单测 | ✅ 计划阶段加 |
| V. Documentation Executable | Swagger 文档（hideUntagged:true 下，没 schema+tags 的路由被过滤）— 新增的 `internal/users` 路由必须在 swagger 顶层 tag 列表加 `crm-internal` | ✅ 加 |
| VI. Single-Source List Queries | 4 个智能视图的过滤逻辑必须**共用一个 Drizzle query config**，通过条件参数 `apply` 不同的 where / orderBy 子句，不能复制 4 份 list() | ✅ 强制 |
| VII. Release-Time Plugin Composition | CRM 是 `apps/yishan-api/src/modules/crm/` 下的独立模块，菜单在 `config/system-menu.json`、权限在 `schemas/permissions.ts`、测试在 `tests/` —— 都是模块自治 | ✅ 现状合规 |

---

## Open Questions（待 clarify 阶段确认）

1. **快速跟进条的默认跟进类型：** 默认用 `phone`（电话）还是 `wechat`（微信）？悟空 CRM 默认是"最近一次类型"（即上一次写跟进用的方式），本 spec 默认 `phone`，是否需要改成"上次类型"？
2. **UserPicker 是否显示已离职用户：** 默认排除（`sys_user.status != '0'`），但需要给超级管理员一个"含离职"开关？
3. **智能视图 Tab 的"本周"边界：** 周一到周日 vs 周日到周六？中国习惯周一开始。
4. **快速跟进条在 mobile 宽度下的折叠策略：** 桌面端 200 字阈值；mobile 是否降到 100 字就展开 Drawer？
5. **客户列表筛选条件是否保存到 localStorage：** 让销售下次进列表自动恢复筛选；还是每次进都重置？

---

## Test Strategy

| 层级 | 类型 | 覆盖 |
| --- | --- | --- |
| 前端单测 | Jest (apps/yishan-admin 已配置) | CustomerDetail 页 Tabs 默认 / UserPicker 选中回填 / 列表 Tab 切换 query string |
| 后端单测 | Vitest (已有 test/setup.ts + test/mocks/drizzle.ts) | `GET /api/crm/v1/internal/users` keyword / limit / status filter；列表 query 的 4 种 view 参数；快速跟进接口（确认 type 默认 phone + occurredAt 默认 now()） |
| 端到端 | 手动 / Playwright（v1.2 引入） | 详情页 → 写跟进 → 流转日志可见的完整路径 |
| 集成 | fastify.inject | UserPicker 后端 `/api/crm/v1/internal/users` 鉴权：销售无权限返回 403 |

---

## Out of Scope (后续 specs)

- `004-crm-v1.2-optimization.md`：24h 撤销认领 + cron 回收 + 客户评分 + 认领配额（schema 改动）
- `005-crm-attachment-tab.md`：详情页附件 Tab 复用 sys_attachment
- `006-crm-data-bi.md`：销售漏斗 / 客户生命周期 / RFM 看板
- `007-crm-mobile-detail.md`：移动端详情页 BottomSheet
