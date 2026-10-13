# App 全站页面对齐设计（重写版）

日期：2026-10-13
状态：待审阅
范围：`apps/demo/app` 移动端页面、`packages/core/system-api` 登录日志只读接口及其 OpenAPI/手写客户端同步

## 1. 目标与边界

`apps/demo/app` 已有一套以 `ManagementPage`、`ManagementPageHeader`、
`ManagementList`、`ManagementCell` 和 `ManagementStates` 为核心的管理页面语言；
首页、工作台、登录、个人中心和通讯录仍混用旧的 `molecules` 组件、页面私有样式和重复状态处理。

本次工作的目标是：

1. 让页面按内容品类共享同一套基础语言。列表/详情/表单使用 management 家族；首页、工作台、登录保留卡片型布局，但所有颜色、圆角、间距和阴影使用既有 token。
2. 让共享能力只有一个公开入口，删除重复实现和错误示例，同时保留必要的品牌图标和业务专属组合。
3. 修复两个会导致真实数据错误的结构问题：通讯录部门树丢失层级、个人登录详情依赖内存交接。
4. 保持现有权限、账号切换、路由路径和后端业务语义不变。新增登录日志详情接口必须向后兼容，不需要数据库迁移。

本设计是一份总设计，拆成三条可独立验收的实施线：

- **基础线**：共享组件、页头兼容、鉴权壳边界、账号作用域、token 和测试基线。
- **页面线**：移动端页面迁移和通讯录交互修复。
- **接口线**：登录日志按当前用户查询详情的 API、OpenAPI、App 手写 API client 和详情页数据流。

基础线先交付。页面线可在基础线完成后分模块交付；接口线可与页面线并行，但登录详情页切换到真实请求必须等接口线的手写 App client 完成。

## 2. 调研结论

### 2.1 现有共享组件事实

- `ManagementPageHeader` 实际定义在 `apps/demo/app/src/components/management/ManagementPage.tsx`，不是独立文件。它已有 `title`、`subtitle`、`action`、`onBack`、`showBack`，但没有旧 `PageHeader` 的 `bordered`、`className`、安全区/sticky 行为和 `ReactNode` 标题兼容能力。
- 旧 `PageHeader` 位于 `apps/demo/app/src/components/molecules/PageHeader/`，当前 API 为 `title`、`showBack`、`onBack`、`right`、`subtitle`、`bordered`、`className`。生产代码仍在 system shared scaffold、demo 页和多个 system 页使用。
- `PageContainer` 当前同时承担会话 bootstrap、鉴权加载、权限拒绝、错误重试和视觉容器职责；`ManagementPage` 只承担页面背景、内边距、滚动和底部操作栏预留。两者不能直接互换。
- `ManagementCell` 当前的 `tag` 是状态列，组件注释仍示范 `·` 拼接；行内没有动作槽。`ManagementTreeCell` 已提供层级、展开箭头和独立 toggle，但通讯录首页没有使用它。
- management 家族已经有 `Checkbox`、`FormError`、`SecretField`、`LineIcon`、`ManagementSearchBar`、`ManagementFilterBar`、`ManagementStates`、`DepartmentTreeNavigator`、`flattenDepts` 和 `hasChildren`，优先复用这些能力。

### 2.2 当前页面和数据事实

- `apps/demo/app/src/pages/contacts/index/index.tsx` 把部门树深度展平为 `ListItem`，计算出的 `depth`/层级信息没有渲染；该页同时在 `useEffect` 和 `useDidShow` 首次加载，存在重复请求。
- `contacts/index` 和 `contacts/dept` 使用无 `moduleId` 的 `useRequireAuth()`，没有账号作用域请求保护。
- `pages/profile/login-log/detail/index.tsx` 通过同级 `pages/profile/login-log/handoff.ts` 从列表页内存交接记录；刷新、深链或小程序冷启动无法恢复。
- `packages/core/system-api/src/core/routes/api/v1/app/users/index.ts` 目前只有分页的 `GET /me/login-logs`；`LoginLogRepository` 已有 `findById` 和按用户分页查询，但没有按 `id + user_id` 的详情查询。
- 现有 App 测试目录有 67 个 `.cjs` 文件；仓库已有浏览器套件，页面迁移必须更新真实契约断言，不能通过删除断言来“过绿”。

## 3. 设计原则

### 3.1 页面品类边界

管理列表、详情和表单统一使用 management 家族：

```text
ManagementPage
  ManagementPageHeader
  ManagementFilterBar / ManagementSearchBar
  ManagementList / ManagementCell / ManagementTreeCell
  ManagementStates
```

首页、工作台、登录等卡片型页面保留卡片布局。卡片统一使用 token；卡片内的选择行、搜索框、跳转箭头、错误提示和图标仍必须使用共享原子。

`PageContainer` 保留为通用会话/权限门禁能力。规范页由页面显式调用 `useRequireAuth({ moduleId })`，并使用 `ManagementPage` 作为视觉外壳；同一页面不得再把 `PageContainer` 作为第二个鉴权入口。非规范页在迁移前继续使用 `PageContainer`，直到自身门禁逻辑完成等价迁移。

### 3.2 共享层只收敛真实重复

抽取前必须有至少两处真实调用或一个明确的契约一致性要求。新组件必须有具体业务名称和最小接口，不建立空的 types/constants/hooks/provider 文件。

颜色、间距、圆角、阴影只能引用 `apps/demo/app/src/styles/tokens.scss` 已有 token；本次不建立新主题系统，不升级依赖。

## 4. 实施线 A：基础线

### A1. 页头兼容与迁移

增强 `ManagementPageHeader`，使其能覆盖旧 `PageHeader` 的生产能力：

- `title` 支持 `ReactNode`；
- `subtitle` 支持 `ReactNode`；
- `action` 替代 `right`；
- 增加 `bordered` 和 `className`；
- 保留 H5 的安全区、sticky、返回按钮和左右占位布局；
- 小程序由原生导航栏承载时使用 `showBack={false}`，H5 二级页按页面需要使用 `showBack`。

先迁移 system shared scaffold 和所有生产页面调用，再删除 `molecules/PageHeader` 目录。测试 mock、README 和页面快照同步改为新导出。迁移完成的验收条件是生产源码中不再 import `@/components/molecules` 的 `PageHeader`，且所有旧 props 都有明确映射。

### A2. 鉴权壳和账号作用域

- `PageContainer` 不删除、不改为新的全局 provider；只移除规范页对它的鉴权壳依赖。
- 将 `withAccountScope`、`errorMessage` 迁到 `apps/demo/app/src/utils/account-scope.ts`，保持函数签名和会话版本语义不变；更新 system 页面调用和 `tests/account-scope.test.cjs` 的加载路径。
- 页面请求必须在当前账号作用域内启动；账号切换或 session version 变化时丢弃旧请求结果、草稿和错误状态。
- 页面不得为了迁移引入全局 store；单页状态仍由组件状态和已有 auth/module store 管理。

### A3. 小型原子和契约

只新增以下确有重复的本地原子：

- `PickerRow`：统一选择行的文案、占位、禁用和行尾箭头；箭头由行级元素渲染。
- `DateField`：封装现有 Taro `Picker` 的日期取值和占位，内部复用 `PickerRow` 视觉契约。
- `SurfaceCard`：首页/工作台白色内容块的 token 化容器。
- `MetricCard`：仪表盘指标卡，复用 `SurfaceCard`，只保留指标所需的标题、数值和辅助文案。

“无 hero 页顶距”不得再以三份页面 SCSS 复制；由 `SurfaceCard` 或页面外壳的一个 token 化 modifier 提供。

`ManagementCell` 增加两个可选 prop：

```ts
trailingAction?: ReactNode
selection?: ReactNode
```

渲染顺序固定为：内容 → `tag` 状态列 → `selection` → `trailingAction` → 箭头。动作槽点击必须阻止行点击；`tag` 继续只表达状态，不再承载按钮。`apps/pinned` 的上移/下移迁移到 `trailingAction`。

### A4. 文档和图标

- 修正 `ManagementList.tsx` JSDoc，禁止用 `·` 拼接示例。
- 页面通用操作图标统一使用 `LineIcon`；首页/登录品牌图标可以保留，但必须列入例外并使用 token 颜色。
- 在 `docs/design/mobile-form-spec.md` 增加“卡片型页面”和“H5 页头”两节，内容与本设计的品类边界一致。

## 5. 实施线 B：页面线

### B1. 认证、首页和工作台

- 登录页：使用共享 `Checkbox`；失败信息使用 `FormError`，错误文字 12px、右对齐；禁用态不绘制灰底块；颜色全部改为 token。label 上下堆叠作为唯一登录页例外，原因是 16px 防 iOS 缩放和窄屏标签列宽度。
- 首页：使用 `SurfaceCard`/`MetricCard`；裸 `›` 替换为 `LineIcon`；保留品牌自绘图标但登记例外；复用导航避让 hook。
- 应用页：手写搜索框替换为 `ManagementSearchBar`，筛选入口使用 `ManagementFilterBar`，loading/error/empty 使用 `ManagementStates`。
- `apps/pinned`：动作按钮使用 `trailingAction`，不把按钮放入 `tag`。
- `messages`、`about` 和符合 H5 二级页语义的页面使用增强后的 `ManagementPageHeader`；小程序保留原生导航栏。
- 删除未注册、无引用、无 `index.config.ts` 的 `system/coming-soon` 死代码，并更新路由/测试引用（如存在）。

### B2. 个人中心

- `mine`、`security`：把 `SettingCell`、`SettingGroup`、`DangerAction` 迁到 `ManagementList`/`ManagementCell` 与 `ActionSheet`；保留现有业务动作和权限。
- `profile/edit`、`profile/password`：失败信息改为 `FormError`，成功后关闭/返回并刷新；密码字段复用 `SecretField`，删除 `PasswordRow`。
- `profile/login-log` 列表和详情属于实施线 C 的依赖页面：页面线只迁移共享外壳和筛选视觉，不删除 handoff，直到真实接口客户端可用。

### B3. 通讯录

两页统一迁移到 management 家族：

- 首页使用 `DepartmentTreeNavigator`，通过 `flattenDepts`/`hasChildren` 提供深度、完整路径和展开状态；点击展开箭头只切换展开，点击部门行进入成员页。
- 初始状态仅展开根层；账号切换后清空展开、选中和错误状态。
- 部门成员页使用 `ManagementPageHeader`、`ManagementList`、`ManagementCell` 和 `ManagementStates`。
- 请求只由一个生命周期入口触发：首次展示依赖 auth ready/access，返回页面只在 session 或显式刷新需要时重新加载，不让 `useEffect` 和 `useDidShow` 同时首发同一请求。
- 两页都接入 `withAccountScope`/session version 校验；旧账号请求完成后不得写入新账号页面。
- 删除 `dept__initial` 等死样式。

### B4. 示例页和 system 基准尾巴

- demo 六页移除对 `pages/system/_shared/AdminUI` 的反向依赖，改用公开 management/feedback/form 组件；health、quickstart、region 文件头明确“组件演示，非页面样板”。
- health 删除重复的内存指标和一行多属性；region 统一 `FormSection`/`DetailRow` 语义；quickstart/region 删除重复 `.content` 和错误注释。
- `dict/items`、`role/RoleEditor`、`dept/DepartmentForm` 移除遗留 `AdminPage`/`AdminSelect`/`AdminNotice`。
- 修复 `system/position/form` 中 `FormField.disabled` 未向控件透传的问题；补充回归断言。

## 6. 实施线 C：登录日志接口和详情页

### C1. API 契约

在 `packages/core/system-api` 增加只读接口：

```text
GET /api/v1/app/users/me/login-logs/:id
operationId: appGetMyLoginLog
permission: PERMS.LIST_MY_LOGINS
response: sysLoginLogDetailResp#
```

路由 schema 必须显式声明：

- `params.id` 为正整数 TypeBox 参数；
- 401/403/业务错误沿用当前 route registrar 的统一错误响应；
- 200 响应复用现有 `sysLoginLogDetailResp#`。

Repository 增加 `findByIdForUser(id: number, userId: number)`，SQL 同时限制 `id`、`user_id` 和 `deleted_at IS NULL`。Service 增加：

```ts
getMyLoginLogById(userId: number, id: number): Promise<SysLoginLogResp>
```

不存在、被软删除或属于其他用户时统一抛 `SystemManageErrorCode.LOGIN_LOG_NOT_FOUND`，不泄露记录是否存在。

### C2. OpenAPI 和客户端

接口实现后按仓库流程：

1. 运行 `pnpm --filter @yishan/demo-api openapi:dump`；
2. 同步 `apps/demo/api/openapi.json` 和 `docs/architecture/api-v1-runtime-openapi.json`；
3. 在 `apps/demo/app/src/api/user.ts` 增加手写 API 方法，并在 `apps/demo/app/src/api/types.ts` 复用或补充响应类型；
4. 运行 `pnpm check:openapi`：它只比对 `HEAD:` 与工作区的两份 JSON 产物，不读 `src/api`，所以确认不了手写 client 的 method/path/query。App 手写 client 的路径由 client-path 测试固定（见 `apps/demo/app/tests/organization.test.cjs`）。

本 App 当前使用手写 API client，不生成新的 App 客户端；不得把 admin 端生成 client 的实现复制到 App，也不得新增数据库迁移。

### C3. App 数据流

`pages/profile/login-log/detail/index.tsx` 改为按路由 `id` 调客户端请求，提供 loading、error、retry 和账号切换保护。成功后继续使用现有 `DetailHero`/`DetailSection`/`DetailRow` 展示；失败时显示统一错误态和返回入口。

删除 `pages/profile/login-log/handoff.ts` 及列表页 `rememberLoginLog` 调用。列表页筛选区、状态/排序/时间范围行为与 system 登录日志列表保持一致，并使用已有的 `useListPagination`。

## 7. 测试与验收

### 7.1 基础线

- 页面头兼容测试：`action`、`subtitle`、`bordered`、`className`、H5 返回和小程序隐藏返回。
- `account-scope` 测试保持现有 session version 语义。
- `PickerRow`/`DateField` 测试占位、取值、禁用和箭头。
- `ManagementCell` 测试 `tag`、`selection`、`trailingAction` 的顺序及点击冒泡。

### 7.2 页面线

更新并保留现有 67 个 App `.cjs` 测试和浏览器套件，重点覆盖：

- `home.test.cjs`、`login.test.cjs`、`home-apps.test.cjs`；
- `contacts-dept.test.cjs`、`dept-tree.test.cjs`、新增账号切换和单次请求断言；
- `demo-pages.test.cjs`、`profile-forms.test.cjs`、`profile-sections.test.cjs`；
- 页面头迁移后不再 mock 旧 `PageHeader` 生产导入。

浏览器检查至少覆盖 H5 320px/390px：登录失败、应用搜索/筛选、通讯录展开、个人中心表单错误、登录日志列表和详情。

### 7.3 接口线

Vitest 覆盖 `getMyLoginLogById` 的：

1. 当前用户命中；
2. 不存在/软删除；
3. 他人记录统一 NOT_FOUND。

路由测试覆盖参数校验、权限点和响应 schema；OpenAPI 检查确认路径、operationId、客户端方法和类型同步。

### 7.4 质量门

基础线和页面线每个交付单元运行：

```bash
pnpm typecheck:mobile
pnpm --filter @yishan/demo-app test
pnpm build:app
pnpm check:taro
pnpm check:boundaries
```

接口线额外运行：

```bash
pnpm test:api
pnpm check:openapi
pnpm test:integration
```

不做真机验收，不操作线上数据；H5 浏览器检查使用隔离测试接口。

## 8. 明确不做和例外

不做：

- 不重设计首页/工作台布局；
- 不修改 system 页面业务权限和交互语义；
- 不引入新依赖、主题系统、数据库表或迁移；
- 不把 `PageContainer` 删除或改造成全局 provider；
- 不把组件演示页当作新的业务页面模板；
- 不用测试删除或放宽来掩盖实现回归。

必须在 PR 描述登记的例外：

| 例外 | 理由 |
|---|---|
| 登录页 label 上下堆叠 | 16px 防 iOS 缩放，窄屏下固定标签列不足以横向布局 |
| 首页/登录品牌自绘图标 | 品牌识别需要；颜色必须走 token，不形成第二套通用图标系统 |
| 首页/工作台卡片圆角和阴影 | 卡片型品类需要，但值必须来自 token |
| `apps/pinned` 不显示箭头 | 行点击打开 ActionSheet，右侧动作槽已占满 |

## 9. 完成判定

三条实施线分别满足以下条件后才视为完成：

- 基础线：生产源码没有旧 `PageHeader` import；`PageContainer`/`ManagementPage` 职责边界在代码和文档中一致；共享组件契约测试通过。
- 页面线：目标页面不再使用被替换的旧组件或重复样式；通讯录层级、账号切换和请求次数符合测试；H5 窄屏检查通过。
- 接口线：新路径在运行时 OpenAPI、Demo OpenAPI 和 App 手写 client 三处一致；详情页刷新、深链、冷启动都能从服务端恢复；越权记录不可见且不泄露存在性。

三条线分别按对应实施计划交付；在计划执行前不开始代码实现。
