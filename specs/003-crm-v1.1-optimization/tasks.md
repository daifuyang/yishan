# Tasks: CRM v1.1 — 详情页改造 + 用户选择器 + 列表智能筛选

**Input**: Design documents in `/specs/003-crm-v1.1-optimization/`
- spec.md (User Stories US1 / US2 / US3 / US4)
- plan.md (Architecture + 5 Phases)

**Prerequisites**: plan.md ✅, spec.md ✅

**Tests**: 包含。每个 user story 拆出对应的测试任务（必须覆盖 US3 UserPicker 鉴权 / US4 view 行为）。

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无依赖）
- **[Story]**: 所属 user story (US1 / US2 / US3 / US4)
- **路径**: 写绝对路径，便于直接执行

---

## Path Conventions

- 后端：`apps/yishan-api/src/modules/crm/{schemas,services,repositories,routes/v1,tests}/`
- 前端：`apps/yishan-admin/src/modules/crm/{pages,components,pages/customer-detail/components}/`
- 后端 schema 集中文件：`apps/yishan-api/src/modules/crm/schemas/permissions.ts`（不要新增 registerPermissions 调用）

---

## Phase 1 — 后端基础（US3 + 后续）

### 后端 schema + service（先做，依赖倒置）

- [ ] T001 [P] [US3] 新增 `apps/yishan-api/src/modules/crm/schemas/internal.schema.ts`，定义 `UserSearchQuerySchema`（`keyword?: string, limit?: integer 1-50 default 20`）+ `UserSearchItemSchema`（`id, username?, realName?, deptIds: [{deptId, deptName}]`），导出 `Static` 类型
- [ ] T002 [P] [US3] 在 `apps/yishan-api/src/modules/crm/schemas/permissions.ts` 加 `USER_SEARCH: { code: 'crm:user:search', label: 'CRM-用户搜索', group: 'crm' }`，**不**再调用 registerPermissions（已经在文件末尾统一调用）
- [ ] T003 [US3] 新增 `apps/yishan-api/src/modules/crm/services/user-search.service.ts`，导出 `UserSearchService` 类，构造函数 `constructor(private readonly deps: { db?: AppQueryDb } = {})`，方法 `async search({keyword, limit})`：用 `eq(sysUser.status, '1')` 排除离职 + `or(like(username, %k%), like(realName, %k%))` 模糊查（Constitution §III 不拼 SQL），然后**一次性**用 `inArray(sysUserDept.userId, userIds)` 查部门 join `sysDept`，组装 `deptIds: [{deptId, deptName}]`
- [ ] T004 [US3] 新增 `apps/yishan-api/src/modules/crm/routes/v1/internal/users/index.ts`，路径 `/users`（plugin 根 → `/api/crm/v1/internal/users`），`access: { permission: PERMS.USER_SEARCH }`，`schema: { tags: ['crm-internal'], querystring: UserSearchQuerySchema, response: { 200: EnvelopeSchema(Type.Array(UserSearchItemSchema)) } }`，handler: `return ResponseUtil.success(reply, await new UserSearchService().search(request.query))`
- [ ] T005 [P] [US3] 在 `apps/yishan-api/src/core/plugins/external/swagger.ts` 的 tags 数组加 `{ name: 'crm-internal', description: 'CRM 内部接口（前端组件用）' }`
- [ ] T006 [US3] 新增 `apps/yishan-api/src/modules/crm/tests/internal-users.test.ts`：(a) 关键字 "李" 返回 real_name/username 命中的用户；(b) `limit=5` 限制返回 ≤ 5 条；(c) `status='0'` 离职用户被过滤；(d) 无权限调用 → BusinessError 401（继承自 fastify requirePermission）；(e) deptIds 字段包含 dept_name（join 正确）

---

## Phase 2 — 后端列表 view（US4）

### 后端 schema 扩展 + Repository view 实现

- [ ] T007 [P] [US4] 在 `apps/yishan-api/src/modules/crm/schemas/customer.schema.ts` 增 `ViewTypeSchema = Type.Union([Literal('all'), Literal('today'), Literal('overdue'), Literal('week')])`，导出 `ViewType` 类型；扩展 `CustomerListQuerySchema` 加 `view?: ViewTypeSchema, followUpWithin?: Type.Union([Literal('today'), Literal('7d'), Literal('30d'), Literal('overdue')])`
- [ ] T008 [US4] 在 `apps/yishan-api/src/modules/crm/repositories/customer.repository.ts`：(a) `CustomerListQuery` interface 加 `view?: 'all'|'today'|'overdue'|'week'` + `followUpWithin?: 'today'|'7d'|'30d'|'overdue'`；(b) `buildListWhere(opts)` 内追加 view / followUpWithin 条件分支（不复制 4 份 query，遵循 Constitution §VI）：`view='today'` 加 `and(gte(nextFollowUpAt, startOfToday), lt(nextFollowUpAt, endOfToday))`；`view='overdue'` 加 `and(lt(nextFollowUpAt, startOfToday), isNotNull(nextFollowUpAt))`；`view='week'` 加 `gte(createdAt, weekAgo)`；(c) 新增 `buildListOrderBy(opts)` 函数：`view='overdue'` 升序（最久未跟进优先），其他用默认 `desc(updatedAt)`；(d) `CustomerRepository.list` 调用 `buildListOrderBy` 替换硬编码 `desc(updatedAt)`
- [ ] T009 [US4] 在 `apps/yishan-api/src/modules/crm/services/customer.service.ts` 的 `list({query, currentUser})` 把 query 透传给 `CustomerRepository.list`（已经是 `merged: CustomerListQuery`，无需改；只验证 query.view 默认是 'all'）
- [ ] T010 [US4] 在 `apps/yishan-api/src/modules/crm/routes/v1/customers/index.ts` 路由 `GET /` 的 schema `querystring: CustomerListQuerySchema` 已生效；无需改代码
- [ ] T011 [US4] 新增 `apps/yishan-api/src/modules/crm/tests/customer-list-views.test.ts`：(a) `view='all'` 默认行为（与无 view 一致）；(b) `view='today'` 只返回 `next_follow_up_at` 在今天范围内的；(c) `view='overdue'` 只返回 `next_follow_up_at < today AND next_follow_up_at IS NOT NULL`，按升序；(d) `view='week'` 只返回 `created_at >= weekAgo`；(e) `followUpWithin='7d'` 与 `view='overdue'` 互斥时的优先级（followUpWithin 优先）；(f) 数据范围（SELF/DEPARTMENT/ALL）与 view 的组合过滤正确

---

## Phase 3 — 前端 UserPicker + 转交/释放改造（US3）

### 前端 services + UserPicker 组件

- [ ] T012 [P] [US3] 在 `apps/yishan-admin/src/services/crm.ts` 加 `searchUsers(keyword?: string, limit?: number)` 函数：`return request<ApiResp<UserSearchItem[]>>('/api/crm/v1/internal/users', { method: 'GET', params: { keyword, limit } })`，导出 `UserSearchItem` interface
- [ ] T013 [US3] 新增 `apps/yishan-admin/src/modules/crm/components/UserPicker/useUserSearch.ts`：用 `useState + useEffect + setTimeout`（debounce 300ms）调用 `searchUsers(keyword)`，返回 `{ users, loading, error }`
- [ ] T014 [US3] 新增 `apps/yishan-admin/src/modules/crm/components/UserPicker/UserPickerOption.tsx`：渲染 Avatar + realName + 部门名（占位组件，供 Select 的 `optionRender` 使用）
- [ ] T015 [US3] 新增 `apps/yishan-admin/src/modules/crm/components/UserPicker/index.tsx`：导出 `UserPicker` 组件（`Select showSearch filterOption={false} options={users.map(...)} loading={loading}`），props: `value?, onChange(userId, user), placeholder?, disabled?, scope?: 'all'|'department'|'self'`
- [ ] T016 [US3] 修改 `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx`：(a) 移除 `transferOpen` state 里的 `<input type="number" placeholder="目标用户 ID">`；(b) 改用 `<UserPicker>` 组件，onChange 设 `transferTarget`；(c) onOk 不再 `getElementById`，直接拿 state；(d) 删除 `window.prompt` 的 hint
- [ ] T017 [P] [US3] 修改 `apps/yishan-admin/src/modules/crm/pages/customer-detail/index.tsx` 的 `handleTransfer` / `handleRelease`：(a) `handleTransfer` 删 `window.prompt`，改用 UserPicker Modal；(b) `handleRelease` 保留 `window.prompt`（reason 是文本，不需要 picker）
- [ ] T018 [US3] 新增 Admin Jest `apps/yishan-admin/src/modules/crm/components/UserPicker/__tests__/UserPicker.test.tsx`：(a) 输入 "李" 调用 searchUsers 一次（debounce 后）；(b) 点击 option → onChange 被调；(c) disabled 时不打开 dropdown

---

## Phase 4 — 前端详情页 Tabs + 快速跟进条（US1 + US2）

### 前端组件拆分 + Tabs 布局

- [ ] T019 [P] [US1] 新增 `apps/yishan-admin/src/modules/crm/pages/customer-detail/components/OverviewTab.tsx`：把当前 `customer-detail/index.tsx` 里"右侧客户信息摘要" + "左侧最近跟进时间线"的"上 10 条"提取出来（仅显示前 10 条完整 + "查看全部"链接到 ActivitiesTab）
- [ ] T020 [P] [US1] 新增 `apps/yishan-admin/src/modules/crm/pages/customer-detail/components/ActivitiesTab.tsx`：纯 Timeline，展示全部 activities（不再 slice(0, 10)）
- [ ] T021 [P] [US1] 新增 `apps/yishan-admin/src/modules/crm/pages/customer-detail/components/ContactsTab.tsx`：把联系人表格从 `<table>` 升级到 `<Table>`（保留现有编辑 / 删除交互）
- [ ] T022 [P] [US1] 新增 `apps/yishan-admin/src/modules/crm/pages/customer-detail/components/TransfersTab.tsx`：把流转 Timeline 独立
- [ ] T023 [US1] 重写 `apps/yishan-admin/src/modules/crm/pages/customer-detail/index.tsx`：用 `<Tabs defaultActiveKey="activities">` 包含上述 4 个子组件；Header 保留 + extra 按钮保留；移除三个堆叠 div
- [ ] T024 [P] [US2] 新增 `apps/yishan-admin/src/modules/crm/pages/customer-detail/components/QuickFollowBar.tsx`（详见 plan §Component Design）：(a) `<Input.TextArea>` 200 字阈值；(b) Ctrl+Enter 提交（防 IME 用 `e.nativeEvent.isComposing`）；(c) 200 字以上展开 `<FullFollowForm>`（含 type / nextFollowUpAt 字段）；(d) `poolStatus === 'public'` 时**不渲染**（早返 null）
- [ ] T025 [P] [US2] 在 `apps/yishan-admin/src/services/crm.ts` 加 `quickFollow(customerId, {type, content, nextFollowUpAt?})` 函数，调 `POST /api/crm/v1/customers/:customerId/activities`
- [ ] T026 [US2] 在 `apps/yishan-admin/src/modules/crm/pages/customer-detail/index.tsx` 顶部挂载 `<QuickFollowBar customerId={id} poolStatus={customer.poolStatus} onSubmitted={(activity) => setActivities([activity, ...activities])} />`
- [ ] T027 [P] [US2] 优化 `load()` 函数：写跟进成功后只重拉 `getCustomer(id)` + 不重拉（依赖 onSubmitted 的乐观更新）；初次进入才完整拉全部 4 个
- [ ] T028 [US1+US2] Admin Jest `apps/yishan-admin/src/modules/crm/pages/customer-detail/__tests__/CustomerDetail.test.tsx`：(a) 默认 Tab 是 'activities'；(b) QuickFollowBar 在公海客户**不渲染**（getByTestId 找不到）；(c) Ctrl+Enter 触发提交且调用 quickFollow；(d) 200 字以上展开 FullFollowForm

---

## Phase 5 — 前端列表 SmartViewTabs（US4 前端部分）

### 前端列表组件

- [ ] T029 [P] [US4] 新增 `apps/yishan-admin/src/modules/crm/pages/customers/components/SmartViewTabs.tsx`：导出 `SmartViewTabs` 组件（4 个 Tab：全部 / 今日待办 / 超期 / 本周新增），props: `value: ViewType, onChange: (v) => void`，使用 antd `Tabs`
- [ ] T030 [US4] 在 `apps/yishan-admin/src/services/crm.ts` 的 `listCustomers` 函数签名加 `view?: ViewType` 参数，透传给 `params: { view }`
- [ ] T031 [US4] 修改 `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx`：(a) 加 `view` state，默认从 URL `?view=` 读取；(b) `<SmartViewTabs value={view} onChange={(v) => { setView(v); history.replace({ search: '?view=' + v }) }} />`；(c) ProTable request 函数加 `view: view` 参数；(d) 删除"操作"列里的"释放 / 转交"按钮里多余的 prompt（已经在 Phase 3 改完）
- [ ] T032 [US4] 在 `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx` 的 ProTable columns 加 valueEnum：`statusId` 用 `useState + useEffect` 在组件 mount 时拉 `/api/crm/v1/settings/statuses`，`sourceId` 同理；`ownerUserId` 拉 `/api/crm/v1/internal/users`（**复用 US3 的 endpoint**）；把这些 options 缓存在顶层 state 跨 Tab 切换时复用
- [ ] T033 [US4] Admin Jest `apps/yishan-admin/src/modules/crm/pages/customers/__tests__/CustomersList.test.tsx`：(a) Tab 切换 → URL 更新；(b) 切换 view → request 带 view 参数；(c) settings 数据加载后 statusId 下拉有 options

---

## Phase 6 — 端到端 + 文档

- [ ] T034 [P] [所有] 启动后端（:3000）+ 前端（:8000）做完整路径测试：(a) 详情页默认 Tab；(b) QuickFollowBar Ctrl+Enter；(c) 公海客户详情 QuickFollowBar 不渲染；(d) 转交用 UserPicker；(e) 列表 4 个 view 切换；(f) settings 缓存后下拉有选项
- [ ] T035 [P] [所有] 验证 Swagger UI（`http://127.0.0.1:3000/api/docs`）显示：(a) `crm-internal` tag 下有 `GET /users`；(b) `crm` tag 下 `GET /customers` 有 view 参数
- [ ] T036 [P] [US1+US2+US3+US4] 跑全栈回归：`cd apps/yishan-api && pnpm test && cd ../yishan-admin && pnpm tsc --noEmit`，确认 315+ 测试全绿 + 0 TS error
- [ ] T037 [所有] 更新 `apps/yishan-api/src/modules/crm/README.md` 的"v1.1 changelog"段落（3 个 user story 总结）

---

## Dependencies & Parallelization

```
Phase 1 (T001-T006) ─┐
                     ├─→ Phase 2 (T007-T011) ─→ Phase 5 后端 (T011)  ─┐
                     │                                                    │
Phase 3 后端无 ────────┘                                                    │
                                                                        ↓
                                                          Phase 4 (T019-T028) + Phase 5 前端 (T029-T033) ─→ Phase 6
```

**关键并行点：**
- Phase 1 的 T001 / T002 / T005（schema 定义）可以并行做
- Phase 3 与 Phase 4 完全独立（前者是 UserPicker，后者是 Tabs 布局），可并行
- Phase 4 内的 T019 / T020 / T021 / T022 / T024 / T025 / T027 全部可并行（不同文件）
- Phase 5 的 T029 / T030 可并行
- Phase 6 必须最后（依赖前面所有）

---

## Critical Files Reference

| 文件 | 角色 | 修改类型 |
| --- | --- | --- |
| `apps/yishan-api/src/modules/crm/schemas/internal.schema.ts` | 新增 | 新建 |
| `apps/yishan-api/src/modules/crm/services/user-search.service.ts` | 新增 | 新建 |
| `apps/yishan-api/src/modules/crm/routes/v1/internal/users/index.ts` | 新增 | 新建 |
| `apps/yishan-api/src/modules/crm/schemas/permissions.ts` | 修改 | 加 USER_SEARCH（**不要**重调 registerPermissions）|
| `apps/yishan-api/src/modules/crm/schemas/customer.schema.ts` | 修改 | 加 ViewType + followUpWithin |
| `apps/yishan-api/src/modules/crm/repositories/customer.repository.ts` | 修改 | 加 buildListWhere view 分支 + buildListOrderBy |
| `apps/yishan-api/src/modules/crm/tests/internal-users.test.ts` | 新增 | 新建 |
| `apps/yishan-api/src/modules/crm/tests/customer-list-views.test.ts` | 新增 | 新建 |
| `apps/yishan-api/src/core/plugins/external/swagger.ts` | 修改 | 加 crm-internal tag |
| `apps/yishan-admin/src/services/crm.ts` | 修改 | 加 searchUsers / quickFollow / listCustomers 加 view 参数 |
| `apps/yishan-admin/src/modules/crm/components/UserPicker/{index,UserPickerOption,useUserSearch}.{tsx,ts}` | 新增 | 新建 |
| `apps/yishan-admin/src/modules/crm/pages/customer-detail/components/{OverviewTab,ActivitiesTab,ContactsTab,TransfersTab,QuickFollowBar}.tsx` | 新增 | 新建 |
| `apps/yishan-admin/src/modules/crm/pages/customer-detail/index.tsx` | 重写 | Tabs 布局 + QuickFollowBar 挂载 |
| `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx` | 修改 | SmartViewTabs + UserPicker + valueEnum |
| `apps/yishan-admin/src/modules/crm/pages/customers/components/SmartViewTabs.tsx` | 新增 | 新建 |

---

## Acceptance Checklist (回归)

- [ ] 后端 `npx vitest run` → 315+ 原有 + 6 新增（internal-users 6 用例） + 6 新增（list-views 6 用例）= ~327 全绿
- [ ] 前端 `npx tsc --noEmit` → 0 error
- [ ] Swagger `/api/docs` 显示 `crm-internal` tag + `crm` tag 的新 query 参数
- [ ] 详情页首次加载 < 800ms（已优化：写跟进不重拉 contacts / transfers）
- [ ] UserPicker 输入 "李" → 300ms 内出结果
- [ ] 公海客户详情页**不**渲染 QuickFollowBar
- [ ] Yishan Constitution §III §VI 满足（closed allowlist / single-source list query）
- [ ] 现有 23 个 CRM 权限码无变化，仅新增 `crm:user:search`

---

## Out of Scope (后续 specs)

- `004-crm-v1.2-optimization.md` — 24h 撤销认领 / cron 回收 / 客户评分 / 认领配额
- `005-crm-attachment-tab.md` — 详情页附件 Tab
- `006-crm-data-bi.md` — 销售漏斗 / RFM 看板
- `007-crm-mobile-detail.md` — 移动端详情页
