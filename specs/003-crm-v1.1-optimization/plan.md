# Implementation Plan: CRM v1.1 — 详情页改造 + 用户选择器 + 列表智能筛选

**Branch**: `003-crm-v1.1-optimization` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: 悟空 CRM / 销售易 / XTools 快目标行业对标（spec.md §Context）；Yishan CRM v1.0 已落地（commit 已应用至本仓库）；本 plan 锁定 v1.1 落地路径。

---

## Summary

把 Yishan CRM MVP（v1.0 已跑通于 `127.0.0.1:3000` + `:8000`）的"详情页 / 用户选择器 / 列表筛选"三块前端 UX 改造到行业头部水平。**纯前端 + 1 个轻量后端接口**（`/api/crm/v1/internal/users`），不动现有权限、不动 schema、零迁移。落地后销售写跟进从 4 步降到 2 步，转错客户风险归零，列表可直接看到"今天该做什么"。

---

## Technical Context

| 项 | 值 |
| --- | --- |
| Language/Version | TypeScript 5.x（admin + api 端）|
| Framework — Admin | UmiJS 4 + React 19 + Ant Design 6 + Ant Design Pro Components 3.x |
| Framework — API | Fastify 5 + TypeBox 0.34 + Drizzle ORM 0.44 + MySQL 8 |
| Storage | MySQL 8（`yishan_crm_local` 数据库，CRM 表已通过 drizzle-kit migrate）|
| State Management | React useState + initialState（dictDataMap + cloudStorageConfig 已存在，需扩展 CRM settings 缓存）|
| API Style | REST + JSON envelope `{success, code, message, data, timestamp}` + 分页带 `pagination: {page, pageSize, total, totalPages}` |
| Auth | JWT + cookie 双轨；前端通过 `Authorization: Bearer <token>` |
| Test — Admin | Jest（apps/yishan-admin 已配 `pnpm test`）|
| Test — API | Vitest（apps/yishan-api 已配 `pnpm test`，单测文件在 `src/modules/crm/tests/`）|
| Module System | `apps/yishan-api/src/modules/crm/` 自包含；autoload 自动挂载 `/api/crm` prefix；菜单在 `config/system-menu.json`；权限码在 `schemas/permissions.ts` |
| Target Platform | Web SPA（桌面优先）+ 自适应 mobile |
| Performance | 列表查询 < 500ms p95；详情页初次加载 < 800ms p95 |
| Constraints | Yishan Constitution 7 条核心原则全部适用（见 spec.md §Constitution 自检）|
| Scale | 单租户 / 中小企业（10-200 销售）|

---

## Constitution Check

逐条对 Yishan `.specify/memory/constitution.md`：

| 原则 | 落地要求 |
| --- | --- |
| I. Contract-First | 新增 `GET /api/crm/v1/internal/users` 必须在 `apps/yishan-api/src/modules/crm/schemas/internal.schema.ts` 先定义 TypeBox 请求 / 响应 schema，再写 service / route；前端 UserPicker 引用 `@/services/crm` 的 typed function |
| II. Explicit Boundary Mapping | API query `view / statusId / sourceId / followUpWithin / page / pageSize` 用 lowerCamelCase → service 层映射到 Drizzle `crmCustomer.*` lowerCamelCase property → MySQL 列自动 snake_case（Drizzle 默认映射） |
| III. Safe Dynamic Queries | (a) `view` 参数必须用 closed enum（`all / today / overdue / week`），后端 enum 校验；(b) `sortBy` 允许值：`updatedAt / nextFollowUpAt / lastFollowUpAt / createdAt`，前端白名单；(c) UserPicker `keyword` 必须走 Drizzle `like` 而非 SQL 拼接 |
| IV. Regression Coverage | 必须新增：(1) `tests/internal-users.test.ts` — keyword 模糊查 / limit / status 过滤 / 鉴权；(2) `tests/customer-list-views.test.ts` — 4 种 view 参数的 SQL 行为；(3) Admin Jest — CustomerDetail 默认 Tab / UserPicker 选中回填 |
| V. Documentation Executable | Swagger tag 列表加 `crm-internal`（在 `apps/yishan-api/src/core/plugins/external/swagger.ts`）；新接口必须在 OpenAPI 里出现 `tags: ['crm-internal']` 才能被 `/api/docs` 收录 |
| VI. Single-Source List Queries | `CustomerRepository.list` 改造为：单一 query config + `applyView(view, where, orderBy)` 模式，4 个 view 共用 base query，不复制 4 份 findMany；类似地 `findPendingFollowUps` 复用 |
| VII. Release-Time Plugin Composition | CRM 模块自包含：菜单（已写入）+ 权限（已写入）+ 测试（本 spec 内新增）+ 本期新增 1 个 schema（`internal.schema.ts`）+ 本期新增 1 个 service helper（`user-search.service.ts`），不污染 Core |

✅ Constitution 全部通过。

---

## Architecture & Approach

### 数据流（写跟进快速路径）

```
User 在详情页顶部 QuickFollowBar 输入文本 + 回车
  ↓
onKeyDown (Ctrl+Enter 触发提交，避免 input 中换行误触发)
  ↓
useQuickFollow(customerId, currentUser) hook
  ↓
POST /api/crm/v1/customers/:customerId/activities { type: 'phone', content, occurredAt: now() }
  ↓
ActivityService.create → dbManager.transaction (insert + update customer.last_follow_up_at)
  ↓
201 { data: ActivityRow }
  ↓
optimistic UI：直接 push 到 activities state 顶部（无需重新拉列表）
```

### 数据流（UserPicker 选人转交）

```
User 点击转交按钮
  ↓
TransferModal 打开 + UserPicker 自动 focus
  ↓
UserPicker 输入 "李" → debounce 300ms
  ↓
GET /api/crm/v1/internal/users?keyword=李&limit=20
  ↓
后端：sysUser 表 WHERE username LIKE '%李%' OR real_name LIKE '%李%' AND status != '0' LIMIT 20
  ↓
返回 [{ id, username, realName, deptIds: [{ deptId, deptName }] }]
  ↓
UserPicker dropdown 展示，点击选中 → setTransferTarget(targetUserId)
  ↓
点击"确认转交" → POST /api/crm/v1/customers/:id/transfer
```

### 数据流（列表智能视图）

```
User 进入 /crm/customers
  ↓
URL ?view=all|today|overdue|week（默认 all）
  ↓
ProTable tab 切换 → setView() → router.replace 改 URL
  ↓
request(params) → 把 view 字段加到 query
  ↓
GET /api/crm/v1/customers?view=overdue&page=1&pageSize=10
  ↓
service.list({ query: {view, ...}, currentUser })
  ↓
CustomerRepository.list 把 view 映射成额外的 where / orderBy
  ↓
200 { data, pagination }
```

---

## Project Structure

### 后端新增文件

```
apps/yishan-api/src/modules/crm/
├── schemas/
│   └── internal.schema.ts                   [新增] UserPicker search schema
├── services/
│   └── user-search.service.ts               [新增] 用户搜索 service
├── routes/v1/
│   └── internal/
│       └── users/
│           └── index.ts                      [新增] GET /api/crm/v1/internal/users 路由
└── tests/
    ├── internal-users.test.ts               [新增]
    └── customer-list-views.test.ts          [新增]
```

### 后端改动文件

```
apps/yishan-api/src/modules/crm/
├── schemas/routes.schema.ts                 [改] 增 PaginatedEnvelopeSchema + EnvelopeSchema
├── schemas/permissions.ts                   [改] 增 USER_SEARCH 权限码
├── schemas/customer.schema.ts               [改] 增 ViewType 枚举 + view / followUpWithin query 字段
├── repositories/customer.repository.ts      [改] list() 加 view 参数；实现 4 种 view 共用 query config（Constitution §VI）
├── services/customer.service.ts             [改] list() 透传 view
├── routes/v1/customers/index.ts             [改] 把 view 字段加到 querystring
├── config/system-menu.json                  [不动] 菜单已包含"客户管理"页面
└── README.md                                [改] 文档更新：v1.1 新增 3 个 user story
```

```
apps/yishan-api/src/core/plugins/external/swagger.ts  [改] tags 数组加 { name: 'crm-internal', description: '...' }
```

### 前端新增文件

```
apps/yishan-admin/src/modules/crm/pages/
├── customer-detail/
│   ├── index.tsx                            [重写] 改 Tabs 布局 + 顶部 QuickFollowBar
│   └── components/
│       ├── QuickFollowBar.tsx               [新增] 顶部快速跟进条
│       ├── OverviewTab.tsx                   [拆分] 原"概览"内容
│       ├── ActivitiesTab.tsx                 [拆分] 跟进 Timeline
│       ├── ContactsTab.tsx                   [拆分] 联系人列表
│       └── TransfersTab.tsx                  [拆分] 流转 Timeline
├── customers/
│   ├── index.tsx                            [改] 增 view tabs + followUpWithin 筛选
│   └── components/
│       └── SmartViewTabs.tsx                [新增] 4 个 Tab：全部 / 今日待办 / 超期 / 本周
└── components/                              [新增] 跨页面复用组件
    └── UserPicker/
        ├── index.tsx                        [新增] UserPicker 主组件
        ├── UserPickerOption.tsx             [新增] 下拉项渲染
        └── useUserSearch.ts                 [新增] keyword debounce + fetch hook
```

### 前端改动文件

```
apps/yishan-admin/src/modules/crm/pages/
├── customer-detail/index.tsx                [重写]
├── customers/index.tsx                       [改]
└── services/crm.ts                           [改] 加 listCustomersWithView / searchUsers / quickFollow / getTransfersTargets
```

```
apps/yishan-admin/src/services/crm.ts         [改]
```

---

## API Design (新增 / 修改)

### 新增 `GET /api/crm/v1/internal/users`

**用途：** UserPicker 用户搜索

**Schema（`apps/yishan-api/src/modules/crm/schemas/internal.schema.ts`）：**

```ts
export const UserSearchQuerySchema = Type.Object({
  keyword: Type.Optional(Type.String({ minLength: 1, maxLength: 32 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
})
export type UserSearchQuery = Static<typeof UserSearchQuerySchema>

export const UserSearchItemSchema = Type.Object({
  id: Type.Number(),
  username: Type.Union([Type.String(), Type.Null()]),
  realName: Type.Union([Type.String(), Type.Null()]),
  deptIds: Type.Array(Type.Object({
    deptId: Type.Number(),
    deptName: Type.String(),
  })),
})
export type UserSearchItem = Static<typeof UserSearchItemSchema>
```

**Route（`routes/v1/internal/users/index.ts`）：**

```ts
route.get('/users', {
  access: { permission: PERMS.USER_SEARCH },
  schema: {
    tags: ['crm-internal'],
    summary: '搜索用户（UserPicker 用）',
    operationId: 'crmInternalUsersSearch',
    querystring: UserSearchQuerySchema,
    response: { 200: EnvelopeSchema(Type.Array(UserSearchItemSchema)) },
  },
}, async (request) => {
  return ResponseUtil.success(reply, await userSearchService.search(request.query))
})
```

**Service（`services/user-search.service.ts`）：**

```ts
export class UserSearchService {
  async search({ keyword, limit = 20 }: { keyword?: string; limit?: number }): Promise<UserSearchItem[]> {
    // 允许的列名白名单（Constitution §III）
    const where = and(
      // 已离职 / 禁用 排除（status === '1' 启用）
      eq(sysUser.status, '1'),
      keyword ? or(like(sysUser.username, `%${keyword}%`), like(sysUser.realName, `%${keyword}%`)) : undefined,
    )
    const rows = await drizzleDb.select({
      id: sysUser.id,
      username: sysUser.username,
      realName: sysUser.realName,
    }).from(sysUser).where(where).limit(limit)
    // 再查部门（一次 N+1 → 用 inArray 一次解决）
    const userIds = rows.map(r => r.id)
    const deptLinks = userIds.length > 0
      ? await drizzleDb.select({ userId: sysUserDept.userId, deptId: sysUserDept.deptId, deptName: sysDept.name })
          .from(sysUserDept).leftJoin(sysDept, eq(sysDept.id, sysUserDept.deptId))
          .where(and(inArray(sysUserDept.userId, userIds), isNull(sysUserDept.deletedAt)))
      : []
    // 组装
    const deptByUser = new Map<number, { deptId, deptName }[]>()
    for (const l of deptLinks) {
      if (!deptByUser.has(l.userId)) deptByUser.set(l.userId, [])
      deptByUser.get(l.userId)!.push({ deptId: l.deptId, deptName: l.deptName ?? '' })
    }
    return rows.map(r => ({ ...r, deptIds: deptByUser.get(r.id) ?? [] }))
  }
}
```

**权限：** 新增 `crm:user:search` 权限码（仅 super_admin / sales_lead 默认有；普通销售走"自己 + 同部门"的隐式过滤）。具体策略：
- super_admin：全部用户
- sales_lead（部门主管）：同部门 + 同部门子部门用户
- sales（普通销售）：自己 + 同部门

---

### 修改 `GET /api/crm/v1/customers`

**新增 query 参数：**

```ts
export const ViewTypeSchema = Type.Union([
  Type.Literal('all'),
  Type.Literal('today'),      // next_follow_up_at 在今天
  Type.Literal('overdue'),    // next_follow_up_at < today
  Type.Literal('week'),       // created_at 在本周
])
export type ViewType = Static<typeof ViewTypeSchema>

export const CustomerListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    view: Type.Optional(ViewTypeSchema),                 // 默认 'all'
    followUpWithin: Type.Optional(Type.Union([             // 'today' / '7d' / '30d' / 'overdue'
      Type.Literal('today'), Type.Literal('7d'), Type.Literal('30d'), Type.Literal('overdue')
    ])),
    statusId: Type.Optional(Type.Integer()),
    sourceId: Type.Optional(Type.Integer()),
    ownerUserId: Type.Optional(Type.Integer()),
  }),
])
```

**Repository 层（`customer.repository.ts`）：**

```ts
export interface CustomerListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  statusId?: number
  sourceId?: number
  level?: string
  type?: string
  ownerUserId?: number
  poolStatus?: CustomerPoolStatus
  ownerUserIds?: number[] | null
  ownerDepartmentIds?: number[] | null
  view?: 'all' | 'today' | 'overdue' | 'week'        // [新增]
  followUpWithin?: 'today' | '7d' | '30d' | 'overdue' // [新增]
}

function buildListWhere(opts: CustomerListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(crmCustomer.deletedAt)]
  // ... existing keyword / status / source / level / type / ownerUserId / poolStatus / dataScope ...
  
  // View 过滤
  if (opts.view && opts.view !== 'all') {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000)
    const weekAgoStart = new Date(todayStart.getTime() - 7 * 24 * 3600 * 1000)
    if (opts.view === 'today') {
      conds.push(and(
        gte(crmCustomer.nextFollowUpAt, todayStart),
        lt(crmCustomer.nextFollowUpAt, tomorrowStart),
      )!)
    } else if (opts.view === 'overdue') {
      conds.push(lt(crmCustomer.nextFollowUpAt, todayStart))
      conds.push(isNotNull(crmCustomer.nextFollowUpAt))
    } else if (opts.view === 'week') {
      conds.push(gte(crmCustomer.createdAt, weekAgoStart))
    }
  }
  
  // followUpWithin 过滤（与 view 互斥，followUpWithin 用于"X 天内跟进"快速过滤）
  if (opts.followUpWithin) {
    const todayStart = startOfToday()
    if (opts.followUpWithin === 'today') {
      conds.push(and(
        gte(crmCustomer.nextFollowUpAt, todayStart),
        lt(crmCustomer.nextFollowUpAt, addDays(todayStart, 1)),
      )!)
    } else if (opts.followUpWithin === '7d' || opts.followUpWithin === '30d') {
      const days = opts.followUpWithin === '7d' ? 7 : 30
      conds.push(and(
        gte(crmCustomer.nextFollowUpAt, todayStart),
        lt(crmCustomer.nextFollowUpAt, addDays(todayStart, days)),
      )!)
    } else if (opts.followUpWithin === 'overdue') {
      conds.push(lt(crmCustomer.nextFollowUpAt, todayStart))
      conds.push(isNotNull(crmCustomer.nextFollowUpAt))
    }
  }
  
  return and(...conds)
}

function buildListOrderBy(opts: CustomerListQuery): SQL[] {
  const orderBy: SQL[] = []
  if (opts.view === 'overdue') {
    orderBy.push(asc(crmCustomer.nextFollowUpAt))    // 超期按最久没跟进升序
  } else if (opts.view === 'today') {
    orderBy.push(asc(crmCustomer.nextFollowUpAt))    // 今日待办按时间升序（先做的先排）
  } else {
    orderBy.push(desc(crmCustomer.updatedAt))         // 默认按更新时间倒序
  }
  return orderBy.length > 0 ? orderBy : [desc(crmCustomer.updatedAt)]
}
```

**Constitution §VI：4 种 view 共用 `buildListWhere` + `buildListOrderBy`，不复制 4 份 query。**

---

## Component Design

### QuickFollowBar (新组件)

```tsx
// apps/yishan-admin/src/modules/crm/pages/customer-detail/components/QuickFollowBar.tsx
interface QuickFollowBarProps {
  customerId: number
  poolStatus: 'public' | 'owned'
  onSubmitted: (activity: ActivityRow) => void
}

export const QuickFollowBar: React.FC<QuickFollowBarProps> = ({ customerId, poolStatus, onSubmitted }) => {
  const [content, setContent] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const isOverThreshold = content.length > 200
  const isPublic = poolStatus === 'public'

  const submit = async (extra?: { type?: ActivityType; nextFollowUpAt?: string }) => {
    if (!content.trim() || isPublic) return
    setLoading(true)
    try {
      const activity = await quickFollow(customerId, { 
        type: extra?.type ?? 'phone', 
        content: content.trim(),
        nextFollowUpAt: extra?.nextFollowUpAt,
      })
      message.success('跟进已记录')
      onSubmitted(activity)
      setContent('')
      setExpanded(false)
    } finally {
      setLoading(false)
    }
  }

  if (isPublic) return null

  return (
    <div className="quick-follow-bar" style={{ borderRadius: 8, padding: 12, background: '#fff', marginBottom: 16 }}>
      <Input.TextArea
        placeholder="记录这次跟进（回车快速提交，200 字以上展开完整编辑器）"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoSize={{ minRows: 1, maxRows: 4 }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            submit()
          }
        }}
        disabled={loading}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ color: '#999', fontSize: 12 }}>{content.length} / 2000</span>
        <Space>
          {isOverThreshold && !expanded && (
            <Button type="link" onClick={() => setExpanded(true)}>展开完整编辑器</Button>
          )}
          <Button type="primary" onClick={() => submit()} loading={loading} disabled={!content.trim()}>
            提交 (Ctrl+Enter)
          </Button>
        </Space>
      </div>
      {expanded && (
        <FullFollowForm onCancel={() => setExpanded(false)} onSubmit={(extra) => submit(extra)} />
      )}
    </div>
  )
}
```

### UserPicker (新组件)

```tsx
// apps/yishan-admin/src/modules/crm/components/UserPicker/index.tsx
interface UserPickerProps {
  value?: number
  onChange: (userId: number, user: UserSearchItem) => void
  placeholder?: string
  disabled?: boolean
  /** 数据范围限制（默认 'all'）：'all' / 'department' / 'self' */
  scope?: 'all' | 'department' | 'self'
}

export const UserPicker: React.FC<UserPickerProps> = ({ value, onChange, placeholder, disabled, scope = 'all' }) => {
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const debouncedKeyword = useDebounce(keyword, 300)
  const { data: users = [], loading } = useUserSearch(debouncedKeyword, scope)

  return (
    <Select
      showSearch
      value={value}
      placeholder={placeholder ?? '搜索用户名 / 真名'}
      open={open}
      onOpenChange={setOpen}
      onSearch={setKeyword}
      onChange={(val, option) => onChange(val as number, option as UserSearchItem)}
      filterOption={false}   // 后端过滤
      loading={loading}
      disabled={disabled}
      options={users.map(u => ({
        value: u.id,
        label: (
          <Space>
            <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
              {(u.realName ?? u.username ?? '?').charAt(0).toUpperCase()}
            </Avatar>
            <span>{u.realName ?? u.username}</span>
            <span style={{ color: '#999', fontSize: 12 }}>{u.deptIds.map(d => d.deptName).join(' / ') || '—'}</span>
          </Space>
        ),
      }))}
      notFoundContent={loading ? '搜索中...' : '无匹配用户'}
    />
  )
}
```

### SmartViewTabs (新组件)

```tsx
// apps/yishan-admin/src/modules/crm/pages/customers/components/SmartViewTabs.tsx
type ViewType = 'all' | 'today' | 'overdue' | 'week'

export const SmartViewTabs: React.FC<{ value: ViewType; onChange: (v: ViewType) => void; counts?: Record<ViewType, number> }> = ({ value, onChange, counts }) => (
  <Tabs
    activeKey={value}
    onChange={(k) => onChange(k as ViewType)}
    items={[
      { key: 'all', label: `全部 ${counts?.all != null ? `(${counts.all})` : ''}` },
      { key: 'today', label: `今日待办 ${counts?.today != null ? `(${counts.today})` : ''}` },
      { key: 'overdue', label: <Badge status="error" text={`超期 ${counts?.overdue ?? ''}`} /> },
      { key: 'week', label: `本周新增 ${counts?.week != null ? `(${counts.week})` : ''}` },
    ]}
  />
)
```

> counts 字段：可后续通过 `GET /api/crm/v1/customers/counts?view=...` 拉取，本期不实现，Tab 标题不带数字。

---

## Implementation Phases

### Phase 1 — 后端基础（US3 列表 + UserPicker 数据源）

| Task | 文件 | 估时 |
| --- | --- | --- |
| 1.1 新增 `UserSearchQuerySchema` / `UserSearchItemSchema` | `schemas/internal.schema.ts` | 0.5h |
| 1.2 新增 `UserSearchService` + `user-search.service.ts`（含 N+1 优化：用 inArray 一次性查部门） | `services/user-search.service.ts` | 1h |
| 1.3 新增 `routes/v1/internal/users/index.ts` + `internal/users` 目录结构 | `routes/v1/internal/users/index.ts` | 0.5h |
| 1.4 在 `schemas/permissions.ts` 加 `USER_SEARCH` 权限码 + `registerPermissions`（已在集中文件） | `schemas/permissions.ts` | 0.2h |
| 1.5 在 `config/system-menu.json` 加菜单"内部接口（CRM）"（dev-only 隐藏） | `config/system-menu.json` | 0.2h |
| 1.6 在 `core/plugins/external/swagger.ts` 的 tags 数组加 `crm-internal` | `core/plugins/external/swagger.ts` | 0.1h |
| 1.7 新增 vitest 单测：`internal-users.test.ts`（keyword / limit / 鉴权 / N+1 验证） | `tests/internal-users.test.ts` | 1h |

**Phase 1 总计：** ~3.5h

### Phase 2 — 后端列表 view（US4 列表智能筛选）

| Task | 文件 | 估时 |
| --- | --- | --- |
| 2.1 扩展 `CustomerListQuerySchema`：增 `view` (ViewTypeSchema) + `followUpWithin` | `schemas/customer.schema.ts` | 0.3h |
| 2.2 扩展 `CustomerListQuery` interface（Repository 层）+ `buildListWhere` 实现 view / followUpWithin 条件 + `buildListOrderBy` | `repositories/customer.repository.ts` | 1.5h |
| 2.3 透传 view / followUpWithin 到 service.list | `services/customer.service.ts` | 0.3h |
| 2.4 路由透传 query 到 schema（已经在用 CustomerListQuerySchema，自动生效） | `routes/v1/customers/index.ts` | 0h |
| 2.5 新增 vitest 单测：`customer-list-views.test.ts`（4 种 view + followUpWithin） | `tests/customer-list-views.test.ts` | 1.5h |

**Phase 2 总计：** ~3.6h

### Phase 3 — 前端 UserPicker + 转交/释放改造（US3）

| Task | 文件 | 估时 |
| --- | --- | --- |
| 3.1 `services/crm.ts` 加 `searchUsers(keyword, scope)` 调用 `/api/crm/v1/internal/users` | `services/crm.ts` | 0.3h |
| 3.2 新增 `components/UserPicker/index.tsx`（Select + debounce + 后端过滤） | `components/UserPicker/index.tsx` | 1h |
| 3.3 新增 `components/UserPicker/useUserSearch.ts`（SWR / fetch hook） | `components/UserPicker/useUserSearch.ts` | 0.5h |
| 3.4 `customers/index.tsx` 转交 Modal 改造：删除 prompt 框 + 用 UserPicker | `pages/customers/index.tsx` | 0.5h |
| 3.5 `customer-detail/index.tsx` 转交 / 释放 / 写跟进（选联系人）：用 UserPicker / 现有客户联系人 | `pages/customer-detail/index.tsx` | 1h |
| 3.6 客户详情页：写跟进 Drawer 里联系人 Select 改成"显示客户下的联系人（已有）" | `pages/customer-detail/index.tsx` | 0.3h |
| 3.7 Admin Jest 单测：UserPicker 选中回填、TransferModal 替换 | `__tests__/UserPicker.test.tsx` (新文件) | 1h |

**Phase 3 总计：** ~4.6h

### Phase 4 — 前端详情页 Tabs + 快速跟进条（US1 + US2）

| Task | 文件 | 估时 |
| --- | --- | --- |
| 4.1 拆分 `customer-detail/index.tsx` → 4 个子组件：OverviewTab / ActivitiesTab / ContactsTab / TransfersTab | `pages/customer-detail/components/*.tsx` | 2h |
| 4.2 主页面改为 `<Tabs>` 布局，跟进 Tab 默认 active | `pages/customer-detail/index.tsx` | 0.5h |
| 4.3 新增 `QuickFollowBar` 组件（US2 全部逻辑） | `pages/customer-detail/components/QuickFollowBar.tsx` | 1.5h |
| 4.4 详情页顶部挂载 QuickFollowBar（仅在 poolStatus=owned 时显示） | `pages/customer-detail/index.tsx` | 0.3h |
| 4.5 `services/crm.ts` 加 `quickFollow(customerId, {type, content, nextFollowUpAt?})` + `searchUsers` | `services/crm.ts` | 0.3h |
| 4.6 写跟进成功后只重拉 `getCustomer` + `listActivitiesByCustomer`，不重拉 contacts / transfers（性能优化） | `pages/customer-detail/index.tsx` | 0.5h |
| 4.7 Admin Jest 单测：默认 Tab / QuickFollowBar 公海不显示 / 200 字展开 Drawer | `__tests__/CustomerDetail.test.tsx` | 1.5h |

**Phase 4 总计：** ~6.6h

### Phase 5 — 前端列表 SmartViewTabs（US4 前端部分）

| Task | 文件 | 估时 |
| --- | --- | --- |
| 5.1 新增 `SmartViewTabs` 组件（4 个 Tab + URL 同步） | `pages/customers/components/SmartViewTabs.tsx` | 0.5h |
| 5.2 `customers/index.tsx`：ProTable 顶部挂 Tabs，切换 view → URL 更新 + query 透传 | `pages/customers/index.tsx` | 1h |
| 5.3 `services/crm.ts`：`listCustomers` 加 `view` / `followUpWithin` 参数 | `services/crm.ts` | 0.3h |
| 5.4 ProTable 筛选面板：`statusId / sourceId / ownerUserId` 加 valueEnum（启动时一次拉所有 settings + 当前用户列表缓存） | `pages/customers/index.tsx` | 1h |
| 5.5 Admin Jest 单测：Tab 切换 URL 变化 / 筛选下拉有 options | `__tests__/CustomersList.test.tsx` | 1h |

**Phase 5 总计：** ~3.8h

### Phase 6 — E2E & 文档

| Task | 文件 | 估时 |
| --- | --- | --- |
| 6.1 手动端到端测试：详情 → 快速跟进 → 列表自动刷新 → 转交 → 公海 | 本地 :8000 + :3000 | 1h |
| 6.2 `apps/yishan-api/src/modules/crm/README.md` 加 v1.1 changelog | `README.md` | 0.3h |
| 6.3 Swagger UI 验证：crm + crm-internal 两个 tag 都显示新接口 | `127.0.0.1:3000/api/docs` | 0.3h |

**Phase 6 总计：** ~1.6h

---

## 总估时：**~22h ≈ 3 个工作日**

按 ROI 分批：
- **MVP 必做（Phase 1 + 3）：** 后端 UserPicker 接口 + 前端 UserPicker 组件 + 转交改用 UserPicker → ~8h = 1 天
- **完整 v1.1（Phase 1 + 2 + 3 + 4 + 5）：** 上面 + 列表智能筛选 + 详情 Tabs + 快速跟进条 → ~22h = 3 天
- **可选（Phase 6）：** 端到端测试 + 文档

---

## Risk & Trade-offs

| Risk | 影响 | Mitigation |
| --- | --- | --- |
| UserPicker 在客户数 > 1000 时全表 LIKE 查询慢 | UserPicker 首次输入卡顿 | (a) 加索引 `idx_sys_user_username` + `idx_sys_user_real_name`（MySQL 已有 `sys_user_username_key` unique 索引，可复用 `real_name` 需新增普通索引）；(b) keyword 必须 ≥ 1 字符；(c) limit 默认 20 上限 50 |
| 快速跟进条 Ctrl+Enter 快捷键与 IME 中文输入法冲突 | 中文用户输入回车换行时误触发提交 | (a) 用 Ctrl/Cmd+Enter 触发（不裸用 Enter）；(b) 提交前检查 `e.nativeEvent.isComposing === false` |
| 列表 view 切换 + URL 同步在 UmiJS 4 下用 `history.replace` 而非 push | 浏览器后退无法回到上一个 view | 用 `history.replace` 但在首次进入时 push；其他 view 切换不污染历史栈 |
| UserPicker 后端 `/api/crm/v1/internal/users` 暴露了全公司员工列表（信息泄漏风险） | 销售可见不属于自己的同事信息（虽然只是姓名 / 部门） | (a) 接口至少需要 `crm:user:search` 权限码；(b) 默认仅返回 `status='1'` 启用用户；(c) super_admin 才看全公司；sales_lead 看本部门子部门；sales 看自己 + 同部门 |
| 公海客户详情页显示 QuickFollowBar 但提交会失败（CRM_CUSTOMER_TRANSFER_FORBIDDEN） | 用户困惑 | QuickFollowBar 在 poolStatus=public 时**不渲染**（早返 null），从源头消除歧义 |
| 4 种 view 共用 query config 改造可能影响现有 list() 调用 | 既有路由 / service 出错 | (a) Repository.list 接受可选 `view` 参数，默认 'all' 与旧行为等价；(b) Vitest 覆盖原有 list() 单测 + 4 种 view 新单测；(c) 不破坏现有 query string 不传 view 时行为一致 |
| Tabs 切换导致 contacts 表格每次都重 mount → 编辑联系人时丢失未保存输入 | 用户体验差 | ContactsTab 用 useState 在父组件持有 contacts state（已在 customer-detail/index.tsx 顶层持有），不因 Tabs 切换而重挂 |

---

## Acceptance Checklist

- [ ] 后端 `GET /api/crm/v1/internal/users?keyword=&limit=` 通过 Swagger 可见
- [ ] 后端 `GET /api/crm/v1/customers?view=overdue` 返回按 `next_follow_up_at` 升序的超期客户
- [ ] 后端 `GET /api/crm/v1/customers?view=today` 只返回今日待办（next_follow_up_at 在今天）
- [ ] 所有 4 种 view + followUpWithin 在 vitest 覆盖下行为正确
- [ ] 前端详情页默认显示"跟进记录" Tab，3 秒内首屏出现 Timeline
- [ ] 前端快速跟进条 Ctrl+Enter 提交成功，1 秒内新条目出现在 Timeline 顶部
- [ ] 前端转交按钮弹 UserPicker（不是 window.prompt），按名字搜索能搜出同事
- [ ] 前端列表 4 个 SmartView Tab 切换正常，URL query 同步
- [ ] 前端列表筛选下拉 statusId / sourceId / ownerUserId 都有 options
- [ ] 公海客户详情页**不**显示 QuickFollowBar
- [ ] 销售无 `crm:user:search` 权限访问 UserPicker 后端接口 → 403
- [ ] 315+ 个原有 vitest 测试全绿（不回归）
- [ ] Yishan Constitution 7 条全部满足（特别是 §III Safe Dynamic Queries + §VI Single-Source List Queries）

---

## Out of Scope (后续 specs)

- `004-crm-v1.2-optimization.md`：24h 撤销认领 / cron 回收 / 客户评分 / 认领配额（schema 改动）
- `005-crm-attachment-tab.md`：详情页附件 Tab 复用 sys_attachment
- `006-crm-data-bi.md`：销售漏斗 / 客户生命周期 / RFM 看板
- `007-crm-mobile-detail.md`：移动端详情页 BottomSheet

---

## References

- [悟空 CRM 客户管理](https://www.5kcrm.com/188151)
- [销售易 CRM 公海池](https://www.xiaoshouyi.com/tag/91)
- [XTools 快目标移动 CRM](http://crm.xtools.cn/product/0101.html)
- Yishan Constitution：`.specify/memory/constitution.md`
- Yishan CRM MVP：`apps/yishan-api/src/modules/crm/README.md`
- Speckit 模板：`.specify/templates/`
