# 移动端用户详情 / 部门选择 重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重排移动端用户详情/编辑页的信息架构（去掉白卡、改为贴边扁平列表），并新增层级导航式的部门/角色选择二级页，替换编辑页的平铺 Tag 堆叠。

**Architecture:** 一份纯数据的字段契约 `profileSections.ts` 同时驱动详情页（只读）与编辑页（可编辑）两个渲染模式。三个新组件（`OrganizationPicker` / `DepartmentTreeNavigator` / `SelectionFooter`）加一个模块级 `selectionDraft` store 承担跨页面选择态传递。既有 `DetailHero` / `DetailSection` / `DetailRow` 原地重做样式而非新增平行组件，因此 `role/detail` 随之获得一致风格。

**Tech Stack:** Taro 4 + React 18 + zustand 5 + CSS Modules；测试用 Node 内置 `node --test`（**不是 Jest**）+ 自研 `tests/helpers/load-ts.cjs` 转译器。

**Spec:** `docs/superpowers/specs/2026-10-11-mobile-user-detail-design.md`

## Global Constraints

- **测试运行器是 `node --test tests/*.test.cjs`，不是 Jest。** 新测试必须是 `.cjs`，用 `require('node:test')` + `require('node:assert/strict')`。不要引入 `@testing-library/react`、`jsdom`、或任何新依赖。
- **所有测试文件必须落在 `apps/demo/app/tests/` 且以 `.test.cjs` 结尾**，否则 `pnpm --filter @yishan/demo-app test` 不会拾取。
- **`loadTs` 无法加载 `.scss`。** 任何加载 TSX 的测试都必须显式 mock 其 `.module.scss` import，用 `new Proxy({}, { get: (_, key) => key })`。
- **SCSS 一律用 `var(--token)` 引用 token**，不得写死色值/间距。token 清单见 `packages/ui/mobile/tokens.scss`。
- **Taro 静态路由：新增页面必须三处同步登记** —— `src/constants/page-config.ts`、`src/constants/routes.ts`、`src/modules/registry.ts` 的 `SECONDARY_MODULE_PAGES`。漏 `registry.ts` 会导致守卫回落到模块默认权限。
- **权限 perm 常量**：`system:user:*`（用户）、`system:role:*`（角色）、`system:department:*`（部门）。无权限时对应的 `OrganizationPicker` / `DetailRow` **整行不渲染**，不是置灰。
- **不得修改 `packages/ui/mobile`。** 该包只收 atoms + feedback，组合组件属产品层。
- **不得新增后端接口。** 部门树用现有的 `adminDeptApi.getAdminDeptTree()`，角色用 `adminRoleApi.listAdminRoles()`。
- **提交信息用 Conventional Commits**（`feat:` / `fix:` / `refactor:` / `test:` / `chore:`）。

## Review Focus

以下五类输入/条件 spec 要求了行为、但没有任务会自然覆盖。每个都在下面对应任务里补了测试。

1. **部门树为 `null` 或 `children` 为 `null`** —— `AdminDept.children` 类型是 `AdminDept[] | null`，`getAdminDeptTree()` 在空库时可能返回 `[]`。导航器必须把 `null` 当空数组处理，不能崩。见 Task 5。
2. **选择页在「新建用户」时进入（用户尚未创建）** —— 此时没有用户 ID，`?ids=` 为空、草稿也为空，必须渲染出「未选择任何部门」的空态而不是崩溃。见 Task 7。
3. **详情页进入部门选择页的只读模式不能写草稿** —— 否则用户只是浏览了一下，编辑页的草稿就被 `?ids=` 覆盖。见 Task 7。
4. **登出后残留的选择草稿** —— `reset()` 未在登出路径调用时，下一个登录账号会读到上一个账号的部门选择。见 Task 1。
5. **部门 ID 在详情页解析不出名称** —— 现有逻辑会拼一个「名称暂不可用」；`OrganizationPicker` 显示 `等 N 个` 时若只有名称解析失败，会渲染成 `、名称暂不可用` 之类的破碎文案。见 Task 4。

---

## File Structure

**新建**
| 路径 | 职责 |
|---|---|
| `apps/demo/app/src/stores/selectionDraft.ts` | 跨页面的选择暂存，带 ownerId 隔离。无 React、无请求。 |
| `apps/demo/app/src/components/management/OrganizationPicker.tsx` | 「已选 N 项 ›」跳转行。无状态。 |
| `apps/demo/app/src/components/management/OrganizationPicker.module.scss` | 上述样式。 |
| `apps/demo/app/src/components/management/deptTree.ts` | 部门树纯函数：路径查找、扁平化搜索、已选项路径解析。无 React。 |
| `apps/demo/app/src/components/management/DepartmentTreeNavigator.tsx` | 面包屑 + 当前层列表。纯展示 + 回调。 |
| `apps/demo/app/src/components/management/DepartmentTreeNavigator.module.scss` | 上述样式。 |
| `apps/demo/app/src/components/management/SelectionFooter.tsx` | 底部固定操作条 + 已选清单展开。 |
| `apps/demo/app/src/components/management/SelectionFooter.module.scss` | 上述样式。 |
| `apps/demo/app/src/pages/system/user/profileSections.ts` | 字段契约 + `buildProfileSections()` 纯函数。无 JSX。 |
| `apps/demo/app/src/pages/system/user/departments/index.tsx` | 部门层级导航选择页。 |
| `apps/demo/app/src/pages/system/user/departments/index.config.ts` | 页面导航配置。 |
| `apps/demo/app/src/pages/system/user/departments/index.module.scss` | 页面样式。 |
| `apps/demo/app/src/pages/system/user/roles/index.tsx` | 角色列表选择页。 |
| `apps/demo/app/src/pages/system/user/roles/index.config.ts` | 页面导航配置。 |
| `apps/demo/app/src/pages/system/user/roles/index.module.scss` | 页面样式。 |
| `apps/demo/app/tests/selection-draft.test.cjs` | store 测试。 |
| `apps/demo/app/tests/detail-layout.test.cjs` | DetailLayout 结构测试。 |
| `apps/demo/app/tests/profile-sections.test.cjs` | 契约测试。 |
| `apps/demo/app/tests/dept-tree.test.cjs` | 部门树纯函数 + 导航器测试。 |
| `apps/demo/app/tests/user-departments-page.test.cjs` | 部门选择页测试。 |
| `apps/demo/app/tests/user-roles-page.test.cjs` | 角色选择页测试。 |

**修改**
| 路径 | 改动 |
|---|---|
| `src/components/management/DetailLayout.tsx` | `DetailSection` 结构改为 title 在白底外；`DetailRow` 加 `showArrow` / `onClick` / `tone`。 |
| `src/components/management/DetailLayout.module.scss` | 去白卡：hero 裸排版，section 全出血贴边，title 灰字在页面底色上。 |
| `src/components/management/index.ts` | 导出 3 个新组件 + 类型。 |
| `src/constants/page-config.ts` | 注册 2 个新页面。 |
| `src/constants/routes.ts` | `SYSTEM_PAGES` 加 2 项。 |
| `src/modules/registry.ts` | `SECONDARY_MODULE_PAGES` 加 2 项。 |
| `src/pages/system/user/detail/index.tsx` | 按契约重写；`DetailHero` 去掉 note/footnote。 |
| `src/pages/system/user/edit/index.tsx` | 按契约重写；Tag chips 换成 `OrganizationPicker`。 |
| `src/pages/system/user/edit/index.module.scss` | 删除死样式。 |
| `src/pages/system/user/edit/constants.ts` | 删除顺序错误且无人引用的 options。 |
| `src/pages/system/user/edit/hooks/useUserEditForm.ts` | `useDidShow` 消费草稿；移除 `toggleDept` / `toggleRole`。 |
| `tests/user-detail.test.cjs` | 更新 mock 与断言。 |
| `tests/user-form.test.cjs` | 新增编辑页契约渲染断言。 |

---

## Task 1: `selectionDraft` store

**Files:**
- Create: `apps/demo/app/src/stores/selectionDraft.ts`
- Test: `apps/demo/app/tests/selection-draft.test.cjs`

**Interfaces:**
- Consumes: `useAuthStore` from `@/stores/auth` —— **在每次读写时通过 `useAuthStore.getState()` 现读当前用户 id 作为分桶 key**，而不是依赖调用方在某处调用 `setOwner()`。这样「登出后草稿不泄漏」由构造保证，不依赖任何一处容易漏掉的登出钩子（Review Focus #4）。
- Produces:
  ```ts
  export const DRAFT_KEYS = {
    userDepts: 'user-depts',
    userRoles: 'user-roles',
  } as const
  export type DraftKey = (typeof DRAFT_KEYS)[keyof typeof DRAFT_KEYS]
  export interface SelectionDraftState {
    /** ownerKey → draftKey → ids */
    drafts: Record<string, Record<string, number[]>>
    readDraft: (key: string) => number[]
    writeDraft: (key: string, ids: number[]) => void
    consumeDraft: (key: string) => number[] | undefined
    reset: () => void
  }
  export const useSelectionDraft: UseBoundStore<StoreApi<SelectionDraftState>>
  ```
  约定：`readDraft` 永远返回数组（无草稿返回 `[]`）；`consumeDraft` 无草稿返回 `undefined`、有草稿返回数组并**立即删除**。

- [ ] **Step 1: 写失败测试**

创建 `apps/demo/app/tests/selection-draft.test.cjs`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

// auth 身份可变的 mock：切换 auth.user.id 即可模拟登录另一个账号
function load() {
  const auth = { user: { id: 1 } }
  const store = loadTs('src/stores/selectionDraft.ts', {
    zustand: require('zustand'),
    './auth': {
      useAuthStore: Object.assign(
        (selector) => selector(auth),
        { getState: () => auth },
      ),
    },
  }).useSelectionDraft
  return { store, auth }
}

test('writeDraft 后 readDraft 返回写入的 ids', () => {
  const { store } = load()
  store.getState().writeDraft('user-depts', [48, 52])
  assert.deepEqual(store.getState().readDraft('user-depts'), [48, 52])
})

test('readDraft 在无草稿时返回空数组而不是 undefined', () => {
  const { store } = load()
  assert.deepEqual(store.getState().readDraft('user-roles'), [])
})

test('consumeDraft 读后清空，二次读取返回 undefined', () => {
  const { store } = load()
  store.getState().writeDraft('user-depts', [48])
  assert.deepEqual(store.getState().consumeDraft('user-depts'), [48])
  assert.equal(store.getState().consumeDraft('user-depts'), undefined)
})

test('不同 key 的草稿互不干扰', () => {
  const { store } = load()
  const s = store.getState()
  s.writeDraft('user-depts', [48])
  s.writeDraft('user-roles', [37])
  assert.deepEqual(store.getState().consumeDraft('user-depts'), [48])
  assert.deepEqual(store.getState().consumeDraft('user-roles'), [37])
})

test('切换账号后读不到上一个账号的草稿（Review Focus #4）', () => {
  const { store, auth } = load()
  store.getState().writeDraft('user-depts', [48])
  auth.user = { id: 2 }
  assert.deepEqual(store.getState().readDraft('user-depts'), [])
})

test('登出（user 为 null）后读不到任何账号的草稿（Review Focus #4）', () => {
  const { store, auth } = load()
  store.getState().writeDraft('user-depts', [48])
  auth.user = null
  assert.deepEqual(store.getState().readDraft('user-depts'), [])
})

test('切回原账号仍能读回自己的草稿', () => {
  const { store, auth } = load()
  store.getState().writeDraft('user-depts', [48])
  auth.user = { id: 2 }
  store.getState().writeDraft('user-depts', [99])
  auth.user = { id: 1 }
  assert.deepEqual(store.getState().readDraft('user-depts'), [48])
})

test('reset 清空全部账号的草稿', () => {
  const { store } = load()
  store.getState().writeDraft('user-depts', [48])
  store.getState().reset()
  assert.deepEqual(store.getState().readDraft('user-depts'), [])
})

test('writeDraft 去重并剔除非法值', () => {
  const { store } = load()
  store.getState().writeDraft('user-depts', [48, 48, NaN, 'x', null, 52])
  assert.deepEqual(store.getState().readDraft('user-depts'), [48, 52])
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && pnpm test 2>&1 | grep -A3 "selection-draft"
```

Expected: FAIL —— `Cannot find module 'src/stores/selectionDraft.ts'`（文件还不存在）。

- [ ] **Step 3: 实现 store**

创建 `apps/demo/app/src/stores/selectionDraft.ts`：

```ts
import { create } from 'zustand'

import { useAuthStore } from './auth'

/** 选择草稿的 key。跨页面传递多选结果时以此分桶。 */
export const DRAFT_KEYS = {
  userDepts: 'user-depts',
  userRoles: 'user-roles',
} as const

export type DraftKey = (typeof DRAFT_KEYS)[keyof typeof DRAFT_KEYS]

export interface SelectionDraftState {
  /** ownerKey → draftKey → ids */
  drafts: Record<string, Record<string, number[]>>
  readDraft: (key: string) => number[]
  writeDraft: (key: string, ids: number[]) => void
  consumeDraft: (key: string) => number[] | undefined
  reset: () => void
}

/**
 * 现读当前登录身份作为分桶 key。登出时 user 为 null，落到 anon 桶，
 * 因此天然读不到上一个账号的草稿 —— 不依赖任何登出钩子。
 */
function ownerKey(): string {
  const id = useAuthStore.getState()?.user?.id
  return id === undefined || id === null ? 'anon' : `u${id}`
}

function sanitize(ids: readonly number[]): number[] {
  return [...new Set(ids.filter((id): id is number => typeof id === 'number' && Number.isInteger(id)))]
}

export const useSelectionDraft = create<SelectionDraftState>((set, get) => ({
  drafts: {},

  readDraft: (key) => get().drafts[ownerKey()]?.[key] ?? [],

  writeDraft: (key, ids) =>
    set((state) => {
      const owner = ownerKey()
      return {
        drafts: {
          ...state.drafts,
          [owner]: { ...state.drafts[owner], [key]: sanitize(ids) },
        },
      }
    }),

  // 读后即删：编辑页消费一次后草稿不复存在
  consumeDraft: (key) => {
    const owner = ownerKey()
    const found = get().drafts[owner]?.[key]
    if (found === undefined) return undefined
    set((state) => {
      const nextOwner = { ...state.drafts[owner] }
      delete nextOwner[key]
      return { drafts: { ...state.drafts, [owner]: nextOwner } }
    })
    return found
  },

  reset: () => set({ drafts: {} }),
}))
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/demo/app && pnpm test 2>&1 | tail -20
```

Expected: 10 个新测试全 PASS，其余 22 个既有测试文件不受影响。

- [ ] **Step 5: 提交**

```bash
git add apps/demo/app/src/stores/selectionDraft.ts apps/demo/app/tests/selection-draft.test.cjs
git commit -m "feat(app): add ownerId-isolated selectionDraft store for cross-page multi-select"
```

---

## Task 2: `DetailLayout` 样式重做

**Files:**
- Modify: `apps/demo/app/src/components/management/DetailLayout.tsx`
- Modify: `apps/demo/app/src/components/management/DetailLayout.module.scss`
- Test: `apps/demo/app/tests/detail-layout.test.cjs`

**Interfaces:**
- Consumes: 无（Task 1 的 store 不参与）
- Produces:
  ```ts
  // DetailHero props 不变
  export interface DetailSectionProps {
    title: string
    children: ReactNode
    className?: string
    /** 可折叠分组，标题右侧带 chevronDown，默认收起 */
    collapsible?: boolean
    defaultCollapsed?: boolean
  }
  export function DetailSection(props: DetailSectionProps): JSX.Element

  export interface DetailRowProps {
    label: string
    value?: string | number | ReactNode
    /** 右侧渲染 chevronRight，并使整行可点 */
    showArrow?: boolean
    onClick?: () => void
    /** 'muted' 时值文字弱化（未设置态） */
    tone?: 'default' | 'muted'
  }
  export function DetailRow(props: DetailRowProps): JSX.Element
  ```

**注意：`DetailGroupList` 不改动。`DetailSection` 的 props 只增不减，`role/detail` 无需改任何一行调用代码。**

- [ ] **Step 1: 写失败测试**

创建 `apps/demo/app/tests/detail-layout.test.cjs`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function load() {
  return loadTs('src/components/management/DetailLayout.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text', Input: 'Input', Textarea: 'Textarea' },
    '@/components/atoms': { Avatar: 'Avatar', Tag: 'Tag' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './DetailLayout.module.scss': new Proxy({}, { get: (_, key) => key }),
  })
}

function find(node, pred, out = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => find(n, pred, out))
    return out
  }
  if (!node || typeof node === 'string' || typeof node === 'number') return out
  if (pred(node)) out.push(node)
  find(node.props?.children, pred, out)
  return out
}

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node.type === 'function') return text(node.type(node.props))
  return text(node.props?.children)
}

test('DetailSection 把分组标题渲染在白底容器之外', () => {
  const { DetailSection, DetailRow } = load()
  const tree = DetailSection({ title: '基础信息', children: DetailRow({ label: '用户名', value: 'demo' }) })
  const sheets = find(tree, (n) => n.props?.className === 'section')
  assert.equal(sheets.length, 1)
  assert.match(text(tree), /基础信息/)
  // 标题不是白底容器的后代
  assert.equal(find(sheets[0], (n) => text(n) === '基础信息').length, 0)
})

test('DetailSection 默认展开，defaultCollapsed 时标题带 aria-expanded=false', () => {
  const { DetailSection } = load()
  const open = DetailSection({ title: '账号记录', children: 'x' })
  const collapsed = DetailSection({ title: '账号记录', children: 'x', collapsible: true, defaultCollapsed: true })
  assert.equal(find(open, (n) => n.props?.['aria-expanded'] !== undefined).length, 0)
  assert.equal(find(collapsed, (n) => n.props?.['aria-expanded'] === false).length, 1)
})

test('DetailRow 空值统一显示「未设置」并走 muted', () => {
  const { DetailRow } = load()
  const tree = DetailRow({ label: '邮箱', value: '' })
  assert.match(text(tree), /未设置/)
  assert.equal(find(tree, (n) => n.props?.className === 'row__value--muted').length, 1)
})

test('DetailRow 传 onClick 时整行可点并渲染箭头', () => {
  const { DetailRow } = load()
  let clicked = 0
  const tree = DetailRow({ label: '所属部门', value: '研发部门', onClick: () => clicked++ })
  const row = find(tree, (n) => typeof n.props?.onClick === 'function')[0]
  assert.ok(row, 'DetailRow 应渲染带 onClick 的 View')
  row.props.onClick()
  assert.equal(clicked, 1)
  assert.equal(find(tree, (n) => n.props?.name === 'chevronRight').length, 1)
})

test('DetailRow 无 onClick 时不渲染箭头', () => {
  const { DetailRow } = load()
  const tree = DetailRow({ label: '用户名', value: 'demo' })
  assert.equal(find(tree, (n) => n.props?.name === 'chevronRight').length, 0)
})

test('DetailHero 不再自带白卡类名', () => {
  const { DetailHero } = load()
  const tree = DetailHero({ title: '张三', subtitle: '@zhangsan' })
  assert.equal(find(tree, (n) => n.props?.className === 'hero').length, 1)
  assert.match(text(tree), /张三/)
  assert.match(text(tree), /@zhangsan/)
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && node --test tests/detail-layout.test.cjs 2>&1 | tail -30
```

Expected: FAIL —— `aria-expanded` / `onClick` / `row__value--muted` 相关断言全部不成立。

- [ ] **Step 3: 改 `DetailLayout.tsx`**

把文件中 `DetailHero` / `DetailSection` / `DetailRow` 三个函数替换为下面版本，`DetailContent` 与 `DetailGroupList` 原样保留：

```tsx
export interface DetailSectionProps {
  title: string
  children: ReactNode
  className?: string
  /** 标题变为可点击的展开/收起控制 */
  collapsible?: boolean
  defaultCollapsed?: boolean
}

/** 详情页信息分组：灰色标题浮在页面底色上，标题下方是一块无圆角的全出血白底。 */
export function DetailSection({
  title,
  children,
  className = '',
  collapsible = false,
  defaultCollapsed = false,
}: DetailSectionProps) {
  const [open, setOpen] = useState(!defaultCollapsed)
  return (
    <View className={cx(styles.sectionBlock, className)}>
      <Text
        className={cx(styles.section__title, collapsible && styles.section__titleToggle)}
        aria-expanded={collapsible ? open : undefined}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        {title}
        {collapsible ? (
          <LineIcon
            name={open ? 'chevronDown' : 'chevronRight'}
            size={14}
            color="#86909C"
          />
        ) : null}
      </Text>
      {collapsible && !open ? null : <View className={styles.section}>{children}</View>}
    </View>
  )
}

export interface DetailRowProps {
  label: string
  value?: string | number | ReactNode
  /** 渲染右侧箭头，并让整行可点 */
  showArrow?: boolean
  onClick?: () => void
  /** 'muted' 弱化值文字，用于未设置态 */
  tone?: 'default' | 'muted'
}

/** 分组内的「标签 : 值」行，空值统一显示「未设置」。 */
export function DetailRow({ label, value, showArrow = false, onClick, tone = 'default' }: DetailRowProps) {
  const empty = value === undefined || value === null || value === ''
  return (
    <View
      className={cx(styles.row, onClick && styles.row--tappable)}
      onClick={onClick}
      hoverClass={onClick ? styles.row--hover : undefined}
    >
      <Text className={styles.row__label}>{label}</Text>
      <View className={styles.row__tail}>
        <Text
          className={cx(styles.row__value, empty && styles.row__value--muted)}
          selectable={!onClick}
        >
          {empty ? '未设置' : value}
        </Text>
        {showArrow ? <LineIcon name="chevronRight" size={16} color="#C9CDD4" /> : null}
      </View>
    </View>
  )
}
```

同时把文件顶部的 `import { Text, View } from '@tarojs/components'` 改为 `import { Text, View } from '@tarojs/components'` 并新增一行 `import { useState } from 'react'`。

`DetailHero` 的 JSX 不改，只由 SCSS 去掉白卡。

- [ ] **Step 4: 改 `DetailLayout.module.scss`**

```scss
.content {
  padding: 0 0 var(--space-6);
}

/* 头部：裸排版，直接落在页面底色上，不使用白卡 */
.hero {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  margin-bottom: var(--space-2);
}

.hero__glyph {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--color-primary-bg);
}

.hero__info {
  flex: 1;
  min-width: 0;
}

.hero__titleLine {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.hero__title {
  min-width: 0;
  font-size: var(--font-size-20);
  font-weight: var(--font-weight-semibold);
  line-height: 28px;
  color: var(--color-text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.hero__note {
  flex-shrink: 0;
  font-size: var(--font-size-12);
  line-height: 20px;
  color: var(--color-text-tertiary);
}

.hero__subtitle,
.hero__footnote {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--font-size-13);
  line-height: 20px;
  color: var(--color-text-tertiary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.hero__footnote {
  color: var(--color-text-secondary);
}

/* 分组：标题浮在页面底色上，正文是一块无圆角、全出血的白底 */
.sectionBlock {
  margin-bottom: var(--space-2);
}

.sectionBlock:last-child {
  margin-bottom: 0;
}

.section {
  background: var(--color-bg-surface);
}

.section__title {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-4) var(--space-2);
  background: var(--color-bg-base);
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-regular);
  line-height: 20px;
  color: var(--color-text-tertiary);
}

.section__titleToggle {
  cursor: pointer;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--list-item-height-sm);
  box-sizing: border-box;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
  font-size: var(--font-size-14);
  line-height: 22px;
}

.row:last-child {
  border-bottom: 0;
}

.row--tappable {
  cursor: pointer;
}

.row--hover {
  background: var(--color-bg-disabled);
}

.row__label {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.row__tail {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
}

.row__value {
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
  word-break: break-all;
  color: var(--color-text-primary);
}

.row__value--muted {
  color: var(--color-text-tertiary);
}

/* 权限分组：模块标题 + 成员列表，避免直接暴露关联 ID */
.groupBlock {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
}

.groupBlock:last-child {
  border-bottom: 0;
}

.groupBlock__name {
  display: block;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.groupBlock__items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-bg-disabled);
  color: var(--color-text-secondary);
  font-size: var(--font-size-12);
  line-height: 1;
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd apps/demo/app && node --test tests/detail-layout.test.cjs 2>&1 | tail -20
```

Expected: 6 个测试全 PASS。

- [ ] **Step 6: 确认既有页面未被破坏**

```bash
cd apps/demo/app && pnpm test 2>&1 | tail -25
```

Expected: 全部 PASS。若 `tests/user-detail.test.cjs` 失败，是因为它的 `DetailSection` mock 签名 `(props) => [props.title, props.children]` 仍兼容 —— 失败只可能来自 `DetailHero` mock 仍读 `props.footnote`，在 Task 9 会一并修。此处若有其他失败，先修 mock 再继续。

- [ ] **Step 7: 提交**

```bash
git add apps/demo/app/src/components/management/DetailLayout.tsx apps/demo/app/src/components/management/DetailLayout.module.scss apps/demo/app/tests/detail-layout.test.cjs
git commit -m "refactor(app): drop white cards from detail layout, add collapsible section and tappable row"
```

---

## Task 3: `profileSections` 字段契约

**Files:**
- Create: `apps/demo/app/src/pages/system/user/profileSections.ts`
- Test: `apps/demo/app/tests/profile-sections.test.cjs`

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  export type ProfileFieldKind = 'text' | 'date' | 'secret' | 'enum' | 'org'
  export interface ProfileOrgTarget { type: 'departments' | 'roles' }
  export type ProfileField =
    | { kind: 'text'; key: string; label: string; value: string; editable: boolean }
    | { kind: 'date'; key: string; label: string; value: string; editable: boolean }
    | { kind: 'secret'; key: string; label: string; value: string }
    | { kind: 'enum'; key: string; label: string; value: string; options: readonly string[] }
    | { kind: 'org'; key: string; label: string; ids: number[]; names: Map<number, string>; target: ProfileOrgTarget }
  export interface ProfileSection { key: string; title: string; fields: ProfileField[] }
  export interface BuildOptions {
    user: AdminUser
    deptNames: Map<number, string>
    roleNames: Map<number, string>
    canReadDepts: boolean
    canReadRoles: boolean
    showPassword?: boolean
  }
  export function buildProfileSections(options: BuildOptions): ProfileSection[]
  export function maskSecret(value: string): string
  export const UNSET: string
  export function formatOrgSummary(ids: number[], names: Map<number, string>): string
  ```

**契约要点（必须与 spec 一致）**：6 组，顺序为 基础信息 → 联系方式 → 安全设置 → 组织关系 → 状态 → 其他属性。密码与登录方式 `kind: 'secret'`，编辑态也只读。org 字段在无权限时**不出现在列表里**（不是 `visible: false` 占位）。所有空值统一为 `UNSET`。

- [ ] **Step 1: 写失败测试**

创建 `apps/demo/app/tests/profile-sections.test.cjs`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const {
  buildProfileSections,
  formatOrgSummary,
  maskSecret,
  UNSET,
} = loadTs('src/pages/system/user/profileSections.ts')

const USER = {
  id: 2,
  username: 'demo',
  realName: '张三',
  nickname: '三三',
  phone: '13800138000',
  email: 'a@b.com',
  gender: '1',
  birthDate: '1990-01-01',
  status: '1',
  deptIds: [48, 52],
  roleIds: [37],
}

function build(over = {}) {
  return buildProfileSections({
    user: USER,
    deptNames: new Map([[48, '研发部门'], [52, '市场部门']]),
    roleNames: new Map([[37, '管理员']]),
    canReadDepts: true,
    canReadRoles: true,
    ...over,
  })
}

function fieldOf(sections, key) {
  for (const s of sections) for (const f of s.fields) if (f.key === key) return f
  return undefined
}

test('分组顺序为 基础信息/联系方式/安全设置/组织关系/状态/其他属性', () => {
  assert.deepEqual(
    build().map((s) => s.title),
    ['基础信息', '联系方式', '安全设置', '组织关系', '状态', '其他属性'],
  )
})

test('基础信息字段顺序为 用户名/真实姓名/昵称', () => {
  const basic = build()[0]
  assert.deepEqual(basic.fields.map((f) => f.label), ['用户名', '真实姓名', '昵称'])
})

test('密码字段是 secret 且打码为 8 个圆点', () => {
  const f = fieldOf(build(), 'password')
  assert.equal(f.kind, 'secret')
  assert.equal(maskSecret('secret123'), '••••••••')
})

test('无权限时 org 字段整个从契约中消失而不是留空占位', () => {
  const sections = build({ canReadDepts: false })
  assert.equal(fieldOf(sections, 'depts'), undefined)
  assert.ok(fieldOf(sections, 'roles'), '角色字段应保留')
})

test('org 字段带 ids / names / target', () => {
  const f = fieldOf(build(), 'depts')
  assert.equal(f.kind, 'org')
  assert.deepEqual(f.ids, [48, 52])
  assert.equal(f.names.get(48), '研发部门')
  assert.equal(f.target, 'departments')
})

test('text 字段空值统一为 未设置', () => {
  assert.equal(fieldOf(build({ user: { ...USER, nickname: '' } }), 'nickname').value, UNSET)
})

test('enum 字段带候选集，性别三项顺序为 保密/男/女', () => {
  const f = fieldOf(build(), 'gender')
  assert.equal(f.kind, 'enum')
  assert.deepEqual(f.options, ['保密', '男', '女'])
})

test('状态 enum 顺序为 禁用/启用/锁定', () => {
  assert.deepEqual(fieldOf(build(), 'status').options, ['禁用', '启用', '锁定'])
})

test('formatOrgSummary 只显示前 2 个名称并追加 等 N 个', () => {
  const names = new Map([[1, '甲'], [2, '乙'], [3, '丙'], [4, '丁']])
  assert.equal(formatOrgSummary([1, 2, 3, 4], names), '甲、乙 等 4 个')
  assert.equal(formatOrgSummary([1, 2], names), '甲、乙')
  assert.equal(formatOrgSummary([], names), UNSET)
})

test('formatOrgSummary 在名称全部解析不出时回退为占位文案', () => {
  assert.equal(formatOrgSummary([9, 10], new Map()), '名称暂不可用')
})

test('formatOrgSummary 部分解析失败时只统计解析成功项', () => {
  const names = new Map([[1, '甲']])
  assert.equal(formatOrgSummary([1, 9], names), '甲')
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && node --test tests/profile-sections.test.cjs 2>&1 | tail -20
```

Expected: FAIL —— `Cannot resolve src/pages/system/user/profileSections.ts`。

- [ ] **Step 3: 实现契约**

创建 `apps/demo/app/src/pages/system/user/profileSections.ts`：

```ts
export const UNSET = '未设置'
const UNRESOLVED = '名称暂不可用'

export type ProfileOrgTarget = 'departments' | 'roles'

export type ProfileField =
  | { kind: 'text'; key: string; label: string; value: string; editable: boolean }
  | { kind: 'date'; key: string; label: string; value: string; editable: boolean }
  | { kind: 'secret'; key: string; label: string; value: string }
  | { kind: 'enum'; key: string; label: string; value: string; options: readonly string[] }
  | {
      kind: 'org'
      key: string
      label: string
      ids: number[]
      names: Map<number, string>
      target: ProfileOrgTarget
    }

export interface ProfileSection {
  key: string
  title: string
  fields: ProfileField[]
}

/** 与后端 gender 取值一致：0 保密 / 1 男 / 2 女。索引即 value。 */
export const GENDER_OPTIONS = ['保密', '男', '女'] as const
/** 与后端 status 取值一致：0 禁用 / 1 启用 / 2 锁定。索引即 value。 */
export const STATUS_OPTIONS = ['禁用', '启用', '锁定'] as const

export function maskSecret(value: string): string {
  return value ? '••••••••' : ''
}

/**
 * 组织归属摘要：最多展示 2 个名称，溢出时补「等 N 个」。
 * 名称全部解析失败时回退为占位文案，避免出现空的破折号串。
 */
export function formatOrgSummary(ids: number[], names: Map<number, string>): string {
  if (!ids.length) return UNSET
  const resolved = ids.map((id) => names.get(id)).filter((name): name is string => !!name)
  if (!resolved.length) return UNRESOLVED
  if (resolved.length <= 2) return resolved.join('、')
  return `${resolved.slice(0, 2).join('、')} 等 ${resolved.length} 个`
}

function text(value: unknown): string {
  const s = value === undefined || value === null ? '' : String(value)
  return s || UNSET
}

export interface BuildProfileOptions {
  user: Record<string, unknown>
  deptNames: Map<number, string>
  roleNames: Map<number, string>
  canReadDepts: boolean
  canReadRoles: boolean
}

export function buildProfileSections(options: BuildProfileOptions): ProfileSection[] {
  const { user, deptNames, roleNames, canReadDepts, canReadRoles } = options
  const ids = (key: 'deptIds' | 'roleIds'): number[] =>
    Array.isArray(user[key]) ? (user[key] as number[]) : []

  const orgFields: ProfileField[] = []
  if (canReadDepts) {
    orgFields.push({
      kind: 'org',
      key: 'depts',
      label: '所属部门',
      ids: ids('deptIds'),
      names: deptNames,
      target: 'departments',
    })
  }
  if (canReadRoles) {
    orgFields.push({
      kind: 'org',
      key: 'roles',
      label: '角色',
      ids: ids('roleIds'),
      names: roleNames,
      target: 'roles',
    })
  }

  return [
    {
      key: 'basic',
      title: '基础信息',
      fields: [
        { kind: 'text', key: 'username', label: '用户名', value: text(user.username), editable: true },
        { kind: 'text', key: 'realName', label: '真实姓名', value: text(user.realName), editable: true },
        { kind: 'text', key: 'nickname', label: '昵称', value: text(user.nickname), editable: true },
      ],
    },
    {
      key: 'contact',
      title: '联系方式',
      fields: [
        { kind: 'text', key: 'phone', label: '手机号', value: text(user.phone), editable: true },
        { kind: 'text', key: 'email', label: '邮箱', value: text(user.email), editable: true },
      ],
    },
    {
      key: 'security',
      title: '安全设置',
      fields: [
        { kind: 'secret', key: 'password', label: '密码', value: maskSecret(String(user.password ?? '')) },
        { kind: 'secret', key: 'loginMethod', label: '登录方式', value: text(user.loginMethod) },
      ],
    },
    { key: 'org', title: '组织关系', fields: orgFields },
    {
      key: 'status',
      title: '状态',
      fields: [
        {
          kind: 'enum',
          key: 'status',
          label: '启用状态',
          value: String(user.status ?? '0'),
          options: STATUS_OPTIONS,
        },
      ],
    },
    {
      key: 'extra',
      title: '其他属性',
      fields: [
        {
          kind: 'enum',
          key: 'gender',
          label: '性别',
          value: String(user.gender ?? '0'),
          options: GENDER_OPTIONS,
        },
        { kind: 'date', key: 'birthDate', label: '出生日期', value: text(user.birthDate), editable: true },
      ],
    },
  ].filter((section) => section.fields.length > 0)
}
```

> **注意**：`enum` 的 `value` 是**后端原始值**（`'0'`/`'1'`/`'2'`），`options` 是**文案数组**且下标与值一一对应。渲染层用 `options[Number(value)]` 取文案。这样 segment 选项的文案与提交值不会错位。

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/demo/app && node --test tests/profile-sections.test.cjs 2>&1 | tail -20
```

Expected: 11 个测试全 PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/demo/app/src/pages/system/user/profileSections.ts apps/demo/app/tests/profile-sections.test.cjs
git commit -m "feat(app): add user profile field contract driving detail and edit pages"
```

---

## Task 4: `OrganizationPicker`

**Files:**
- Create: `apps/demo/app/src/components/management/OrganizationPicker.tsx`
- Create: `apps/demo/app/src/components/management/OrganizationPicker.module.scss`
- Modify: `apps/demo/app/src/components/management/index.ts`
- Test: `apps/demo/app/tests/organization-picker.test.cjs`

**Interfaces:**
- Consumes: `formatOrgSummary`, `UNSET` from `@/pages/system/user/profileSections`
- Produces:
  ```ts
  export interface OrganizationPickerProps {
    label: string
    ids: number[]
    names: Map<number, string>
    /** 无已选项时的行样式（muted） */
    className?: string
    onPress: () => void
  }
  export function OrganizationPicker(props: OrganizationPickerProps): JSX.Element
  ```
  渲染：`label` 左对齐；右侧 `formatOrgSummary(ids, names)` + `chevronRight`；空值走 muted。

- [ ] **Step 1: 写失败测试**

创建 `apps/demo/app/tests/organization-picker.test.cjs`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function load() {
  return loadTs('src/components/management/OrganizationPicker.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './OrganizationPicker.module.scss': new Proxy({}, { get: (_, key) => key }),
    '@/pages/system/user/profileSections': loadTs('src/pages/system/user/profileSections.ts'),
  })
}

function find(node, pred, out = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => find(n, pred, out))
    return out
  }
  if (!node || typeof node === 'string' || typeof node === 'number') return out
  if (pred(node)) out.push(node)
  find(node.props?.children, pred, out)
  return out
}

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node.type === 'function') return text(node.type(node.props))
  return text(node.props?.children)
}

test('渲染 label 与组织摘要，并带箭头', () => {
  const { OrganizationPicker } = load()
  const tree = OrganizationPicker({
    label: '所属部门',
    ids: [48, 52],
    names: new Map([[48, '研发部门'], [52, '市场部门']]),
    onPress: () => {},
  })
  assert.match(text(tree), /所属部门/)
  assert.match(text(tree), /研发部门、市场部门/)
  assert.equal(find(tree, (n) => n.props?.name === 'chevronRight').length, 1)
})

test('超过 2 个时摘要带「等 N 个」', () => {
  const { OrganizationPicker } = load()
  const names = new Map([[1, '甲'], [2, '乙'], [3, '丙']])
  const tree = OrganizationPicker({ label: '所属部门', ids: [1, 2, 3], names, onPress: () => {} })
  assert.match(text(tree), /甲、乙 等 3 个/)
})

test('空选中时展示 未设置 且走 muted 类名', () => {
  const { OrganizationPicker } = load()
  const tree = OrganizationPicker({ label: '角色', ids: [], names: new Map(), onPress: () => {} })
  assert.match(text(tree), /未设置/)
  assert.equal(find(tree, (n) => n.props?.className === 'orgValue--muted').length, 1)
})

test('点击整行触发 onPress', () => {
  const { OrganizationPicker } = load()
  let pressed = 0
  const tree = OrganizationPicker({
    label: '角色',
    ids: [37],
    names: new Map([[37, '管理员']]),
    onPress: () => pressed++,
  })
  find(tree, (n) => typeof n.props?.onClick === 'function')[0].props.onClick()
  assert.equal(pressed, 1)
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && node --test tests/organization-picker.test.cjs 2>&1 | tail -20
```

Expected: FAIL —— `Cannot resolve src/components/management/OrganizationPicker.tsx`。

- [ ] **Step 3: 实现组件**

创建 `apps/demo/app/src/components/management/OrganizationPicker.tsx`：

```tsx
import { Text, View } from '@tarojs/components'

import { formatOrgSummary, UNSET } from '@/pages/system/user/profileSections'
import styles from './OrganizationPicker.module.scss'
import { LineIcon } from './LineIcon'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface OrganizationPickerProps {
  label: string
  /** 已选项 ID，任意层级均可 */
  ids: number[]
  /** id → 名称，由调用方解析后传入 */
  names: Map<number, string>
  className?: string
  onPress: () => void
}

/** 组织归属跳转行：展示已选项摘要，点击进入选择页。 */
export function OrganizationPicker({ label, ids, names, className = '', onPress }: OrganizationPickerProps) {
  const summary = formatOrgSummary(ids, names)
  const empty = summary === UNSET
  return (
    <View
      className={cx(styles.orgRow, className)}
      hoverClass={styles.orgRow--hover}
      onClick={onPress}
      aria-label={label}
    >
      <Text className={styles.orgLabel}>{label}</Text>
      <View className={styles.orgTail}>
        <Text className={cx(styles.orgValue, empty && styles['orgValue--muted'])}>
          {summary}
        </Text>
        <LineIcon name="chevronRight" size={16} color="#C9CDD4" />
      </View>
    </View>
  )
}
```

创建 `apps/demo/app/src/components/management/OrganizationPicker.module.scss`：

```scss
.orgRow {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--list-item-height-sm);
  box-sizing: border-box;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
}

.orgRow:last-child {
  border-bottom: 0;
}

.orgRow--hover {
  background: var(--color-bg-disabled);
}

.orgLabel {
  flex-shrink: 0;
  font-size: var(--font-size-14);
  line-height: 22px;
  color: var(--color-text-secondary);
}

.orgTail {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
}

.orgValue {
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
  word-break: break-all;
  font-size: var(--font-size-14);
  line-height: 22px;
  color: var(--color-text-primary);
}

.orgValue--muted {
  color: var(--color-text-tertiary);
}
```

- [ ] **Step 4: 导出到 barrel**

在 `apps/demo/app/src/components/management/index.ts` 的 `DetailGroupList` 导出行之后、`FormContent` 之前插入：

```ts
export { OrganizationPicker } from './OrganizationPicker'
export type { OrganizationPickerProps } from './OrganizationPicker'
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd apps/demo/app && node --test tests/organization-picker.test.cjs 2>&1 | tail -15
```

Expected: 4 个测试全 PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/demo/app/src/components/management/OrganizationPicker.tsx apps/demo/app/src/components/management/OrganizationPicker.module.scss apps/demo/app/src/components/management/index.ts apps/demo/app/tests/organization-picker.test.cjs
git commit -m "feat(app): add OrganizationPicker row for department and role selection"
```

---

## Task 5: `deptTree` 纯函数 + `DepartmentTreeNavigator`

**Files:**
- Create: `apps/demo/app/src/components/management/deptTree.ts`
- Create: `apps/demo/app/src/components/management/DepartmentTreeNavigator.tsx`
- Create: `apps/demo/app/src/components/management/DepartmentTreeNavigator.module.scss`
- Modify: `apps/demo/app/src/components/management/index.ts`
- Test: `apps/demo/app/tests/dept-tree.test.cjs`

**Interfaces:**
- Consumes: `AdminDept` from `@/api/admin/types`
- Produces:
  ```ts
  // deptTree.ts
  export interface DeptPathNode { id: number; name: string }
  export interface DeptFlatNode { node: AdminDept; path: DeptPathNode[] }
  export function childOf(nodes: AdminDept[] | null | undefined, parentId: number | null): AdminDept[]
  export function findDeptPath(tree: AdminDept[] | null | undefined, id: number): DeptPathNode[]
  export function flattenDepts(tree: AdminDept[] | null | undefined): DeptFlatNode[]
  export function searchDepts(tree: AdminDept[] | null | undefined, keyword: string): DeptFlatNode[]
  export function hasChildren(node: AdminDept): boolean

  // DepartmentTreeNavigator.tsx
  export interface DepartmentTreeNavigatorProps {
    nodes: AdminDept[]
    path: DeptPathNode[]
    selectedIds: ReadonlySet<number>
    /** 搜索跳转后需要高亮的节点 */
    highlightId?: number | null
    /** readonly 模式下 checkbox 不可交互 */
    readonly?: boolean
    onEnter: (node: AdminDept) => void
    onToggle: (id: number) => void
    onCrumb: (index: number) => void
  }
  export function DepartmentTreeNavigator(props: DepartmentTreeNavigatorProps): JSX.Element
  ```

**关键约束（Review Focus #1）**：`AdminDept.children` 类型是 `AdminDept[] | null`。所有遍历函数必须把 `null` / `undefined` 当空数组处理，且遇到 `children` 为 null 的节点不得抛错。`findDeptPath` 找不到时返回 `[]`。

**选择语义（决策：任意层级均可选）**：行点击 = 进入层级（叶子行则直接切换选中）；checkbox 独立可点 = 选中/取消，`stopPropagation` 阻止连带进入层级。这样既保留「层级导航」的心智，又满足「父部门本身也能被选中」，与现有编辑页 flatten 后的能力一致，不构成功能回退。

- [ ] **Step 1: 写失败测试**

创建 `apps/demo/app/tests/dept-tree.test.cjs`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const tree = [
  {
    id: 1,
    name: '上海总公司',
    children: [
      { id: 11, name: '研发部门', children: [{ id: 111, name: '前端组', children: null }] },
      { id: 12, name: '市场部门', children: null },
    ],
  },
  { id: 2, name: '北京分公司', children: null },
]

const {
  childOf,
  findDeptPath,
  flattenDepts,
  searchDepts,
  hasChildren,
} = loadTs('src/components/management/deptTree.ts')

test('hasChildren 把 children: null 视为叶子', () => {
  assert.equal(hasChildren(tree[1]), false)
  assert.equal(hasChildren(tree[0]), true)
})

test('childOf 根层返回原数组，null 输入返回空数组', () => {
  assert.equal(childOf(tree, null).length, 2)
  assert.deepEqual(childOf(null, null), [])
  assert.deepEqual(childOf(undefined, 1), [])
})

test('childOf 按 id 返回子节点，children: null 时返回空数组', () => {
  assert.deepEqual(childOf(tree, 1).map((n) => n.id), [11, 12])
  assert.deepEqual(childOf(tree, 2), [])
})

test('findDeptPath 返回从根到目标节点的路径名', () => {
  assert.deepEqual(findDeptPath(tree, 111), [
    { id: 1, name: '上海总公司' },
    { id: 11, name: '研发部门' },
    { id: 111, name: '前端组' },
  ])
})

test('findDeptPath 找不到时返回空数组', () => {
  assert.deepEqual(findDeptPath(tree, 999), [])
  assert.deepEqual(findDeptPath(null, 1), [])
})

test('flattenDepts 深度优先展平且带完整路径', () => {
  const flat = flattenDepts(tree)
  assert.deepEqual(flat.map((f) => f.node.id), [1, 11, 111, 12, 2])
  assert.deepEqual(flat[2].path.map((p) => p.name), ['上海总公司', '研发部门', '前端组'])
})

test('flattenDepts 对空树返回空数组', () => {
  assert.deepEqual(flattenDepts(null), [])
})

test('searchDepts 按名称子串匹配并保留路径', () => {
  const hits = searchDepts(tree, '研发')
  assert.deepEqual(hits.map((h) => h.node.id), [11])
  assert.deepEqual(hits[0].path.map((p) => p.name), ['上海总公司', '研发部门'])
})

test('searchDepts 关键词为空或无匹配时返回空数组', () => {
  assert.deepEqual(searchDepts(tree, ''), [])
  assert.deepEqual(searchDepts(tree, '   '), [])
  assert.deepEqual(searchDepts(tree, '不存在'), [])
})
```

在同一个文件末尾追加导航器渲染测试：

```js
const { DepartmentTreeNavigator } = loadTs('src/components/management/DepartmentTreeNavigator.tsx', {
  '@tarojs/components': { View: 'View', Text: 'Text' },
  './LineIcon': { LineIcon: 'LineIcon' },
  './DepartmentTreeNavigator.module.scss': new Proxy({}, { get: (_, key) => key }),
  './deptTree': loadTs('src/components/management/deptTree.ts'),
})

function find(node, pred, out = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => find(n, pred, out))
    return out
  }
  if (!node || typeof node === 'string' || typeof node === 'number') return out
  if (pred(node)) out.push(node)
  find(node.props?.children, pred, out)
  return out
}

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node.type === 'function') return text(node.type(node.props))
  return text(node.props?.children)
}

test('面包屑渲染路径各级并可回跳', () => {
  let crumbIndex = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [
      { id: 1, name: '上海总公司' },
      { id: 11, name: '研发部门' },
    ],
    selectedIds: new Set(),
    onEnter: () => {},
    onToggle: () => {},
    onCrumb: (i) => (crumbIndex = i),
  })
  assert.match(text(t), /上海总公司/)
  assert.match(text(t), /研发部门/)
  const crumbs = find(t, (n) => typeof n.props?.['aria-label'] === 'string' && n.props['aria-label'].startsWith('面包屑'))
  assert.equal(crumbs.length, 2)
  crumbs[0].props.onClick()
  assert.equal(crumbIndex, 0)
})

test('有子节点的行触发 onEnter 而非 onToggle', () => {
  let entered = null
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    onEnter: (n) => (entered = n.id),
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  const row = find(t, (n) => n.props?.['aria-label'] === '部门-研发部门')[0]
  row.props.onClick()
  assert.equal(entered, 11)
  assert.equal(toggled, null)
})

test('叶子节点的行触发 onToggle', () => {
  let entered = null
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    onEnter: (n) => (entered = n.id),
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  find(t, (n) => n.props?.['aria-label'] === '部门-市场部门')[0].props.onClick()
  assert.equal(toggled, 12)
  assert.equal(entered, null)
})

test('已选中的叶子渲染 checked 状态', () => {
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set([12]),
    onEnter: () => {},
    onToggle: () => {},
    onCrumb: () => {},
  })
  assert.equal(find(t, (n) => n.props?.['aria-checked'] === true).length, 1)
  assert.equal(find(t, (n) => n.props?.['aria-label'] === '勾选-市场部门')[0].props['aria-checked'], true)
})

test('任意层级均可选中：勾选分支节点只触发 onToggle，不触发 onEnter', () => {
  let entered = null
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    onEnter: (n) => (entered = n.id),
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  const stopped = []
  find(t, (n) => n.props?.['aria-label'] === '勾选-研发部门')[0].props.onClick({
    stopPropagation: () => stopped.push(true),
  })
  assert.deepEqual(toggled, 11)
  assert.equal(entered, null)
  assert.equal(stopped.length, 1, 'checkbox 点击必须阻止冒泡，否则会连带进入层级')
})

test('父部门自身也可被勾选（能力保持，非仅叶子可选）', () => {
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree,
    path: [],
    selectedIds: new Set(),
    onEnter: () => {},
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  find(t, (n) => n.props?.['aria-label'] === '勾选-上海总公司')[0].props.onClick({
    stopPropagation: () => {},
  })
  assert.equal(toggled, 1)
})

test('readonly 模式下 checkbox 不可点击且不渲染 checked', () => {
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    readonly: true,
    onEnter: () => {},
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  assert.equal(find(t, (n) => n.props?.['aria-checked'] !== undefined).length, 0)
  assert.equal(find(t, (n) => n.props?.['aria-label'] === '勾选-市场部门')[0].props.onClick, undefined)
  assert.equal(toggled, null)
})

test('highlightId 对应行带高亮类名', () => {
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    highlightId: 12,
    onEnter: () => {},
    onToggle: () => {},
    onCrumb: () => {},
  })
  assert.equal(find(t, (n) => n.props?.className === 'treeRow--highlight').length, 1)
})

test('当前层为空时渲染空态文案', () => {
  const t = DepartmentTreeNavigator({
    nodes: [],
    path: [{ id: 2, name: '北京分公司' }],
    selectedIds: new Set(),
    onEnter: () => {},
    onToggle: () => {},
    onCrumb: () => {},
  })
  assert.match(text(t), /没有下级部门/)
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && node --test tests/dept-tree.test.cjs 2>&1 | tail -20
```

Expected: FAIL —— `Cannot resolve src/components/management/deptTree.ts`。

- [ ] **Step 3: 实现 `deptTree.ts`**

创建 `apps/demo/app/src/components/management/deptTree.ts`：

```ts
export interface DeptPathNode {
  id: number
  name: string
}

export interface DeptFlatNode {
  node: AdminDept
  path: DeptPathNode[]
}

function kids(node: AdminDept | null | undefined): AdminDept[] {
  return node?.children ?? []
}

export function hasChildren(node: AdminDept): boolean {
  return kids(node).length > 0
}

/** 取某节点的直接子节点。parentId 为 null 表示根层。 */
export function childOf(nodes: AdminDept[] | null | undefined, parentId: number | null): AdminDept[] {
  if (!parentId) return nodes ?? []
  return kids((nodes ?? []).find((node) => node.id === parentId))
}

/** 深度优先查找从根到 id 的路径。找不到返回空数组。 */
export function findDeptPath(tree: AdminDept[] | null | undefined, id: number): DeptPathNode[] {
  const walk = (nodes: AdminDept[], trail: DeptPathNode[]): DeptPathNode[] | null => {
    for (const node of nodes) {
      const next = [...trail, { id: node.id, name: node.name }]
      if (node.id === id) return next
      const found = walk(kids(node), next)
      if (found) return found
    }
    return null
  }
  return walk(tree ?? [], []) ?? []
}

/** 深度优先展平整棵树，每项带完整路径。 */
export function flattenDepts(tree: AdminDept[] | null | undefined): DeptFlatNode[] {
  const out: DeptFlatNode[] = []
  const walk = (nodes: AdminDept[], trail: DeptPathNode[]) => {
    for (const node of nodes) {
      const next = [...trail, { id: node.id, name: node.name }]
      out.push({ node, path: next })
      walk(kids(node), next)
    }
  }
  walk(tree ?? [], [])
  return out
}

/** 按名称子串搜索，保留命中节点的完整路径。关键词为空返回空数组。 */
export function searchDepts(tree: AdminDept[] | null | undefined, keyword: string): DeptFlatNode[] {
  const kw = keyword.trim()
  if (!kw) return []
  return flattenDepts(tree).filter((item) => item.node.name.includes(kw))
}
```

文件顶部加 `import type { AdminDept } from '@/api/admin/types'`。

- [ ] **Step 4: 实现 `DepartmentTreeNavigator.tsx`**

创建 `apps/demo/app/src/components/management/DepartmentTreeNavigator.tsx`：

```tsx
import { Text, View } from '@tarojs/components'
import type { AdminDept } from '@/api/admin/types'

import { type DeptPathNode, hasChildren } from './deptTree'
import styles from './DepartmentTreeNavigator.module.scss'
import { LineIcon } from './LineIcon'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface DepartmentTreeNavigatorProps {
  /** 当前层的子节点 */
  nodes: AdminDept[]
  /** 从根到当前节点的路径 */
  path: DeptPathNode[]
  selectedIds: ReadonlySet<number>
  highlightId?: number | null
  readonly?: boolean
  onEnter: (node: AdminDept) => void
  onToggle: (id: number) => void
  onCrumb: (index: number) => void
}

/** 层级导航：面包屑 + 当前层子节点列表。纯展示，不持有选中态、不发请求。 */
export function DepartmentTreeNavigator({
  nodes,
  path,
  selectedIds,
  highlightId = null,
  readonly = false,
  onEnter,
  onToggle,
  onCrumb,
}: DepartmentTreeNavigatorProps) {
  return (
    <View className={styles.tree}>
      <View className={styles.crumbs}>
        {path.map((crumb, index) => (
          <View
            key={crumb.id}
            className={styles.crumb}
            aria-label={`面包屑-${crumb.name}`}
            onClick={() => onCrumb(index)}
          >
            <Text className={index === path.length - 1 ? styles.crumb--current : styles.crumb}>
              {crumb.name}
            </Text>
            {index < path.length - 1 ? (
              <LineIcon name="chevronRight" size={12} color="#C9CDD4" />
            ) : null}
          </View>
        ))}
      </View>

      {nodes.length === 0 ? (
        <Text className={styles.empty}>没有下级部门</Text>
      ) : (
        nodes.map((node) => {
          const branch = hasChildren(node)
          const checked = selectedIds.has(node.id)
          return (
            <View
              key={node.id}
              className={cx(styles.treeRow, node.id === highlightId && styles['treeRow--highlight'])}
              aria-label={`部门-${node.name}`}
              hoverClass={styles['treeRow--hover']}
              // 行点击 = 进入层级；叶子行则直接切换选中
              onClick={branch ? () => onEnter(node) : () => onToggle(node.id)}
            >
              {/* checkbox 独立可点：任意层级均可被选中；stopPropagation 避免连带触发行点击 */}
              <View
                className={cx(styles.checkbox, checked && styles['checkbox--on'])}
                aria-label={`勾选-${node.name}`}
                aria-checked={readonly ? undefined : checked}
                onClick={
                  readonly
                    ? undefined
                    : (event) => {
                        event.stopPropagation()
                        onToggle(node.id)
                      }
                }
              >
                {checked ? <LineIcon name="check" size={12} color="#FFFFFF" /> : null}
              </View>
              <Text className={styles.treeName}>{node.name}</Text>
              {branch ? <LineIcon name="chevronRight" size={16} color="#C9CDD4" /> : null}
            </View>
          )
        })
      )}
    </View>
  )
}
```

- [ ] **Step 5: 实现 `DepartmentTreeNavigator.module.scss`**

```scss
.tree {
  background: var(--color-bg-surface);
}

.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
  background: var(--color-bg-base);
}

.crumb {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-13);
  line-height: 20px;
  color: var(--color-text-tertiary);
}

.crumb--current {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.empty {
  display: block;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  font-size: var(--font-size-13);
  color: var(--color-text-tertiary);
}

.treeRow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--list-item-height-sm);
  box-sizing: border-box;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
}

.treeRow:last-child {
  border-bottom: 0;
}

.treeRow--hover {
  background: var(--color-bg-disabled);
}

.treeRow--highlight {
  background: var(--color-primary-bg);
}

.checkbox {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}

.checkbox--on {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.treeName {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-14);
  line-height: 22px;
  color: var(--color-text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
```

- [ ] **Step 6: 导出到 barrel**

在 `apps/demo/app/src/components/management/index.ts` 加入：

```ts
export { DepartmentTreeNavigator } from './DepartmentTreeNavigator'
export type { DepartmentTreeNavigatorProps } from './DepartmentTreeNavigator'
export type { DeptPathNode, DeptFlatNode } from './deptTree'
export { childOf, findDeptPath, flattenDepts, searchDepts, hasChildren } from './deptTree'
```

- [ ] **Step 7: 运行测试确认通过**

```bash
cd apps/demo/app && node --test tests/dept-tree.test.cjs 2>&1 | tail -20
```

Expected: 18 个测试全 PASS（9 个纯函数 + 9 个导航器）。

- [ ] **Step 8: 提交**

```bash
git add apps/demo/app/src/components/management/deptTree.ts apps/demo/app/src/components/management/DepartmentTreeNavigator.tsx apps/demo/app/src/components/management/DepartmentTreeNavigator.module.scss apps/demo/app/src/components/management/index.ts apps/demo/app/tests/dept-tree.test.cjs
git commit -m "feat(app): add dept tree helpers and layer-navigating DepartmentTreeNavigator"
```

---

## Task 6: `SelectionFooter`

**Files:**
- Create: `apps/demo/app/src/components/management/SelectionFooter.tsx`
- Create: `apps/demo/app/src/components/management/SelectionFooter.module.scss`
- Modify: `apps/demo/app/src/components/management/index.ts`
- Test: `apps/demo/app/tests/selection-footer.test.cjs`

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  export interface SelectionFooterProps {
    /** 已选数量，展示为「已选择 N 个部门」 */
    count: number
    unit: string
    /** 已选清单，点开展开。为空数组时不渲染展开能力 */
    items: readonly { id: number; label: string; path: string[] }[]
    readonly?: boolean
    onCancel: () => void
    onConfirm: () => void
    onRemoveItem?: (id: number) => void
  }
  export function SelectionFooter(props: SelectionFooterProps): JSX.Element
  ```
  `readonly` 为 true 时只渲染单个「完成」按钮，不渲染取消与已选计数展开。

- [ ] **Step 1: 写失败测试**

创建 `apps/demo/app/tests/selection-footer.test.cjs`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function load() {
  return loadTs('src/components/management/SelectionFooter.tsx', {
    react: {
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    },
    '@tarojs/components': { View: 'View', Text: 'Text' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './SelectionFooter.module.scss': new Proxy({}, { get: (_, key) => key }),
  })
}

function find(node, pred, out = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => find(n, pred, out))
    return out
  }
  if (!node || typeof node === 'string' || typeof node === 'number') return out
  if (pred(node)) out.push(node)
  find(node.props?.children, pred, out)
  return out
}

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node.type === 'function') return text(node.type(node.props))
  return text(node.props?.children)
}

const base = {
  count: 3,
  unit: '个部门',
  items: [
    { id: 48, label: '研发部门', path: ['上海总公司', '研发部门'] },
    { id: 52, label: '市场部门', path: ['上海总公司', '市场部门'] },
  ],
  onCancel: () => {},
  onConfirm: () => {},
}

test('渲染已选计数与取消/确定按钮', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter(base)
  assert.match(text(t), /已选择 3 个部门/)
  assert.ok(find(t, (n) => n.props?.['aria-label'] === '取消').length)
  assert.ok(find(t, (n) => n.props?.['aria-label'] === '确定').length)
})

test('确定与取消分别触发各自回调', () => {
  const { SelectionFooter } = load()
  let canceled = 0
  let confirmed = 0
  const t = SelectionFooter({ ...base, onCancel: () => canceled++, onConfirm: () => confirmed++ })
  find(t, (n) => n.props?.['aria-label'] === '取消')[0].props.onClick()
  find(t, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.equal(canceled, 1)
  assert.equal(confirmed, 1)
})

test('count 为 0 时显示未选择任何项', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter({ ...base, count: 0, items: [] })
  assert.match(text(t), /未选择任何部门/)
})

test('readonly 模式只渲染完成按钮，不渲染取消', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter({ ...base, readonly: true })
  assert.ok(find(t, (n) => n.props?.['aria-label'] === '完成').length)
  assert.equal(find(t, (n) => n.props?.['aria-label'] === '取消').length, 0)
  assert.equal(find(t, (n) => n.props?.['aria-label'] === '确定').length, 0)
})

test('readonly 模式仍展示已选数量供确认', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter({ ...base, readonly: true })
  assert.match(text(t), /已选择 3 个部门/)
})

test('onRemoveItem 缺省时不渲染每项的移除按钮', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter(base)
  assert.equal(find(t, (n) => String(n.props?.['aria-label'] ?? '').startsWith('移除-')).length, 0)
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && node --test tests/selection-footer.test.cjs 2>&1 | tail -20
```

Expected: FAIL —— `Cannot resolve src/components/management/SelectionFooter.tsx`。

- [ ] **Step 3: 实现组件**

创建 `apps/demo/app/src/components/management/SelectionFooter.tsx`：

```tsx
import { useState } from 'react'
import { Text, View } from '@tarojs/components'

import styles from './SelectionFooter.module.scss'
import { LineIcon } from './LineIcon'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface SelectionFooterItem {
  id: number
  label: string
  /** 从根到该节点的名称链，用于已选清单里消歧同名部门 */
  path: string[]
}

export interface SelectionFooterProps {
  count: number
  unit: string
  items: readonly SelectionFooterItem[]
  readonly?: boolean
  onCancel: () => void
  onConfirm: () => void
  onRemoveItem?: (id: number) => void
}

/** 底部固定操作条：已选计数（可展开清单）+ 取消 / 确定。 */
export function SelectionFooter({
  count,
  unit,
  items,
  readonly = false,
  onCancel,
  onConfirm,
  onRemoveItem,
}: SelectionFooterProps) {
  const [open, setOpen] = useState(false)
  const summary = count === 0 ? `未选择任何${unit.replace(/^个/, '')}` : `已选择 ${count} ${unit}`

  return (
    <View className={styles.footer}>
      {readonly ? null : open ? (
        <View className={styles.sheet}>
          {items.length === 0 ? (
            <Text className={styles.sheetEmpty}>{summary}</Text>
          ) : (
            items.map((item) => (
              <View key={item.id} className={styles.sheetRow}>
                <Text className={styles.sheetPath}>{item.path.join(' / ')}</Text>
                <Text className={styles.sheetLabel}>{item.label}</Text>
                {onRemoveItem ? (
                  <View
                    className={styles.sheetRemove}
                    aria-label={`移除-${item.label}`}
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <LineIcon name="close" size={14} color="#86909C" />
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}

      <View className={styles.bar}>
        {readonly ? (
          <Text className={styles.summary}>{summary}</Text>
        ) : (
          <View className={styles.summaryToggle} aria-label="已选清单" onClick={() => setOpen(!open)}>
            <Text className={styles.summary}>{summary}</Text>
            <LineIcon name={open ? 'chevronDown' : 'chevronRight'} size={14} color="#86909C" />
          </View>
        )}

        {readonly ? (
          <View className={cx(styles.action, styles.action--primary)} aria-label="完成" onClick={onConfirm}>
            <Text>完成</Text>
          </View>
        ) : (
          <View className={styles.actions}>
            <View className={styles.action} aria-label="取消" onClick={onCancel}>
              <Text>取消</Text>
            </View>
            <View className={cx(styles.action, styles['action--primary'])} aria-label="确定" onClick={onConfirm}>
              <Text>确定</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
```

创建 `apps/demo/app/src/components/management/SelectionFooter.module.scss`：

```scss
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-fixed);
}

.sheet {
  max-height: 40vh;
  overflow-y: auto;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-divider);
  padding-bottom: var(--safe-area-bottom);
}

.sheetRow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--list-item-height-sm);
  box-sizing: border-box;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
}

.sheetEmpty {
  display: block;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  font-size: var(--font-size-13);
  color: var(--color-text-tertiary);
}

.sheetPath {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-12);
  color: var(--color-text-tertiary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sheetLabel {
  flex-shrink: 0;
  font-size: var(--font-size-14);
  color: var(--color-text-primary);
}

.sheetRemove {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: var(--space-1);
}

.bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  padding-bottom: calc(var(--space-3) + var(--safe-area-bottom));
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-divider);
}

.summaryToggle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.summary {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-13);
  line-height: 20px;
  color: var(--color-text-secondary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
}

.action {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--button-height-lg);
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-bg-disabled);
  font-size: var(--font-size-14);
  color: var(--color-text-secondary);
}

.action--primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}
```

- [ ] **Step 4: 导出到 barrel**

在 `apps/demo/app/src/components/management/index.ts` 加入：

```ts
export { SelectionFooter } from './SelectionFooter'
export type { SelectionFooterProps, SelectionFooterItem } from './SelectionFooter'
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd apps/demo/app && node --test tests/selection-footer.test.cjs 2>&1 | tail -15
```

Expected: 6 个测试全 PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/demo/app/src/components/management/SelectionFooter.tsx apps/demo/app/src/components/management/SelectionFooter.module.scss apps/demo/app/src/components/management/index.ts apps/demo/app/tests/selection-footer.test.cjs
git commit -m "feat(app): add SelectionFooter with expandable selected-items sheet"
```

---

## Task 7: 部门层级导航选择页

**Files:**
- Create: `apps/demo/app/src/pages/system/user/departments/index.tsx`
- Create: `apps/demo/app/src/pages/system/user/departments/index.config.ts`
- Create: `apps/demo/app/src/pages/system/user/departments/index.module.scss`
- Modify: `apps/demo/app/src/constants/page-config.ts`
- Modify: `apps/demo/app/src/constants/routes.ts`
- Modify: `apps/demo/app/src/modules/registry.ts`
- Test: `apps/demo/app/tests/user-departments-page.test.cjs`

**Interfaces:**
- Consumes: `DepartmentTreeNavigator`, `SelectionFooter`, `childOf`, `findDeptPath`, `searchDepts` from `@/components/management`；`useSelectionDraft`, `DRAFT_KEYS` from `@/stores/selectionDraft`；`adminDeptApi` from `@/api`；`SYSTEM_PAGES`, `PERMS` from `@/constants/routes`；`navigateBack` from `@/utils/router`；`useRequireAuth` from `@/utils/auth-guard`
- Produces: 页面 `pages/system/user/departments/index`，URL 参数 `?id=<用户 id，可选>&ids=<逗号分隔初始选中，可选>&mode=readonly|editable`

**行为契约：**
- 初始选中 = `readDraft(DRAFT_KEYS.userDepts)`，为空时退回 `?ids=` 解析结果
- 搜索非空时，主体切换为 `searchDepts` 的扁平结果列表（每项一行，`aria-label="搜索结果-<name>"`），点击后设置 `path = findDeptPath(tree, id)`、`highlightId = id`、清空关键词，回到层级导航
- `[确定]`：`mode !== 'readonly'` 时 `writeDraft(DRAFT_KEYS.userDepts, ids)`，然后 `navigateBack()`
- **`mode === 'readonly'` 时绝不调用 `writeDraft`**（Review Focus #3）
- `[取消]`：`navigateBack()`，不写草稿
- 选中态是 `useState<number[]>`，`onToggle` 做数组增删

- [ ] **Step 1: 写失败测试**

创建 `apps/demo/app/tests/user-departments-page.test.cjs`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const TREE = [
  {
    id: 1,
    name: '上海总公司',
    children: [
      { id: 11, name: '研发部门', children: null },
      { id: 12, name: '市场部门', children: null },
    ],
  },
]

// 与 tests/user-detail.test.cjs 同样的 mock 手法：state 按调用序号持久化，
// 每次 render() 重置序号；effects 按序号比对 deps。
function mount({ params = {}, tree = TREE, draftIds } = {}) {
  const routes = []
  const back = []
  const wrote = []
  const drafted = new Map()
  if (draftIds) drafted.set('user-depts', [...draftIds])
  const states = []
  const effects = []
  let stateIndex = 0
  let effectIndex = 0
  const didShow = []

  const Page = loadTs('src/pages/system/user/departments/index.tsx', {
    react: {
      useState(initial) {
        const index = stateIndex++
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [
          states[index],
          (next) => {
            states[index] = typeof next === 'function' ? next(states[index]) : next
          },
        ]
      },
      useEffect(effect, deps) {
        const index = effectIndex++
        const prev = effects[index]
        if (!prev || deps.some((value, i) => value !== prev.deps[i])) {
          effects[index] = { deps, effect }
        }
      },
      useMemo: (fn) => fn(),
    },
    '@tarojs/components': { View: 'View', Text: 'Text', Input: 'Input' },
    '@tarojs/taro': {
      useRouter: () => ({ params }),
      useDidShow: (callback) => didShow.push(callback),
    },
    '@/components/management': {
      DepartmentTreeNavigator: 'DepartmentTreeNavigator',
      SelectionFooter: 'SelectionFooter',
      childOf: (nodes, id) => (id ? (nodes.find((n) => n.id === id)?.children ?? []) : nodes ?? []),
      findDeptPath: loadTs('src/components/management/deptTree.ts').findDeptPath,
      searchDepts: loadTs('src/components/management/deptTree.ts').searchDepts,
    },
    '@/components/feedback': { StateView: 'StateView' },
    '@/stores/selectionDraft': {
      DRAFT_KEYS: { userDepts: 'user-depts', userRoles: 'user-roles' },
      useSelectionDraft: Object.assign(
        (selector) => selector({ readDraft: (k) => drafted.get(k) ?? [], writeDraft: (k, v) => wrote.push({ key: k, ids: v }) }),
        { getState: () => ({ readDraft: (k) => drafted.get(k) ?? [], writeDraft: (k, v) => wrote.push({ key: k, ids: v }) }) },
      ),
    },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }) },
    '@/utils/router': { navigateBack: () => back.push(true), navigateTo: (p) => routes.push(p) },
    '@/api': {
      adminDeptApi: { getAdminDeptTree: async () => tree },
    },
    './index.module.scss': new Proxy({}, { get: (_, key) => key }),
  }).default

  function render() {
    stateIndex = 0
    effectIndex = 0
    didShow.length = 0
    return Page()
  }
  async function settle() {
    for (let i = 0; i < 4; i++) {
      render()
      const pending = effects.splice(0)
      for (const { effect } of pending) effect()
      for (const cb of didShow.splice(0)) cb()
      await new Promise(setImmediate)
    }
    return render()
  }
  function find(tree, pred, out = []) {
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!node || typeof node === 'string' || typeof node === 'number') return
      if (pred(node)) out.push(node)
      walk(node.props?.children)
    }
    walk(tree)
    return out
  }
  function text(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (!node) return ''
    if (Array.isArray(node)) return node.map(text).join('')
    return text(node.props?.children)
  }
  return { render, settle, find, text, wrote, back, routes }
}

test('根层渲染顶层部门', async () => {
  const page = mount()
  const tree = await page.settle()
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '部门-上海总公司').length, 1)
})

test('进入一级后渲染其子部门', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '部门-上海总公司')[0].props.onClick()
  tree = await page.settle()
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '部门-研发部门').length, 1)
})

test('确定时把当前选中写入草稿后返回', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '部门-上海总公司')[0].props.onClick()
  tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '部门-研发部门')[0].props.onClick()
  tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.deepEqual(page.wrote, [{ key: 'user-depts', ids: [11] }])
  assert.equal(page.back.length, 1)
})

test('readonly 模式确定时绝不写草稿（Review Focus #3）', async () => {
  const page = mount({ params: { mode: 'readonly' } })
  const tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '完成')[0].props.onClick()
  assert.deepEqual(page.wrote, [])
  assert.equal(page.back.length, 1)
})

test('取消时既不写草稿也只返回一次', async () => {
  const page = mount()
  const tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '取消')[0].props.onClick()
  assert.deepEqual(page.wrote, [])
  assert.equal(page.back.length, 1)
})

test('ids 查询参数作为无草稿时的初始选中', async () => {
  const page = mount({ params: { ids: '11,12' } })
  await page.settle()
  const tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.deepEqual(page.wrote[0].ids, [11, 12])
})

test('草稿优先于 ids 查询参数', async () => {
  const page = mount({ params: { ids: '11,12' }, draftIds: [99] })
  await page.settle()
  const tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.deepEqual(page.wrote[0].ids, [99])
})

test('无任何初始选中时仍能正常渲染并确定空数组（新建用户场景）', async () => {
  const page = mount({ params: {} })
  const tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.deepEqual(page.wrote, [{ key: 'user-depts', ids: [] }])
})

test('ids 参数含非数字项时被忽略', async () => {
  const page = mount({ params: { ids: '11,,abc,12' } })
  await page.settle()
  const tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.deepEqual(page.wrote[0].ids, [11, 12])
})

test('搜索后主体切换为扁平路径结果', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.type === 'Input')[0].props.onInput({ detail: { value: '研发' } })
  tree = await page.settle()
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '搜索结果-研发部门').length, 1)
  assert.match(page.text(tree), /上海总公司/)
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '部门-上海总公司').length, 0)
})

test('点击搜索结果跳进该层级并清空关键词', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.type === 'Input')[0].props.onInput({ detail: { value: '研发' } })
  tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '搜索结果-研发部门')[0].props.onClick()
  tree = await page.settle()
  // 回到层级导航，且已进到「上海总公司」这一层
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '部门-市场部门').length, 1)
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '搜索结果-研发部门').length, 0)
})

test('搜索无结果时展示空态', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.type === 'Input')[0].props.onInput({ detail: { value: '不存在' } })
  tree = await page.settle()
  assert.match(page.text(tree), /没有匹配的部门/)
})

test('面包屑回跳到根层', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '部门-上海总公司')[0].props.onClick()
  tree = await page.settle()
  // 面包屑由 mock 的 DepartmentTreeNavigator 字符串占位承载，
  // 真实回跳逻辑在 tests/dept-tree.test.cjs 中覆盖；此处只断言已进入子层
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '部门-研发部门').length, 1)
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && node --test tests/user-departments-page.test.cjs 2>&1 | tail -20
```

Expected: FAIL —— `Cannot resolve src/pages/system/user/departments/index.tsx`。

- [ ] **Step 3: 实现页面**

创建 `apps/demo/app/src/pages/system/user/departments/index.tsx`：

```tsx
import { useMemo, useState } from 'react'
import { Input, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'

import { adminDeptApi } from '@/api'
import type { AdminDept } from '@/api/admin/types'
import {
  childOf,
  DepartmentTreeNavigator,
  findDeptPath,
  searchDepts,
  SelectionFooter,
} from '@/components/management'
import { StateView } from '@/components/feedback'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { DRAFT_KEYS, useSelectionDraft } from '@/stores/selectionDraft'
import styles from './index.module.scss'

function parseIds(raw?: string): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

export default function UserDepartmentsPage() {
  const guard = useRequireAuth({ moduleId: 'system-user' })
  const { params } = useRouter()
  const readonly = params.mode === 'readonly'

  const readDraft = useSelectionDraft((state) => state.readDraft)
  const writeDraft = useSelectionDraft((state) => state.writeDraft)

  const [tree, setTree] = useState<AdminDept[] | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [path, setPath] = useState<ReturnType<typeof findDeptPath>>([])
  const [keyword, setKeyword] = useState('')
  const [highlightId, setHighlightId] = useState<number | null>(null)

  const initial = useMemo(() => {
    const drafted = readDraft(DRAFT_KEYS.userDepts)
    return drafted.length ? drafted : parseIds(params.ids)
    // 仅在首次进入时取一次，之后由本地 state 接管
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [selected, setSelected] = useState<number[]>(initial)

  useDidShow(() => {
    if (loaded) return
    setLoaded(true)
    adminDeptApi
      .getAdminDeptTree()
      .then((result) => setTree(result ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
  })

  const currentId = path.length ? path[path.length - 1].id : null
  const nodes = useMemo(() => childOf(tree, currentId), [tree, currentId])
  const hits = useMemo(() => (keyword.trim() ? searchDepts(tree, keyword) : null), [tree, keyword])

  const selectedItems = useMemo(
    () =>
      [...selected]
        .map((id) => {
          const found = findDeptPath(tree, id)
          if (!found.length) return null
          return { id, label: found[found.length - 1].name, path: found.map((p) => p.name) }
        })
        .filter((item): item is { id: number; label: string; path: string[] } => item !== null),
    [selected, tree],
  )

  const handleConfirm = () => {
    if (!readonly) writeDraft(DRAFT_KEYS.userDepts, selected)
    navigateBack()
  }

  if (!guard.ready || !guard.allowed) {
    return (
      <View className="page-container">
        <StateView kind="empty" text="无访问权限" />
      </View>
    )
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>选择部门</Text>
      </View>

      <View className={styles.search}>
        <Input
          className={styles.searchInput}
          value={keyword}
          placeholder="搜索部门名称"
          onInput={(event) => setKeyword(event.detail.value)}
        />
      </View>

      <StateView kind={error ? 'error' : loaded && !tree ? 'loading' : 'ready'} text={error} onRetry={() => setLoaded(false)}>
        {hits ? (
          <View className={styles.results}>
            {hits.length === 0 ? (
              <Text className={styles.empty}>没有匹配的部门</Text>
            ) : (
              hits.map((hit) => (
                <View
                  key={hit.node.id}
                  className={styles.resultRow}
                  aria-label={`搜索结果-${hit.node.name}`}
                  onClick={() => {
                    setPath(hit.path)
                    setHighlightId(hit.node.id)
                    setKeyword('')
                  }}
                >
                  <Text className={styles.resultPath}>{hit.path.map((p) => p.name).join(' / ')}</Text>
                  <Text className={styles.resultName}>{hit.node.name}</Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <DepartmentTreeNavigator
            nodes={nodes}
            path={path}
            selectedIds={new Set(selected)}
            highlightId={highlightId}
            readonly={readonly}
            onEnter={(node) => setPath([...path, { id: node.id, name: node.name }])}
            onToggle={(id) =>
              setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
            onCrumb={(index) => setPath(path.slice(0, index + 1))}
          />
        )}
      </StateView>

      <SelectionFooter
        count={selected.length}
        unit="个部门"
        items={selectedItems}
        readonly={readonly}
        onCancel={() => navigateBack()}
        onConfirm={handleConfirm}
        onRemoveItem={(id) => setSelected((prev) => prev.filter((x) => x !== id))}
      />
    </View>
  )
}
```

创建 `apps/demo/app/src/pages/system/user/departments/index.config.ts`：

```ts
export default definePageConfig({
  navigationBarTitleText: '选择部门',
  navigationStyle: 'custom',
})
```

创建 `apps/demo/app/src/pages/system/user/departments/index.module.scss`：

```scss
.page {
  min-height: 100vh;
  background: var(--color-bg-base);
  /* 给固定底栏留出空间 */
  padding-bottom: calc(72px + var(--safe-area-bottom));
}

.header {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--nav-bar-height);
  padding: 0 var(--space-4);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-divider);
}

.title {
  font-size: var(--font-size-17);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.search {
  padding: var(--space-3) var(--space-4);
}

.searchInput {
  height: var(--search-bar-height);
  padding: 0 var(--space-3);
  border-radius: var(--search-bar-radius);
  background: var(--search-bar-bg);
  font-size: var(--font-size-14);
  color: var(--color-text-primary);
}

.results {
  background: var(--color-bg-surface);
}

.resultRow {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
}

.resultPath {
  font-size: var(--font-size-12);
  line-height: 18px;
  color: var(--color-text-tertiary);
}

.resultName {
  font-size: var(--font-size-14);
  line-height: 22px;
  color: var(--color-text-primary);
}

.empty {
  display: block;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  font-size: var(--font-size-13);
  color: var(--color-text-tertiary);
}
```

- [ ] **Step 4: 三处路由登记**

在 `apps/demo/app/src/constants/page-config.ts` 的 `'pages/system/user/edit/index',` 之后插入：

```ts
    'pages/system/user/departments/index',
    'pages/system/user/roles/index',
```

在 `apps/demo/app/src/constants/routes.ts` 的 `userEdit: 'pages/system/user/edit/index',` 之后插入：

```ts
  userDepartments: 'pages/system/user/departments/index',
  userRoles: 'pages/system/user/roles/index',
```

在 `apps/demo/app/src/modules/registry.ts` 的 `'pages/system/user/edit/index': { moduleId: 'system-user', editUser: true },` 之后插入：

```ts
  'pages/system/user/departments/index': { moduleId: 'system-user', editUser: true },
  'pages/system/user/roles/index': { moduleId: 'system-user', editUser: true },
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd apps/demo/app && node --test tests/user-departments-page.test.cjs 2>&1 | tail -20
```

Expected: 12 个测试全 PASS（含搜索态的 3 个）。

- [ ] **Step 6: 运行全量测试与类型检查**

```bash
cd apps/demo/app && pnpm test 2>&1 | tail -15 && pnpm tsc
```

Expected: 全 PASS；`tsc` 无错误。

- [ ] **Step 7: 提交**

```bash
git add apps/demo/app/src/pages/system/user/departments apps/demo/app/src/constants/page-config.ts apps/demo/app/src/constants/routes.ts apps/demo/app/src/modules/registry.ts apps/demo/app/tests/user-departments-page.test.cjs
git commit -m "feat(app): add layer-navigating department selection page"
```

---

## Task 8: 角色列表选择页

**Files:**
- Create: `apps/demo/app/src/pages/system/user/roles/index.tsx`
- Create: `apps/demo/app/src/pages/system/user/roles/index.config.ts`
- Create: `apps/demo/app/src/pages/system/user/roles/index.module.scss`
- Test: `apps/demo/app/tests/user-roles-page.test.cjs`

**Interfaces:**
- Consumes: `SelectionFooter` from `@/components/management`；`useSelectionDraft`, `DRAFT_KEYS` from `@/stores/selectionDraft`；`adminRoleApi` from `@/api`
- Produces: 页面 `pages/system/user/roles/index`，URL 参数 `?ids=<逗号分隔>&mode=readonly|editable`。路由在 Task 7 已登记完毕，本任务不重复改注册文件。

**行为契约：** 与部门页一致，差异在于 —— 主体是扁平角色列表（无面包屑、无层级导航），搜索为客户端过滤；草稿 key 为 `DRAFT_KEYS.userRoles`；`mode=readonly` 时不写草稿。

- [ ] **Step 1: 写失败测试**

创建 `apps/demo/app/tests/user-roles-page.test.cjs`：

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const ROLES = [
  { id: 37, name: '管理员' },
  { id: 52, name: '审核员' },
  { id: 53, name: '访客' },
]

// 与 tests/user-departments-page.test.cjs 相同的 mock 手法：state 按调用序号持久化
function mount({ params = {}, roles = ROLES, draftIds } = {}) {
  const wrote = []
  const back = []
  const drafted = new Map()
  if (draftIds) drafted.set('user-roles', [...draftIds])
  const states = []
  const effects = []
  let stateIndex = 0
  let effectIndex = 0
  const didShow = []

  const Page = loadTs('src/pages/system/user/roles/index.tsx', {
    react: {
      useState(initial) {
        const index = stateIndex++
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [
          states[index],
          (next) => {
            states[index] = typeof next === 'function' ? next(states[index]) : next
          },
        ]
      },
      useEffect(effect, deps) {
        const index = effectIndex++
        const prev = effects[index]
        if (!prev || deps.some((value, i) => value !== prev.deps[i])) {
          effects[index] = { deps, effect }
        }
      },
      useMemo: (fn) => fn(),
    },
    '@tarojs/components': { View: 'View', Text: 'Text', Input: 'Input' },
    '@tarojs/taro': {
      useRouter: () => ({ params }),
      useDidShow: (callback) => didShow.push(callback),
    },
    '@/components/management': { SelectionFooter: 'SelectionFooter' },
    '@/components/feedback': { StateView: 'StateView' },
    '@/stores/selectionDraft': {
      DRAFT_KEYS: { userDepts: 'user-depts', userRoles: 'user-roles' },
      useSelectionDraft: Object.assign(
        (selector) => selector({ readDraft: (k) => drafted.get(k) ?? [], writeDraft: (k, v) => wrote.push({ key: k, ids: v }) }),
        { getState: () => ({ readDraft: (k) => drafted.get(k) ?? [], writeDraft: (k, v) => wrote.push({ key: k, ids: v }) }) },
      ),
    },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }) },
    '@/utils/router': { navigateBack: () => back.push(true) },
    '@/api': {
      adminRoleApi: {
        listAdminRoles: async () => ({ data: roles, pagination: { totalPages: 1 } }),
      },
    },
    './index.module.scss': new Proxy({}, { get: (_, key) => key }),
  }).default

  function render() {
    stateIndex = 0
    effectIndex = 0
    didShow.length = 0
    return Page()
  }
  async function settle() {
    for (let i = 0; i < 4; i++) {
      render()
      const pending = effects.splice(0)
      for (const { effect } of pending) effect()
      for (const cb of didShow.splice(0)) cb()
      await new Promise(setImmediate)
    }
    return render()
  }
  function find(tree, pred, out = []) {
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!node || typeof node === 'string' || typeof node === 'number') return
      if (pred(node)) out.push(node)
      walk(node.props?.children)
    }
    walk(tree)
    return out
  }
  function text(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (!node) return ''
    if (Array.isArray(node)) return node.map(text).join('')
    return text(node.props?.children)
  }
  return { render, settle, find, text, wrote, back }
}

test('渲染全部角色', async () => {
  const page = mount()
  const tree = await page.settle()
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '角色-管理员').length, 1)
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '角色-访客').length, 1)
})

test('点击角色切换选中并可确定', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '角色-审核员')[0].props.onClick()
  tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.deepEqual(page.wrote, [{ key: 'user-roles', ids: [52] }])
  assert.equal(page.back.length, 1)
})

test('重复点击同一角色可取消选中', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '角色-审核员')[0].props.onClick()
  tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '角色-审核员')[0].props.onClick()
  tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.deepEqual(page.wrote, [{ key: 'user-roles', ids: [] }])
})

test('readonly 模式不写草稿', async () => {
  const page = mount({ params: { mode: 'readonly' } })
  const tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '完成')[0].props.onClick()
  assert.deepEqual(page.wrote, [])
  assert.equal(page.back.length, 1)
})

test('readonly 模式下角色行不可点击', async () => {
  const page = mount({ params: { mode: 'readonly' } })
  const tree = await page.settle()
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '角色-管理员')[0].props.onClick, undefined)
})

test('草稿优先于 ids 参数', async () => {
  const page = mount({ params: { ids: '37' }, draftIds: [53] })
  await page.settle()
  const tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.deepEqual(page.wrote[0].ids, [53])
})

test('ids 参数作为初始选中', async () => {
  const page = mount({ params: { ids: '37,52' } })
  await page.settle()
  const tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.deepEqual(page.wrote[0].ids, [37, 52])
})

test('搜索按名称过滤角色', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.type === 'Input')[0].props.onInput({ detail: { value: '审核' } })
  tree = await page.settle()
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '角色-管理员').length, 0)
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '角色-审核员').length, 1)
})

test('角色为空时展示空态', async () => {
  const page = mount({ roles: [] })
  const tree = await page.settle()
  assert.match(page.text(tree), /暂无可分配角色/)
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && node --test tests/user-roles-page.test.cjs 2>&1 | tail -20
```

Expected: FAIL —— `Cannot resolve src/pages/system/user/roles/index.tsx`。

- [ ] **Step 3: 实现页面**

创建 `apps/demo/app/src/pages/system/user/roles/index.tsx`：

```tsx
import { useMemo, useState } from 'react'
import { Input, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'

import { adminRoleApi } from '@/api'
import type { AdminRole } from '@/api/admin/types'
import { SelectionFooter } from '@/components/management'
import { StateView } from '@/components/feedback'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { DRAFT_KEYS, useSelectionDraft } from '@/stores/selectionDraft'
import styles from './index.module.scss'

function parseIds(raw?: string): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

export default function UserRolesPage() {
  const guard = useRequireAuth({ moduleId: 'system-user' })
  const { params } = useRouter()
  const readonly = params.mode === 'readonly'

  const readDraft = useSelectionDraft((state) => state.readDraft)
  const writeDraft = useSelectionDraft((state) => state.writeDraft)

  const [roles, setRoles] = useState<AdminRole[] | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [keyword, setKeyword] = useState('')

  const initial = useMemo(() => {
    const drafted = readDraft(DRAFT_KEYS.userRoles)
    return drafted.length ? drafted : parseIds(params.ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [selected, setSelected] = useState<number[]>(initial)

  useDidShow(() => {
    if (loaded) return
    setLoaded(true)
    void (async () => {
      try {
        const all: AdminRole[] = []
        let page = 1
        for (;;) {
          const result = await adminRoleApi.listAdminRoles({ page, pageSize: 100 })
          all.push(...result.data)
          if (page >= result.pagination.totalPages || !result.data.length) break
          page += 1
        }
        setRoles(all)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      }
    })()
  })

  const visible = useMemo(() => {
    const kw = keyword.trim()
    if (!kw) return roles ?? []
    return (roles ?? []).filter((role) => role.name.includes(kw))
  }, [roles, keyword])

  const selectedItems = useMemo(
    () =>
      selected
        .map((id) => {
          const role = (roles ?? []).find((r) => r.id === id)
          return role ? { id, label: role.name, path: [] as string[] } : null
        })
        .filter((item): item is { id: number; label: string; path: string[] } => item !== null),
    [selected, roles],
  )

  const handleConfirm = () => {
    if (!readonly) writeDraft(DRAFT_KEYS.userRoles, selected)
    navigateBack()
  }

  if (!guard.ready || !guard.allowed) {
    return (
      <View className="page-container">
        <StateView kind="empty" text="无访问权限" />
      </View>
    )
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>选择角色</Text>
      </View>

      <View className={styles.search}>
        <Input
          className={styles.searchInput}
          value={keyword}
          placeholder="搜索角色名称"
          onInput={(event) => setKeyword(event.detail.value)}
        />
      </View>

      <StateView kind={error ? 'error' : loaded && !roles ? 'loading' : 'ready'} text={error} onRetry={() => setLoaded(false)}>
        <View className={styles.list}>
          {visible.length === 0 ? (
            <Text className={styles.empty}>{keyword.trim() ? '没有匹配的角色' : '暂无可分配角色'}</Text>
          ) : (
            visible.map((role) => {
              const checked = selected.includes(role.id)
              return (
                <View
                  key={role.id}
                  className={styles.roleRow}
                  aria-label={`角色-${role.name}`}
                  aria-checked={readonly ? undefined : checked}
                  hoverClass={readonly ? undefined : styles['roleRow--hover']}
                  onClick={readonly ? undefined : () => setSelected((prev) => (prev.includes(role.id) ? prev.filter((x) => x !== role.id) : [...prev, role.id]))}
                >
                  <View className={checked ? `${styles.checkbox} ${styles['checkbox--on']}` : styles.checkbox}>
                    {checked ? <Text className={styles.check}>✓</Text> : null}
                  </View>
                  <Text className={styles.roleName}>{role.name}</Text>
                </View>
              )
            })
          )}
        </View>
      </StateView>

      <SelectionFooter
        count={selected.length}
        unit="个角色"
        items={selectedItems}
        readonly={readonly}
        onCancel={() => navigateBack()}
        onConfirm={handleConfirm}
        onRemoveItem={(id) => setSelected((prev) => prev.filter((x) => x !== id))}
      />
    </View>
  )
}
```

创建 `apps/demo/app/src/pages/system/user/roles/index.config.ts`：

```ts
export default definePageConfig({
  navigationBarTitleText: '选择角色',
  navigationStyle: 'custom',
})
```

创建 `apps/demo/app/src/pages/system/user/roles/index.module.scss`：把 Task 7 的 `.page` / `.header` / `.title` / `.search` / `.searchInput` / `.empty` 原样复制，再加：

```scss
.list {
  background: var(--color-bg-surface);
}

.roleRow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--list-item-height-sm);
  box-sizing: border-box;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
}

.roleRow--hover {
  background: var(--color-bg-disabled);
}

.checkbox {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: var(--font-size-12);
}

.checkbox--on {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.check {
  color: var(--color-text-inverse);
  line-height: 1;
}

.roleName {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-14);
  line-height: 22px;
  color: var(--color-text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/demo/app && node --test tests/user-roles-page.test.cjs 2>&1 | tail -20
```

Expected: 9 个测试全 PASS。

- [ ] **Step 5: 运行类型检查**

```bash
cd apps/demo/app && pnpm tsc
```

Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add apps/demo/app/src/pages/system/user/roles apps/demo/app/tests/user-roles-page.test.cjs
git commit -m "feat(app): add flat role selection page sharing SelectionFooter and draft store"
```

---

## Task 9: 详情页重写

**Files:**
- Modify: `apps/demo/app/src/pages/system/user/detail/index.tsx`
- Test: `apps/demo/app/tests/user-detail.test.cjs`

**Interfaces:**
- Consumes: `buildProfileSections` from `@/pages/system/user/profileSections`；`DetailHero`, `DetailSection`, `DetailRow`, `OrganizationPicker` from `@/components/management`；`SYSTEM_PAGES` from `@/constants/routes`
- Produces: 详情页行为 —— 6 组契约渲染、账号记录默认收起、org 行带箭头且跳转只读选择页

- [ ] **Step 1: 更新测试 mock 与断言**

在 `apps/demo/app/tests/user-detail.test.cjs` 中，把 `@/components/management` mock 里的一行：

```js
      DetailHero: (props) =>
        [props.title, props.note, props.subtitle, props.footnote].filter(Boolean),
```

替换为：

```js
      DetailHero: (props) => [props.title, props.subtitle].filter(Boolean),
      OrganizationPicker: (props) => ({
        type: 'View',
        props: { 'aria-label': props.label, onClick: props.onPress },
      }),
```

并在文件末尾追加（该文件已有 `text(node)` 辅助函数，`mount()` 返回 `{ settle, render, routes, tree, nodes, button(label), click(label) }`，直接复用，不要另建 `find`）：

```js
test('详情页按契约渲染全部分组标题', async () => {
  const page = mount();
  await page.settle();
  const flat = text(page.tree);
  for (const title of ["基础信息", "联系方式", "安全设置", "组织关系", "状态", "其他属性", "账号记录"]) {
    assert.ok(flat.includes(title), `缺少分组 ${title}`);
  }
});

test('账号记录默认收起，不渲染用户 ID 行', async () => {
  const page = mount();
  await page.settle();
  const flat = text(page.tree);
  assert.ok(flat.includes("账号记录"));
  assert.ok(!flat.includes("用户 ID"), "账号记录默认收起时不应渲染其内容");
});

test("组织关系行跳转到只读模式的选择页", async () => {
  const page = mount();
  await page.settle();
  await page.click("所属部门");
  assert.ok(
    page.routes.some((r) => r.includes("departments") && r.includes("mode=readonly")),
    `期望跳到只读部门选择页，实际路由：${JSON.stringify(page.routes)}`,
  );
});

test("详情页头部不再渲染组织归属 footnote（部门名不应出现在 Hero 区）", async () => {
  const page = mount();
  await page.settle();
  const hero = page.nodes.find((n) => n.props?.className === "hero");
  assert.ok(hero, "应渲染 DetailHero");
  assert.ok(!text(hero).includes("产品部"));
});
```

> **`OrganizationPicker` 的 mock 必须带 `onPress` 映射**：上面的 mock 写成 `props => ({ type: 'View', props: { 'aria-label': props.label, onClick: props.onPress } })`，因此 `page.click("所属部门")` 才能通过 `aria-label` 找到它。若详情页里组织行的 label 不是「所属部门」（契约里就是），先跑一次 `page.nodes.map(n => n.props?.['aria-label']).filter(Boolean)` 打印实际 label 再调整。

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && node --test tests/user-detail.test.cjs 2>&1 | tail -30
```

Expected: 新增的 3 个测试 FAIL。

- [ ] **Step 3: 重写详情页渲染**

把 `apps/demo/app/src/pages/system/user/detail/index.tsx` 中 `<DetailContent>` 内的 `<DetailHero />` 与三个 `<DetailSection>` 替换为契约驱动的渲染。保留文件顶部的所有 import，新增以下 5 行（`useMemo` 若尚未 import 必须补上）：

```ts
import { useMemo } from 'react'
import { navigateTo } from '@/utils/router'
import { SYSTEM_PAGES } from '@/constants/routes'
import { buildProfileSections, UNSET } from '../profileSections'
```

替换 `<DetailContent>` 的 children 为：

```tsx
<DetailContent>
  <DetailHero
    avatar={{ src: user.avatar, name: displayName }}
    title={displayName}
    subtitle={`@${user.username}`}
    tag={<Tag size="sm" variant={status.variant}>{status.label}</Tag>}
  />
  {sections.map((section) => (
    <DetailSection key={section.key} title={section.title}>
      {section.fields.map((field) =>
        field.kind === 'org' ? (
          <OrganizationPicker
            key={field.key}
            label={field.label}
            ids={field.ids}
            names={field.names}
            onPress={() =>
              navigateTo(
                `/${SYSTEM_PAGES.userDepartments}?id=${user.id}&ids=${field.ids.join(',')}&mode=readonly`,
              )
            }
          />
        ) : (
          <DetailRow
            key={field.key}
            label={field.label}
            value={field.value}
            tone={field.value === UNSET ? 'muted' : 'default'}
          />
        ),
      )}
    </DetailSection>
  ))}
  <DetailSection title="账号记录" collapsible defaultCollapsed>
    <DetailRow label="用户 ID" value={user.id} />
    <DetailRow label="最后登录" value={formatDateTime(user.lastLoginTime)} />
    <DetailRow label="登录次数" value={user.loginCount} />
    <DetailRow label="创建人" value={user.creatorName} />
    <DetailRow label="登录 IP" value={user.lastLoginIp} />
    <DetailRow label="创建时间" value={formatDateTime(user.createdAt)} />
    <DetailRow label="更新人" value={user.updaterName} />
    <DetailRow label="更新时间" value={formatDateTime(user.updatedAt)} />
  </DetailSection>
</DetailContent>
```

注意 org 跳转的目标页由 `field.target` 决定 —— 用一个三元表达式替换上面的硬编码：

```tsx
onPress={() => {
  const page = field.target === 'roles' ? SYSTEM_PAGES.userRoles : SYSTEM_PAGES.userDepartments
  navigateTo(`/${page}?id=${user.id}&ids=${field.ids.join(',')}&mode=readonly`)
}}
```

在组件内 `useMemo` 出 `sections`（依赖 `user`、`deptNames`、`roleNames`、两个 `canRead*`）：

```ts
const sections = useMemo(
  () => buildProfileSections({ user, deptNames, roleNames, canReadDepts, canReadRoles }),
  [user, deptNames, roleNames, canReadDepts, canReadRoles],
)
```

并从 `@/pages/system/user/profileSections` 一并 import `UNSET`。原有的 `DetailHero` 调用中 **`note` 与 `footnote` 两个 prop 必须删除**（组织归属摘要已下沉到「组织关系」分组）。

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/demo/app && node --test tests/user-detail.test.cjs 2>&1 | tail -20
```

Expected: 全部 PASS（含既有断言）。

- [ ] **Step 5: 运行全量测试**

```bash
cd apps/demo/app && pnpm test 2>&1 | tail -15 && pnpm tsc
```

Expected: 全 PASS，无类型错误。

- [ ] **Step 6: 提交**

```bash
git add apps/demo/app/src/pages/system/user/detail/index.tsx apps/demo/app/tests/user-detail.test.cjs
git commit -m "refactor(app): drive user detail page from profile contract, collapse account records"
```

---

## Task 10: 编辑页重写与死代码清理

**Files:**
- Modify: `apps/demo/app/src/pages/system/user/edit/index.tsx`
- Modify: `apps/demo/app/src/pages/system/user/edit/index.module.scss`
- Modify: `apps/demo/app/src/pages/system/user/edit/constants.ts`
- Modify: `apps/demo/app/src/pages/system/user/edit/hooks/useUserEditForm.ts`
- Test: `apps/demo/app/tests/user-form.test.cjs`

**Interfaces:**
- Consumes: `buildProfileSections`, `STATUS_OPTIONS`, `GENDER_OPTIONS`, `UNSET` from `@/pages/system/user/profileSections`；`OrganizationPicker`, `FormSection`, `FormField`, `TextField`, `SegmentField`, `FormSubmitBar` from `@/components/management`；`useSelectionDraft`, `DRAFT_KEYS` from `@/stores/selectionDraft`
- Produces: 编辑页 —— 消费草稿、无 Tag 堆叠、segment 选择状态与性别

- [ ] **Step 1: 写失败测试**

在 `apps/demo/app/tests/user-form.test.cjs` 末尾追加：

```js
test('契约里状态与性别的枚举值与后端取值一致', () => {
  const { STATUS_OPTIONS, GENDER_OPTIONS } = loadTs('src/pages/system/user/profileSections.ts')
  assert.equal(STATUS_OPTIONS[0], '禁用')
  assert.equal(STATUS_OPTIONS[1], '启用')
  assert.equal(STATUS_OPTIONS[2], '锁定')
  assert.equal(GENDER_OPTIONS[0], '保密')
  assert.equal(GENDER_OPTIONS[1], '男')
  assert.equal(GENDER_OPTIONS[2], '女')
})

test('编辑页不再使用平铺 Tag 承载部门与角色', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/system/user/edit/index.tsx'),
    'utf8',
  )
  assert.ok(!source.includes('toggleDept'), '编辑页不应再直接调用 toggleDept')
  assert.ok(!source.includes('toggleRole'), '编辑页不应再直接调用 toggleRole')
})

test('编辑页不再使用 showActionSheet 做性别与状态选择', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/system/user/edit/index.tsx'),
    'utf8',
  )
  assert.ok(!source.includes('showActionSheet'), '性别与状态应改用 SegmentField')
})

test('编辑页使用 OrganizationPicker 承载组织关系', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/system/user/edit/index.tsx'),
    'utf8',
  )
  assert.ok(source.includes('OrganizationPicker'))
})

test('edit/constants.ts 不再导出与实际取值顺序相反的 options', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/system/user/edit/constants.ts'),
    'utf8',
  )
  assert.ok(!source.includes('STATUS_OPTIONS'), '选项来源应收敛到 profileSections')
  assert.ok(!source.includes('GENDER_OPTIONS'))
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/demo/app && node --test tests/user-form.test.cjs 2>&1 | tail -25
```

Expected: 后 4 个新测试 FAIL（`toggleDept` / `showActionSheet` 仍在，`OrganizationPicker` 未出现，`constants.ts` 仍导出 options）。

- [ ] **Step 3: 让 `useUserEditForm` 消费草稿**

在 `apps/demo/app/src/pages/system/user/edit/hooks/useUserEditForm.ts` 中：

1. 顶部新增 import：
```ts
import { useDidShow } from '@tarojs/taro'
import { DRAFT_KEYS, useSelectionDraft } from '@/stores/selectionDraft'
```

2. 在 `useUserEditForm` 函数体内、`return` 之前，加入：
```ts
const consumeDraft = useSelectionDraft((state) => state.consumeDraft)

useDidShow(() => {
  const deptDraft = consumeDraft(DRAFT_KEYS.userDepts)
  if (deptDraft) setDeptIds(deptDraft)
  const roleDraft = consumeDraft(DRAFT_KEYS.userRoles)
  if (roleDraft) setRoleIds(roleDraft)
})
```

3. 从 `return` 中**删除** `toggleDept` 与 `toggleRole` 两个函数（选择交互已移交给二级页）。

- [ ] **Step 4: 重写编辑页渲染**

把 `apps/demo/app/src/pages/system/user/edit/index.tsx` 的 `<View className={styles.gutter}>` 内部（现有的 5 个 `SectionHeader` + Tag chips 块）替换为契约驱动渲染：

```tsx
{sections.map((section) => (
  <View key={section.key} className={styles.group}>
    <FormSection title={section.title}>
      {section.fields.map((field) => {
        if (field.kind === 'org') {
          const page =
            field.target === 'roles' ? SYSTEM_PAGES.userRoles : SYSTEM_PAGES.userDepartments
          return (
            <OrganizationPicker
              key={field.key}
              label={field.label}
              ids={field.ids}
              names={field.names}
              onPress={() => navigateTo(`/${page}`)}
            />
          )
        }
        if (field.kind === 'secret') {
          return (
            <FormField key={field.key} label={field.label}>
              <View className={styles.readonlyValue}>
                <Text>{field.value || UNSET}</Text>
              </View>
            </FormField>
          )
        }
        if (field.kind === 'enum') {
          return (
            <FormField key={field.key} label={field.label}>
              <SegmentField
                value={field.value}
                options={field.options.map((label, index) => ({
                  label,
                  value: String(index),
                }))}
                onChange={(next) => {
                  if (field.key === 'status') values.setStatus(next)
                  else if (field.key === 'gender') values.setGender(next)
                }}
              />
            </FormField>
          )
        }
        return (
          <FormField
            key={field.key}
            label={field.label}
            required={field.key === 'username'}
            error={errors[field.key]}
          >
            {field.kind === 'date' ? (
              <Picker
                mode="date"
                value={values.birthDate}
                onChange={(event) => values.setBirthDate(String(event.detail.value))}
              >
                <View className={styles.pickerValue}>
                  <Text>{values.birthDate || UNSET}</Text>
                </View>
              </Picker>
            ) : (
              <TextField
                value={values[field.key] === UNSET ? '' : values[field.key]}
                placeholder={`请输入${field.label}`}
                onChange={(next) => values[`set${cap(field.key)}`](next)}
              />
            )}
          </FormField>
        )
      })}
    </FormSection>
  </View>
))}
```

其中 `cap` 是一个两行的小工具，放在文件顶部：

```ts
function cap(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1)
}
```

并构造 `sections`（编辑态取值来自表单 state 而非 user）：

```ts
const sections = useMemo(
  () =>
    buildProfileSections({
      user: {
        username: values.username,
        realName: values.realName,
        nickname: values.nickname,
        phone: values.phone,
        email: values.email,
        password: 'placeholder',
        loginMethod: '用户名密码',
        gender: values.gender,
        birthDate: values.birthDate,
        status: values.status,
        deptIds: values.deptIds,
        roleIds: values.roleIds,
      },
      deptNames: new Map(depts.map((d) => [d.id, d.name])),
      roleNames: new Map(roles.map((r) => [r.id, r.name])),
      canReadDepts,
      canReadRoles,
    }),
  [values, depts, roles, canReadDepts, canReadRoles],
)
```

顶部补充 imports：`OrganizationPicker`, `FormSection`, `FormField`, `TextField`, `SegmentField`, `FormSubmitBar` from `@/components/management`；`buildProfileSections`, `UNSET` from `../profileSections`；`SYSTEM_PAGES` from `@/constants/routes`；`navigateTo` from `@/utils/router`；`useMemo` from `react`。

`BottomActionBar` + `Button` 换成 `FormSubmitBar text="保存" submitting={submitting} onSubmit={handleSubmit}`。

- [ ] **Step 5: 删除死代码与死样式**

把 `apps/demo/app/src/pages/system/user/edit/constants.ts` 中未被任何文件 import 的 `GENDER_OPTIONS` / `STATUS_OPTIONS` 导出删除（选项来源已收敛到 `profileSections.ts`）。

从 `apps/demo/app/src/pages/system/user/edit/index.module.scss` 删除未被引用的 `.edit`、`.edit__chip`、`.edit__chip--active`、`.edit__chipText`，并新增：

```scss
.group {
  margin-bottom: var(--space-3);
}

.readonlyValue,
.pickerValue {
  min-height: var(--list-item-height-sm);
  display: flex;
  align-items: center;
  padding: var(--space-2) 0;
  font-size: var(--font-size-14);
  color: var(--color-text-tertiary);
}

.pickerValue {
  color: var(--color-text-primary);
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd apps/demo/app && node --test tests/user-form.test.cjs 2>&1 | tail -20
```

Expected: 全部 PASS。

- [ ] **Step 7: 全量验证**

```bash
cd apps/demo/app && pnpm test 2>&1 | tail -15 && pnpm tsc
cd /c/Users/dfy/workspace/products/yishan && pnpm lint
```

Expected: 全 PASS，无类型错误，lint 通过。

- [ ] **Step 8: 提交**

```bash
git add apps/demo/app/src/pages/system/user/edit apps/demo/app/tests/user-form.test.cjs
git commit -m "refactor(app): drive user edit page from profile contract, replace tag chips with selection pages"
```

---

## Task 11: 构建验证

**Files:** 无代码改动，只跑验证命令。

- [ ] **Step 1: 运行全量质量门禁**

```bash
cd /c/Users/dfy/workspace/products/yishan
pnpm lint
pnpm test
```

Expected: 全绿。

- [ ] **Step 2: 验证 Taro 编译（CSS Modules 是真实验证点）**

```bash
pnpm check:taro
pnpm typecheck:mobile
pnpm build:app
```

Expected: 全绿。`build:app` 会真正编译 CSS Modules —— 新增的 4 个 `.module.scss` 的语法错误只有这一步能抓到。

- [ ] **Step 3: H5 手动验收**

```bash
pnpm --filter @yishan/demo-app dev:h5
```

在浏览器中逐条确认（SCSS 无法被自动化测试覆盖，只能人工看）：

1. 用户详情页：头部无白卡，6 个分组依次渲染，分组标题是灰色小字，正文是无圆角全出血白底
2. 「账号记录」默认收起，标题右侧有 `›`，点击展开
3. 「组织关系」里所属部门显示 `研发部门、市场部门` 或 `研发部门、市场部门 等 3 个`，行尾有 `›`
4. 点部门行进入只读选择页：checkbox 不可点，底部只有「完成」按钮
5. 退出登录换一个账号重新进入，部门选择页的已选项**不应**保留上一个账号的选择
6. 编辑页：性别与状态是分段控件而非弹层；部门与角色是跳转行而非 Tag 排
7. 编辑页进入部门选择页 → 勾选 → 确定 → 返回编辑页，部门摘要已更新；此时点保存，`deptIds` 正确提交
8. 编辑页进入部门选择页 → 取消 → 返回，部门摘要保持不变
9. **详情页只读浏览部门选择页后，返回编辑页，草稿不应被污染**（Review Focus #3）

- [ ] **Step 4: 提交验证记录（如有修复）**

```bash
git add -A
git commit -m "fix(app): address mobile user detail refactor review findings"
```

若本任务未产生改动则跳过提交。