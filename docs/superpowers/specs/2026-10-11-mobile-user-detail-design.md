# 移动端用户详情 / 部门选择 重构设计

日期：2026-10-11
范围：`apps/demo/app`（Taro 4 小程序 / H5）

## 1. 问题

用户详情页与编辑页是 PC 表单结构直接搬到移动端的结果：

- **信息卡片过多**：5 个 `DetailSection` 各自是独立的白色圆角卡片，卡与卡之间还有灰色间隙。
- **字段展示松散**：组织归属摘要（角色名串 + 部门名串）挤在头部 footnote，部门在「组织信息」里以整串文字出现，看不出层级和数量。
- **Tag 堆叠**：编辑页把部门树 `flatten()` 成一维数组，用一排平铺 Tag 表示多选；角色同理。层级信息完全丢失，部门一多就横向溢出。

目标：重排信息架构，让详情页符合企业级 SaaS 移动端规范（裸排版头部 + 扁平分组列表），并新增一个层级导航式的部门选择二级页。

## 2. 范围

| 页面 | 处置 |
|---|---|
| `pages/system/user/detail` | 重写：契约驱动的分组列表 |
| `pages/system/user/edit` | 重写：契约驱动的表单，Tag 堆叠换成跳转行 |
| `pages/system/user/departments` | **新增**：层级导航部门选择页 |
| `pages/system/user/roles` | **新增**：列表式角色选择页 |
| `pages/system/role/detail` | 样式连带变更（共用 `DetailSection`） |

不含：后端接口变更、新增共享包组件、PC 端改造。

## 3. 核心决策

### 3.1 设计规范：借 shadcn 理念，不借技术栈

shadcn/ui 依赖 Tailwind + Radix + DOM，小程序端无法运行。沿用项目现有 `@yishan/ui/mobile` 的 SCSS token 体系（`packages/ui/mobile/tokens.scss`，钉钉蓝 `#1677FF`，8 网格间距，克制低圆角），实现 shadcn 的视觉语言：低饱和中性色、1px 分隔线列表代替卡片阴影、单一强调色、清晰层级。

### 3.2 不新建 `UserProfileHeader` / `InfoList` / `InfoListItem`

第一性原理审查结论：这三个组件与现有的 `DetailHero` / `DetailSection` / `DetailRow` 是同一个东西。

`DetailHero` 当前调用：

```tsx
<DetailHero avatar={...} title={realName} tag={<Tag>启用</Tag>}
           note={genderName} subtitle={`@${username}`} footnote={组织归属摘要} />
```

新头部要求（头像 / 姓名 / 用户名 / 状态）与现状的差别只是**少传 `note` 和 `footnote`**，样式完全相同。`InfoList` / `InfoListItem` 则是 `DetailSection` / `DetailRow` 在「去掉白卡外壳」后的形态。

因此本次改动是**重做 3 个既有组件的样式**，而不是新增 6 个组件。副作用是 `role/detail` 自动获得一致的扁平风格，无需保留旧 variant。

### 3.3 详情页视觉：去掉白卡，改为贴边扁平列表

```scss
/* 现状 —— 每组一张白卡 */
.hero, .section {
  background: var(--color-bg-surface);
  border-radius: var(--radius-xl);
}

/* 改后 —— 页面 body 一整张贴边白底列表，分组间只有灰色小标题 */
.section {
  margin-bottom: var(--space-6);
}
.section__title {
  padding: 0 var(--space-4) var(--space-2);
  font-size: var(--font-size-13);
  color: var(--color-text-tertiary);
}
```

`DetailHero` 同步改为裸排版（无白底、无圆角），大头像直接落在页面底色上。

## 4. 组件改动

### 4.1 重做：`components/management/DetailLayout.tsx`

| 组件 | 改动 |
|---|---|
| `DetailHero` | 样式：去白卡，裸排版。props 不变。 |
| `DetailSection` | 样式：白卡 → 扁平分组标题。新增 `collapsible?: boolean` + `defaultCollapsed?: boolean`。 |
| `DetailRow` | 样式：贴边列表行。新增 `showArrow?: boolean`、`onClick?: () => void`、`tone?: 'default' \| 'muted'`（用于「未设置」弱化）。 |

`DetailGroupList` 不动。

### 4.2 新增：`components/management/OrganizationPicker.tsx`

部门 / 角色共用的跳转行。

```tsx
interface OrganizationPickerProps {
  label: string
  /** 已选项 ID */
  ids: number[]
  /** id → 名称 的解析结果 */
  names: Map<number, string>
  /** 无权限时整行不渲染 */
  visible: boolean
  onPress: () => void
}
```

渲染：`label` 左对齐，右侧显示**前 2 个名称 + `等 N 个`**（或 `未设置`），末尾 `›`。

`ids` 为空时 `tone='muted'`。

### 4.3 新增：`components/management/DepartmentTreeNavigator.tsx`

纯展示 + 回调，**不 fetch、不持有选中态**。

```tsx
interface DepartmentTreeNavigatorProps {
  /** 当前层的子节点 */
  nodes: AdminDept[]
  /** 从根到当前节点的路径，含名称 */
  path: { id: number; name: string }[]
  selectedIds: ReadonlySet<number>
  /** 需要高亮的节点（搜索跳转后） */
  highlightId?: number | null
  onEnter: (node: AdminDept) => void
  onToggle: (id: number) => void
}
```

- 面包屑渲染 `path`，点击任一级回跳该层
- `node.children?.length` → 有子节点：渲染 `›`，点击 `onEnter`
- 无子节点：渲染 checkbox，点击 `onToggle`

可复用性：部门管理页「选择上级部门」可直接复用同一组件（`selectedIds` 传单选的高亮项，`onToggle` 改为 `onSelect`）。

### 4.4 新增：`components/management/SelectionFooter.tsx`

```tsx
interface SelectionFooterProps {
  count: number
  unit: string          // '个部门' | '个角色'
  onCancel: () => void
  onConfirm: () => void
  disabled?: boolean
}
```

固定底部，`padding-bottom: var(--safe-area-bottom)`。左侧「已选择 N 个部门」可点击展开已选清单 BottomSheet；右侧取消 / 确定。

### 4.5 新增：`stores/selectionDraft.ts`

模块级 zustand，形状：

```ts
interface SelectionDraftState {
  drafts: Record<string, number[]>
  readDraft: (key: string) => number[] | undefined
  writeDraft: (key: string, ids: number[]) => void
  consumeDraft: (key: string) => number[] | undefined
  reset: () => void
}
```

沿用 `stores/modules.ts` 的既有约定：**`ownerId` 身份隔离**（草稿按当前登录用户 id 分桶，切换账号读不到别人的草稿）+ `reset()` 在登出时随 auth 一并清空。

草稿只在选择页 `[确定]` 时写；`[取消]` 不写。`consumeDraft` 读后立即删除。

## 5. 数据流

### 5.1 契约

`pages/system/user/profileSections.ts` —— 纯数据，无 JSX，无请求。

```ts
export type ProfileField =
  | { key: string; label: string; kind: 'text';   value: string; editable: boolean }
  | { key: string; label: string; kind: 'date';   value: string; editable: boolean }
  | { key: string; label: string; kind: 'secret'; value: string }
  | { key: string; label: string; kind: 'enum';   value: string; options: readonly string[] }
  | { key: string; label: string; kind: 'org';    ids: number[]; names: Map<number, string>
      /** 跳转目标；详情页只渲染箭头，编辑页触发 navigateTo */
      target: 'departments' | 'roles'; visible: boolean }

export interface ProfileSection { key: string; title: string; fields: ProfileField[] }
```

分组与字段：

| 分组 | 字段 | readonly | editable |
|---|---|---|---|
| 基础信息 | 用户名、真实姓名、昵称 | ✓ | ✓ |
| 联系方式 | 手机号、邮箱 | ✓ | ✓ |
| 安全设置 | 密码（打码）、登录方式 | ✓ | **只读** |
| 组织关系 | 所属部门、角色 | ✓ 跳转 | ✓ 跳转 |
| 状态 | 启用状态 | ✓ | ✓（`SegmentField`） |
| 其他属性 | 性别、出生日期 | ✓ | ✓ |

共 6 组。详情页自上而下渲染前 5 组，第 6 组（其他属性）排在「账号记录」之前。

密码 / 登录方式在编辑页**只读展示**，不承担修改；重置密码仍走列表页长按菜单。

### 5.2 编辑页 ↔ 选择页

```
编辑页 useDidShow
  └─> consumeDraft('user-depts')  ──无草稿──> 保持表单原值
       └─> 合并进 useUserEditForm 的 deptIds

选择页初始选中
  └─> readDraft('user-depts') ?? URL ?ids= 解析结果

[确定] ──> writeDraft('user-depts', ids) ──> navigateBack()
[取消] ──> 不写草稿 ──> navigateBack()
```

草稿优先级高于 URL：`?ids=` 让选择页在无草稿时也能独立打开（深链入口）。

### 5.3 数据源

- 部门：`adminDeptApi.getAdminDeptTree()` —— 已在编辑页现成使用，一次性拿全树，**不新增后端接口**。搜索与导航均在内存完成。
- 角色：`adminRoleApi.listAdminRoles()` 分页拉全量 —— 现有逻辑不变。
- 名称解析：详情页现有「逐 ID 发请求」逻辑保留（N 个 ID = N 个请求），`names` Map 由它填充，编辑页可复用同一 hook。

## 6. 页面规格

### 6.1 部门选择页 `pages/system/user/departments/index`

```
┌─────────────────────────────┐
│  ‹  选择部门                │  navigationStyle: 'custom'，只有返回
├─────────────────────────────┤
│  🔍 搜索部门名称              │  客户端过滤全量树
├─────────────────────────────┤
│  上海总公司 ›                 │  面包屑，可点任一级回跳
│  ────────────────────────    │
│  ☐ 研发部门              › │  有子节点 → 进入层级
│  ☑ 市场部门                │  叶子 → 勾选
│  ☐ 上海分公司 ›    │
└─────────────────────────────┘
│  已选择 3 个      [取消] [确定] │  SelectionFooter
└─────────────────────────────┘
```

**选择语义**：任意层级均可选（含父部门）。这是**能力保持**——现有编辑页 flatten 后能选任意节点，若限制为仅叶子会造成功能回退。有子节点与叶子用不同图标区分。

**搜索**：输入后列表切换为扁平路径结果 `上海总公司 › 研发部门`。点击结果 → 跳转至该节点所在层级、面包屑同步、目标行高亮 2 秒。**不在搜索态直接勾选**，避免搜索态与浏览态行为不一致导致误选。

**已选可见性**：底部「已选择 N 个部门」可点击，向上展开 BottomSheet 列出全部已选项（每项带完整路径），支持单个取消。解决已选项散落不同分支时不可见的问题。

### 6.2 角色选择页 `pages/system/user/roles/index`

同骨架，去掉面包屑，主体是角色列表（字母/拼音分组暂不做）。复用 `SelectionFooter` 与 `selectionDraft`，key 为 `user-roles`。

### 6.3 详情页

- `DetailHero` 去掉 `note`（性别）与 `footnote`（组织归属摘要）
- 6 个契约分组依次渲染 `DetailSection`
- org 字段渲染为带 `›` 的 `DetailRow`，点击进入选择页的**只读模式**（见下）
- 「账号记录」（用户ID / 最后登录 / 登录次数 / 创建人 / 登录IP / 创建时间 / 更新人 / 更新时间）降级为底部**默认收起**的 `DetailSection`，标题 `账号记录 ›`
- 底部 `BottomActionBar` 保持现有三项：编辑 / 禁用启用 / 删除

**选择页的两种模式**：URL 携带 `?mode=readonly` 时，checkbox 变为不可点、面包屑与搜索照常、`SelectionFooter` 的取消/确定替换为单个「完成」按钮。详情页跳转时带 `mode=readonly&ids=<该用户已选>` 且**不写草稿**，避免只读浏览污染编辑草稿。

### 6.4 编辑页

由同一份契约以 `mode='editable'` 驱动：

- `text` → `TextField`
- `date` → `<Picker mode="date">` + `FormField`
- `enum`（性别 / 状态）→ `SegmentField` 分段控件，**替换现有 `Taro.showActionSheet`**（3 个选项无需弹层；角色表单页已在用 `SegmentField`）
- `secret` → `FormField` 只读，密码打码为 `••••••••`
- `org` → `OrganizationPicker` 跳转行
- 提交：`FormSubmitBar`，payload 一次性带 `deptIds` / `roleIds` 数组

**顺带清理**：
- 删除 `edit/constants.ts` 中 `GENDER_OPTIONS` / `STATUS_OPTIONS` —— 无人引用，且顺序与 `useUserEditForm.ts` 实际使用相反（`['启用','禁用','锁定']` vs `['禁用','启用','锁定']`；`['未知','男','女']` vs `['保密','男','女']`）。选项来源收敛到契约一处。
- 删除 `edit/index.module.scss` 中未被引用的 `.edit` / `.edit__chip` / `.edit__chip--active` / `.edit__chipText` 死样式。

### 6.5 路由登记

Taro 静态路由（编译期），三处必须同步，漏一处会导致守卫使用模块默认权限：

```ts
// constants/page-config.ts
pages: [
  // ...
  'pages/system/user/departments/index',
  'pages/system/user/roles/index',
]

// constants/routes.ts
export const SYSTEM_PAGES = {
  // ...
  userDepartments: 'pages/system/user/departments/index',
  userRoles: 'pages/system/user/roles/index',
} as const

// modules/registry.ts
const SECONDARY_MODULE_PAGES = {
  // ...
  'pages/system/user/departments/index': { moduleId: 'system-user', editUser: true },
  'pages/system/user/roles/index': { moduleId: 'system-user', editUser: true },
}
```

各页面目录下新增 `index.config.ts`，`navigationStyle: 'custom'`。

## 7. 错误处理

| 场景 | 处理 |
|---|---|
| 部门树加载失败 | `StateView kind="error"` + 重试，与列表页一致 |
| 无 `system:department:list` 权限 | `PermissionDenied`；`OrganizationPicker` 整行不渲染 |
| 无 `system:role:list` 权限 | 同上，角色行不渲染 |
| 部门 ID 解析不出名称 | 现有逻辑：拼 `名称暂不可用`，保留 |
| 草稿残留 | 草稿仅在选择页 `[确定]` 时写，仅存 ids 不存表单数据；用户放弃编辑直接退出，表单 state 随页面销毁，无残留 |

## 8. 测试

`pnpm --filter @yishan/demo-app test`

- `profileSections` 纯函数：字段顺序、空值占位文案、org 字段在 readonly / editable 两态的降级规则
- `selectionDraft`：ownerId 隔离（切换账号读不到旧草稿）、`writeDraft` → `consumeDraft` 往返、`consumeDraft` 后自动清空、`reset()`
- `DepartmentTreeNavigator`：路径拼接、面包屑回跳、有子节点触发 `onEnter`、叶子触发 `onToggle`、`highlightId` 渲染
- 详情页快照：「账号记录」默认收起、org 行渲染 `›`、`DetailHero` 不再传 note/footnote

## 9. 验证命令

```bash
pnpm --filter @yishan/demo-app test
pnpm typecheck:mobile
pnpm check:taro
pnpm build:app
pnpm lint
```

Admin 侧不消费本 spec 涉及的任何文件，回归只需确认 `pnpm lint` 全绿。

## 10. 不做的事

- 不改 `packages/ui/mobile` —— 该包只收 atoms + feedback，`InfoList` 一类组合组件明文属产品层
- 不新增后端接口
- 不做 PC 端改造（本次明确不涉及）
- 不做角色列表的拼音分组 / 字母索引
- 不做部门树的懒加载（全量树已在内存，一次 `getAdminDeptTree`）