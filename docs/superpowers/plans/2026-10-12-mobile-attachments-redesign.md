# 移动端媒体库重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把移动端媒体库从单页旧式 `AdminPage` 写法重构为符合移动端规范的 6 个页面（首页 / 详情 / 编辑 / 链接导入 / 分组管理 / 分组表单），功能与接口不变。

**Architecture:** 纯函数集中在 `pages/system/attachments/model.ts`；单选分组下钻面板 `FolderTreeSheet` 在本目录内复用 3 处；共享组件只做最小扩展（`ManagementCell` 缩略图、`SelectionFooter` 确认按钮文案、`LineIcon` 两个图标）。每个页面单独注册路由、单独测试。

**Tech Stack:** Taro 4 + React 18 + TypeScript；测试为 `node --test` + `tests/helpers/load-ts.cjs`（转译真实 TS，mock 平台模块）。

**Spec:** `docs/superpowers/specs/2026-10-12-mobile-attachments-redesign-design.md`；已确认原型 `tmp/prototype/attachments.html`（本地，未入库）。

**分支：** `feat/app-attachments-redesign`（已存在，直接在其上提交，不要 push）。

## Global Constraints

- 所有命令在仓库根 `C:\Users\dfy\workspace\products\yishan`（Git Bash）或 `apps/demo/app` 下执行，下文注明。
- 遵守根 `CLAUDE.md`「Mobile form & list conventions」：标签左值右、必填 `*` 在标签前、只读行不带 `›`、单选枚举用 `Picker mode="selector"`（即 `EnumField`）、文本域用 `FormField stacked`、Checkbox 只用 `components/management/Checkbox`、两级间距（16px / 8px）、列表整宽、单行描述、**不用「·」拼接属性**。
- 不改 `src/api/admin/attachments.ts` 的函数签名。
- 每个写操作保留：`locked` ref 防重、`getSessionVersion()` 会话校验、`canWriteModuleNow` / `useCurrentModuleAccess` 权限校验。
- 权限点：查看 `system:attachment:list`；新建/上传/导入 `system:attachment:create`；编辑 `system:attachment:update`；删除 `system:attachment:delete`；七牛直传另需 `system:option:list` + `system:storage:upload-token`。
- 素材编辑保存**只提交** `{ name, folderId, status }`，`folderId` 未分组为 `null`，**绝不提交 `metadata`**。
- 文案：首页标题「媒体库」，搜索占位「搜索素材名称」，底部「共 N 个素材」，导入占位「每行一个 HTTP/HTTPS 图片链接，最多 20 个」，删除分组确认含「包含子分组或素材的分组不能删除」。
- 提交信息用 Conventional Commits，结尾加一行 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`。

## Review Focus

1. **H5 下「文件」上传被浏览器拦截**：从 ActionSheet 点「文件」必须在同一次点击回调里同步调用 `input.click()`，中间不能有 `await`。Task 3 的 `chooseFiles.h5.ts` 测试钉住"同步创建并点击 input"。
2. **编辑素材误清扩展信息**：保存 payload 必须正好是三个键。Task 1 `attachmentEditPayload` 与 Task 7 页面测试都断言 `Object.keys(payload)`。
3. **分组上级选成自己或后代造成环**：分组表单的上级选择要排除自身及全部后代。Task 2 `FolderTreeSheet` 的 `excludeIds` 与 Task 9 测试覆盖。
4. **筛选切换后残留多选**：关键词或筛选变化必须清空已选，否则会删到看不见的素材。Task 5 测试覆盖。
5. **账号切换后旧请求回写**：上传循环、删除、保存在 `await` 后都要重新校验会话与权限，不满足就停止且不 toast。Task 5、Task 6、Task 7 各有一个"会话变化后不回写"用例。

---

## File Structure

| 文件 | 职责 | 任务 |
|---|---|---|
| `apps/demo/app/src/pages/system/attachments/model.ts`（新） | 选项常量、筛选映射、大小格式化、类型推断、分组树查询、payload 构造与校验 | 1 |
| `apps/demo/app/tests/helpers/mount-page.cjs`（新） | 页面测试通用 hooks 驱动器（useState/useRef/useEffect/useMemo、Taro 生命周期） | 1 |
| `apps/demo/app/tests/attachments-model.test.cjs`（新） | model 纯函数测试 | 1 |
| `apps/demo/app/src/pages/system/attachments/FolderTreeSheet.tsx` + `.module.scss`（新） | 单选分组下钻底部面板 | 2 |
| `apps/demo/app/tests/attachments-folder-sheet.test.cjs`（新） | FolderTreeSheet 测试 | 2 |
| `apps/demo/app/src/components/management/LineIcon.tsx`（改） | 新增 `video`、`music` 图标 | 3 |
| `apps/demo/app/src/components/management/ManagementList.tsx` + `.module.scss`（改） | `ManagementCell` 新增 `thumb` 方形缩略图 | 3 |
| `apps/demo/app/src/components/management/SelectionFooter.tsx` + `.module.scss`（改） | 新增 `confirmLabel`、`confirmDanger` | 3 |
| `apps/demo/app/src/pages/system/attachments/chooseFiles.ts` / `chooseFiles.h5.ts`（新） | 平台文件选择（替代 FileUpload 组件） | 3 |
| `apps/demo/app/tests/attachments-shared-ui.test.cjs`（新） | 上述共享组件改动测试 | 3 |
| `apps/demo/app/src/constants/routes.ts`、`page-config.ts`、`src/modules/registry.ts`（改） | 新路由注册 | 4 |
| 5 个新页面目录（`detail/ form/ import/ folders/ folder-form/`）的 `index.config.ts` + 占位 `index.tsx` | 让路由先可编译 | 4 |
| `apps/demo/app/src/pages/system/attachments/index.tsx`（重写）+ `index.config.ts` + `index.module.scss` | 首页 | 5 |
| `apps/demo/app/src/pages/system/attachments/detail/index.tsx` + `index.module.scss` | 详情 | 6 |
| `apps/demo/app/src/pages/system/attachments/form/index.tsx` | 编辑 | 7 |
| `apps/demo/app/src/pages/system/attachments/import/index.tsx` | 链接导入 | 8 |
| `apps/demo/app/src/pages/system/attachments/folders/index.tsx`、`folder-form/index.tsx` | 分组管理与表单 | 9 |
| 删除 `AttachmentCard.tsx`、`FolderForm.tsx`、`FileUpload.tsx`、`FileUpload.h5.tsx` | 清理 | 10 |

---

### Task 1: model 纯函数 + 页面测试驱动器

**Files:**
- Create: `apps/demo/app/src/pages/system/attachments/model.ts`
- Create: `apps/demo/app/tests/helpers/mount-page.cjs`
- Test: `apps/demo/app/tests/attachments-model.test.cjs`

**Interfaces:**
- Produces（后续任务全部依赖，名称不可改）：
  - `KIND_OPTIONS: readonly {key: '' | AttachmentKind; label: string}[]`、`STATUS_OPTIONS`、`FOLDER_KIND_OPTIONS: readonly {value: 'all' | AttachmentKind; label: string}[]`、`STATUS_ENUM: readonly {value:'0'|'1'; label}[]`
  - `KIND_LABELS: Record<AttachmentKind, string>`、`KIND_GLYPH: Record<AttachmentKind, LineIconName>`
  - `interface AttachmentFilters { folderId: number; kind: '' | AttachmentKind; status: '' | '0' | '1' }`、`DEFAULT_ATTACHMENT_FILTERS`
  - `readAttachmentFilters(filters: Record<string, unknown>): AttachmentFilters`
  - `buildAttachmentQuery(page: number, pageSize: number, keyword: string, filters: AttachmentFilters): AttachmentQuery`
  - `formatSize(bytes: number): string`
  - `kindOfFile(file: UploadFile): AttachmentKind`
  - `findFolder(folders: AttachmentFolder[], id: number): AttachmentFolder | undefined`
  - `folderPath(folders: AttachmentFolder[], id: number): AttachmentFolder[]`
  - `folderLabel(folders: AttachmentFolder[], id: number | undefined, empty: string): string`
  - `subtreeIds(folders: AttachmentFolder[], id: number): Set<number>`（含自身）
  - `attachmentEditPayload(name: string, folderId: number, status: '0' | '1'): { name: string; folderId: number | null; status: '0' | '1' }`
  - `interface FolderFormValues { name: string; parentId: number; kind: 'all' | AttachmentKind; status: '0' | '1'; sort: string; remark: string }`
  - `folderPayload(values: FolderFormValues): FolderInput`
  - `parseImportLinks(text: string): string[]`
  - 测试驱动器 `mountPage(entry, mocks, { router? })`（见 Step 3）

- [ ] **Step 1: 写失败测试** `apps/demo/app/tests/attachments-model.test.cjs`

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const model = () => loadTs('src/pages/system/attachments/model.ts', {})

const TREE = [
  { id: 1, name: '营销素材', kind: 'all', status: '1', sort_order: 0, children: [
    { id: 2, name: '首页素材', kind: 'image', status: '1', sort_order: 0, children: [] },
    { id: 3, name: '活动海报', kind: 'all', status: '1', sort_order: 1, children: [
      { id: 4, name: '双十一', kind: 'all', status: '0', sort_order: 0 },
    ] },
  ] },
  { id: 5, name: '短视频', kind: 'video', status: '1', sort_order: 1 },
]

test('筛选映射：空值不进查询，folderId 0 表示全部', () => {
  const m = model()
  assert.deepEqual(m.readAttachmentFilters({}), { folderId: 0, kind: '', status: '' })
  assert.deepEqual(m.readAttachmentFilters({ folderId: '3', kind: 'bad', status: '2' }), { folderId: 3, kind: '', status: '' })
  assert.deepEqual(m.buildAttachmentQuery(2, 20, '  banner ', { folderId: 0, kind: '', status: '' }), { page: 2, pageSize: 20, keyword: 'banner' })
  assert.deepEqual(m.buildAttachmentQuery(1, 20, '', { folderId: 3, kind: 'image', status: '0' }), { page: 1, pageSize: 20, folderId: 3, kind: 'image', status: '0' })
})

test('文件大小格式化', () => {
  const m = model()
  assert.equal(m.formatSize(0), '0 B')
  assert.equal(m.formatSize(512), '512 B')
  assert.equal(m.formatSize(88064), '86 KB')
  assert.equal(m.formatSize(1258291), '1.2 MB')
  assert.equal(m.formatSize(19293798), '18.4 MB')
  assert.equal(m.formatSize(2147483648), '2 GB')
})

test('按 MIME 或扩展名推断类型', () => {
  const m = model()
  const f = (name, mimeType = 'application/octet-stream') => m.kindOfFile({ path: name, name, size: 1, mimeType })
  assert.equal(f('a.PNG'), 'image')
  assert.equal(f('x', 'image/webp'), 'image')
  assert.equal(f('b.mov'), 'video')
  assert.equal(f('c.m4a'), 'audio')
  assert.equal(f('d.pdf'), 'other')
})

test('分组树查询：路径、名称、子树', () => {
  const m = model()
  assert.equal(m.findFolder(TREE, 4).name, '双十一')
  assert.deepEqual(m.folderPath(TREE, 4).map((x) => x.id), [1, 3, 4])
  assert.deepEqual(m.folderPath(TREE, 99), [])
  assert.equal(m.folderLabel(TREE, 2, '未分组'), '首页素材')
  assert.equal(m.folderLabel(TREE, 0, '未分组'), '未分组')
  assert.equal(m.folderLabel(TREE, undefined, '全部分组'), '全部分组')
  assert.deepEqual([...m.subtreeIds(TREE, 1)].sort(), [1, 2, 3, 4])
  assert.deepEqual([...m.subtreeIds(TREE, 5)], [5])
})

test('编辑素材 payload 只有三个键，未分组为 null，名称必填', () => {
  const m = model()
  const payload = m.attachmentEditPayload('  banner.png ', 0, '1')
  assert.deepEqual(Object.keys(payload).sort(), ['folderId', 'name', 'status'])
  assert.deepEqual(payload, { name: 'banner.png', folderId: null, status: '1' })
  assert.deepEqual(m.attachmentEditPayload('a', 3, '0'), { name: 'a', folderId: 3, status: '0' })
  assert.throws(() => m.attachmentEditPayload('  ', 0, '1'), /请输入素材名称/)
})

test('分组 payload：名称必填、排序非负整数、备注去空白', () => {
  const m = model()
  const base = { name: ' 首页 ', parentId: 1, kind: 'image', status: '1', sort: '2', remark: ' 备注 ' }
  assert.deepEqual(m.folderPayload(base), { name: '首页', parentId: 1, kind: 'image', status: '1', sort_order: 2, remark: '备注' })
  assert.throws(() => m.folderPayload({ ...base, name: ' ' }), /请输入分组名称/)
  for (const sort of ['', '-1', '1.5', 'abc']) assert.throws(() => m.folderPayload({ ...base, sort }), /排序/)
})

test('导入链接解析：1–20 个 http(s) 链接', () => {
  const m = model()
  assert.deepEqual(m.parseImportLinks(' https://a.test/1.png \n\n http://b.test/2.jpg '), ['https://a.test/1.png', 'http://b.test/2.jpg'])
  assert.throws(() => m.parseImportLinks('   '), /请输入/)
  assert.throws(() => m.parseImportLinks('ftp://x/1.png'), /HTTP/)
  assert.throws(() => m.parseImportLinks(Array.from({ length: 21 }, (_, i) => `https://a.test/${i}.png`).join('\n')), /20/)
})
```

- [ ] **Step 2: 运行确认失败**

Run（`apps/demo/app`）: `node --test tests/attachments-model.test.cjs`
Expected: FAIL，`Cannot find module` / ENOENT `model.ts`

- [ ] **Step 3: 写测试驱动器** `apps/demo/app/tests/helpers/mount-page.cjs`

```js
const { loadTs } = require('./load-ts.cjs')

/**
 * 驱动真实页面组件：模拟 React hooks 与 Taro 生命周期。
 * JSX 组件在 mocks 里映射成字符串，页面接线通过元素 props 断言。
 */
function mountPage(entry, mocks, { router = {} } = {}) {
  const slots = []
  let cursor = 0
  let dirty = true
  let effects = []
  let tree
  const didShow = []
  const didHide = []
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (next) => {
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next
        dirty = true
      }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useMemo(factory) { cursor++; return factory() },
    useCallback(fn) { cursor++; return fn },
    useEffect(effect, deps) {
      const index = cursor++
      if (deps && slots[index]?.deps?.length === deps.length && slots[index].deps.every((v, i) => Object.is(v, deps[i]))) return
      const cleanup = slots[index]?.cleanup
      slots[index] = { deps }
      effects.push(() => { cleanup?.(); slots[index].cleanup = effect() })
    },
  }
  const taro = mocks['@tarojs/taro'] || {}
  const Page = loadTs(entry, {
    react,
    ...mocks,
    '@tarojs/taro': {
      useRouter: () => ({ params: router }),
      useDidShow: (cb) => didShow.push(cb),
      useDidHide: (cb) => didHide.push(cb),
      usePullDownRefresh: () => {},
      useReachBottom: () => {},
      ...taro,
    },
  }).default
  const nodes = (value) => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)]
  const flush = () => {
    let guard = 0
    while (dirty && guard++ < 50) {
      dirty = false
      cursor = 0
      didShow.length = 0
      didHide.length = 0
      tree = Page()
      const pending = effects
      effects = []
      pending.forEach((run) => run())
    }
    return nodes(tree)
  }
  const api = {
    flush,
    // 每轮强制重渲染：外部可变数据（如 mock 的 list.filters）变化后 effect 依赖才能被重新比较
    async settle() { for (let i = 0; i < 5; i++) { dirty = true; flush(); await new Promise(setImmediate) } return flush() },
    all: (type) => flush().filter((n) => n.type === type),
    one: (type) => flush().find((n) => n.type === type),
    byLabel: (label) => flush().find((n) => n.props?.['aria-label'] === label || n.props?.label === label),
    text: () => flush().map((n) => typeof n.props?.children === 'string' || typeof n.props?.children === 'number' ? String(n.props.children) : '').join('|'),
    show() { didShow.forEach((cb) => cb()); dirty = true; return flush() },
    rerender() { dirty = true; return flush() },
  }
  flush()
  return api
}

module.exports = { mountPage }
```

- [ ] **Step 4: 写最小实现** `apps/demo/app/src/pages/system/attachments/model.ts`

```ts
import type {
  AttachmentFolder,
  AttachmentKind,
  AttachmentQuery,
  FolderInput,
  UploadFile,
} from '@/api/admin/attachments'
import type { LineIconName } from '@/components/management'

export const KIND_LABELS: Record<AttachmentKind, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  other: '其他',
}

export const KIND_GLYPH: Record<AttachmentKind, LineIconName> = {
  image: 'image',
  video: 'video',
  audio: 'music',
  other: 'file',
}

export const KIND_OPTIONS = [
  { key: '', label: '全部类型' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'other', label: '其他' },
] as const

export const STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: '1', label: '启用' },
  { key: '0', label: '禁用' },
] as const

/** 表单用的状态枚举（EnumField 取 value/label） */
export const STATUS_ENUM = [
  { value: '1', label: '启用' },
  { value: '0', label: '禁用' },
] as const

/** 分组的素材类型限制 */
export const FOLDER_KIND_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'other', label: '其他' },
] as const

export interface AttachmentFilters {
  folderId: number
  kind: '' | AttachmentKind
  status: '' | '0' | '1'
}

export const DEFAULT_ATTACHMENT_FILTERS: AttachmentFilters = { folderId: 0, kind: '', status: '' }

const KINDS: readonly AttachmentKind[] = ['image', 'video', 'audio', 'other']

/** useListPagination 的 filters 是弱类型字典，这里收敛成筛选对象。 */
export function readAttachmentFilters(filters: Record<string, unknown>): AttachmentFilters {
  const folderId = Number(filters.folderId)
  const kind = KINDS.find((item) => item === filters.kind) ?? ''
  const status = filters.status === '0' || filters.status === '1' ? filters.status : ''
  return { folderId: Number.isInteger(folderId) && folderId > 0 ? folderId : 0, kind, status }
}

export function buildAttachmentQuery(
  page: number,
  pageSize: number,
  keyword: string,
  filters: AttachmentFilters,
): AttachmentQuery {
  const query: AttachmentQuery = { page, pageSize }
  if (keyword.trim()) query.keyword = keyword.trim()
  if (filters.folderId) query.folderId = filters.folderId
  if (filters.kind) query.kind = filters.kind
  if (filters.status) query.status = filters.status
  return query
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const text = value >= 100 || unit === 0 ? String(Math.round(value)) : String(Number(value.toFixed(1)))
  return `${text} ${units[unit]}`
}

export function kindOfFile(file: UploadFile): AttachmentKind {
  if (file.mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)) return 'image'
  if (file.mimeType.startsWith('video/') || /\.(mp4|mov|webm|avi)$/i.test(file.name)) return 'video'
  if (file.mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) return 'audio'
  return 'other'
}

export function folderPath(folders: AttachmentFolder[], id: number): AttachmentFolder[] {
  for (const folder of folders) {
    if (folder.id === id) return [folder]
    const rest = folderPath(folder.children || [], id)
    if (rest.length) return [folder, ...rest]
  }
  return []
}

export function findFolder(folders: AttachmentFolder[], id: number): AttachmentFolder | undefined {
  return folderPath(folders, id).at(-1)
}

export function folderLabel(folders: AttachmentFolder[], id: number | undefined, empty: string): string {
  if (!id) return empty
  return findFolder(folders, id)?.name ?? empty
}

/** 自身及全部后代 id，用于上级分组选择时防环 */
export function subtreeIds(folders: AttachmentFolder[], id: number): Set<number> {
  const ids = new Set<number>()
  const visit = (node: AttachmentFolder) => {
    ids.add(node.id)
    for (const child of node.children || []) visit(child)
  }
  const root = findFolder(folders, id)
  if (root) visit(root)
  return ids
}

/** 编辑素材只提交名称、分组、状态；metadata 不在移动端编辑，带上会覆盖后端的值。 */
export function attachmentEditPayload(name: string, folderId: number, status: '0' | '1') {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('请输入素材名称')
  return { name: trimmed, folderId: folderId > 0 ? folderId : null, status }
}

export interface FolderFormValues {
  name: string
  parentId: number
  kind: 'all' | AttachmentKind
  status: '0' | '1'
  sort: string
  remark: string
}

export function folderPayload(values: FolderFormValues): FolderInput {
  const name = values.name.trim()
  if (!name) throw new Error('请输入分组名称')
  if (!/^\d+$/.test(values.sort.trim())) throw new Error('排序须为非负整数')
  return {
    name,
    parentId: values.parentId,
    kind: values.kind,
    status: values.status,
    sort_order: Number(values.sort.trim()),
    remark: values.remark.trim(),
  }
}

export function parseImportLinks(text: string): string[] {
  const urls = text.split(/\s+/).map((value) => value.trim()).filter(Boolean)
  if (!urls.length) throw new Error('请输入图片链接')
  if (urls.length > 20) throw new Error('每次最多导入 20 个链接')
  if (urls.some((url) => !/^https?:\/\//i.test(url))) throw new Error('只支持 HTTP 或 HTTPS 链接')
  return urls
}
```

注意：`LineIconName` 里还没有 `video`、`music`，此时 `tsc` 会报错但 node 测试不受影响；Task 3 补上图标后类型检查恢复。

- [ ] **Step 5: 运行确认通过**

Run（`apps/demo/app`）: `node --test tests/attachments-model.test.cjs`
Expected: 7 个用例全部 PASS

- [ ] **Step 6: 提交**

```bash
git add apps/demo/app/src/pages/system/attachments/model.ts apps/demo/app/tests/helpers/mount-page.cjs apps/demo/app/tests/attachments-model.test.cjs
git commit -m "feat(app): add attachments model helpers and page test harness

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 单选分组下钻面板 FolderTreeSheet

**Files:**
- Create: `apps/demo/app/src/pages/system/attachments/FolderTreeSheet.tsx`
- Create: `apps/demo/app/src/pages/system/attachments/FolderTreeSheet.module.scss`
- Test: `apps/demo/app/tests/attachments-folder-sheet.test.cjs`

**Interfaces:**
- Consumes: `folderPath`（Task 1）
- Produces:
```ts
export interface FolderTreeSheetProps {
  open: boolean
  title: string
  folders: AttachmentFolder[]
  /** 当前选中；0 表示根选项（全部分组 / 未分组） */
  value: number
  /** 根选项文案，如「全部分组」「未分组」「顶级分组」 */
  rootLabel: string
  /** 不可选也不可进入的分组（上级分组防环） */
  excludeIds?: ReadonlySet<number>
  /** 面板底部固定入口，如「管理分组」 */
  footer?: { label: string; onClick: () => void }
  onSelect: (id: number) => void
  onClose: () => void
}
export function FolderTreeSheet(props: FolderTreeSheetProps): JSX.Element | null
```
- 交互：打开时定位到 `value` 的父层；顶部面包屑「全部」/ 各级名称可点击返回；第一行是"选择当前层"（根层显示 `rootLabel`，子层显示「全部（X）」，值为当前层分组 id）；其余每行左侧分组名（点击即选中并关闭），有子分组时右侧「下级 ›」（`aria-label="进入-<名称>"`，点击下钻不关闭）。选中行文字主色并带 ✓。禁用分组名后缀「（已禁用）」。

- [ ] **Step 1: 写失败测试** `apps/demo/app/tests/attachments-folder-sheet.test.cjs`

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const TREE = [
  { id: 1, name: '营销素材', status: '1', children: [
    { id: 2, name: '首页素材', status: '1', children: [] },
    { id: 3, name: '活动海报', status: '0', children: [{ id: 4, name: '双十一', status: '1' }] },
  ] },
  { id: 5, name: '短视频', status: '1' },
]
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })

function mount(props) {
  const calls = { select: [], close: 0, footer: 0 }
  // FolderTreeSheet 是具名导出，包一层 default 交给驱动器
  const page = mountPage('tests/fixtures/folder-sheet-host.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text', ScrollView: 'ScrollView' },
    '@/components/management': { LineIcon: 'LineIcon' },
    './FolderTreeSheet.module.scss': scss,
    '@host/props': {
      props: {
        open: true, title: '选择分组', folders: TREE, value: 0, rootLabel: '全部分组',
        onSelect: (id) => calls.select.push(id), onClose: () => calls.close++,
        ...props,
      },
    },
  })
  return { page, calls }
}

test('根层：根选项 + 顶层分组，有子分组的显示下级入口', () => {
  const { page } = mount({})
  assert.ok(page.byLabel('全部分组'))
  assert.ok(page.byLabel('营销素材'))
  assert.ok(page.byLabel('进入-营销素材'))
  assert.equal(page.byLabel('进入-短视频'), undefined)
})

test('下钻后选择子分组；禁用分组带后缀', () => {
  const { page, calls } = mount({})
  page.byLabel('进入-营销素材').props.onClick()
  page.rerender()
  assert.ok(page.byLabel('全部（营销素材）'))
  assert.ok(page.byLabel('活动海报（已禁用）'))
  page.byLabel('首页素材').props.onClick()
  assert.deepEqual(calls.select, [2])
  assert.equal(calls.close, 1)
  page.byLabel('全部（营销素材）').props.onClick()
  assert.deepEqual(calls.select, [2, 1])
})

test('打开时定位到当前值所在层，面包屑可返回根', () => {
  const { page } = mount({ value: 4 })
  assert.ok(page.byLabel('双十一'))
  page.byLabel('面包屑-全部').props.onClick()
  page.rerender()
  assert.ok(page.byLabel('营销素材'))
})

test('excludeIds 中的分组既不可选也不可进入', () => {
  const { page } = mount({ excludeIds: new Set([1, 2, 3, 4]) })
  assert.equal(page.byLabel('营销素材'), undefined)
  assert.ok(page.byLabel('短视频'))
})

test('底部入口点击触发回调并关闭', () => {
  const { page, calls } = mount({ footer: { label: '管理分组', onClick: () => calls.footer++ } })
  page.byLabel('管理分组').props.onClick()
  assert.equal(calls.footer, 1)
  assert.equal(calls.close, 1)
})
```

同时创建测试宿主 `apps/demo/app/tests/fixtures/folder-sheet-host.tsx`：

```tsx
import { props } from '@host/props'
import { FolderTreeSheet } from '../../src/pages/system/attachments/FolderTreeSheet'

export default function Host() {
  return FolderTreeSheet(props)
}
```

- [ ] **Step 2: 运行确认失败**

Run（`apps/demo/app`）: `node --test tests/attachments-folder-sheet.test.cjs`
Expected: FAIL，找不到 `FolderTreeSheet`

- [ ] **Step 3: 实现** `FolderTreeSheet.tsx`

```tsx
import { ScrollView, Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { AttachmentFolder } from '@/api/admin/attachments'
import { LineIcon } from '@/components/management'
import { folderPath } from './model'
import styles from './FolderTreeSheet.module.scss'

export interface FolderTreeSheetProps {
  open: boolean
  title: string
  folders: AttachmentFolder[]
  value: number
  rootLabel: string
  excludeIds?: ReadonlySet<number>
  footer?: { label: string; onClick: () => void }
  onSelect: (id: number) => void
  onClose: () => void
}

const nameOf = (folder: AttachmentFolder) =>
  folder.status === '0' ? `${folder.name}（已禁用）` : folder.name

/** 单选分组：逐层下钻，点名称即选中；与部门多选导航不同，不带勾选框。 */
export function FolderTreeSheet({
  open,
  title,
  folders,
  value,
  rootLabel,
  excludeIds,
  footer,
  onSelect,
  onClose,
}: FolderTreeSheetProps) {
  const [path, setPath] = useState<AttachmentFolder[]>([])
  useEffect(() => {
    // 打开时停在当前值的父层，选中项就在眼前
    if (open) setPath(folderPath(folders, value).slice(0, -1))
  }, [open, value, folders])
  if (!open) return null
  const current = path.at(-1)
  const visible = (current ? current.children || [] : folders).filter(
    (folder) => !excludeIds?.has(folder.id),
  )
  const choose = (id: number) => {
    onSelect(id)
    onClose()
  }
  const selfLabel = current ? `全部（${current.name}）` : rootLabel
  const selfValue = current ? current.id : 0
  return (
    <View className={styles.layer}>
      <View className={styles.mask} onClick={onClose} aria-label="取消选择" />
      <View className={styles.sheet}>
        <View className={styles.header}>
          <Text>{title}</Text>
          <View className={styles.close} onClick={onClose} aria-label="关闭选择">
            <LineIcon name="close" size={20} />
          </View>
        </View>
        <View className={styles.crumbs}>
          <Text className={styles.crumb} aria-label="面包屑-全部" onClick={() => setPath([])}>
            全部
          </Text>
          {path.map((folder, index) => (
            <Text
              key={folder.id}
              className={styles.crumb}
              aria-label={`面包屑-${folder.name}`}
              onClick={() => setPath(path.slice(0, index + 1))}
            >
              {` / ${folder.name}`}
            </Text>
          ))}
        </View>
        <ScrollView scrollY className={styles.options}>
          <View
            className={`${styles.option} ${value === selfValue ? styles.selected : ''}`}
            aria-label={selfLabel}
            onClick={() => choose(selfValue)}
          >
            <Text>{selfLabel}</Text>
            {value === selfValue ? <LineIcon name="check" size={18} color="#1677FF" /> : null}
          </View>
          {visible.map((folder) => {
            const children = (folder.children || []).filter((child) => !excludeIds?.has(child.id))
            return (
              <View key={folder.id} className={styles.option}>
                <View
                  className={`${styles.optionName} ${value === folder.id ? styles.selected : ''}`}
                  aria-label={nameOf(folder)}
                  onClick={() => choose(folder.id)}
                >
                  <Text>{nameOf(folder)}</Text>
                  {value === folder.id ? <LineIcon name="check" size={18} color="#1677FF" /> : null}
                </View>
                {children.length ? (
                  <View
                    className={styles.enter}
                    aria-label={`进入-${folder.name}`}
                    onClick={() => setPath([...path, folder])}
                  >
                    <Text>下级</Text>
                    <LineIcon name="chevronRight" size={14} color="#86909C" />
                  </View>
                ) : null}
              </View>
            )
          })}
        </ScrollView>
        {footer ? (
          <View
            className={styles.footer}
            aria-label={footer.label}
            onClick={() => {
              onClose()
              footer.onClick()
            }}
          >
            <Text>{footer.label}</Text>
            <LineIcon name="chevronRight" size={16} color="#1677FF" />
          </View>
        ) : null}
      </View>
    </View>
  )
}
```

`FolderTreeSheet.module.scss`（`layer/mask/sheet/header/close/options/option/selected` 与 `components/management/BottomSelectSheet.module.scss` 一致，新增 crumbs/optionName/enter/footer）：

```scss
.layer { position: fixed; inset: 0; z-index: var(--z-modal, 1000); }
.mask { position: absolute; inset: 0; background: var(--color-bg-mask); }
.sheet {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: var(--color-bg-surface);
  border-radius: 16px 16px 0 0;
  padding-bottom: var(--safe-area-bottom);
  overflow: hidden;
}
.header {
  display: flex; justify-content: space-between; align-items: center;
  height: 56px; padding: 0 16px;
  border-bottom: 1px solid var(--color-divider);
  font-weight: 600; font-size: 16px;
}
.close { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-right: -12px; }
.crumbs { padding: var(--space-3) var(--space-4); font-size: var(--font-size-13); color: var(--color-text-tertiary); }
.crumb:first-child, .crumb:not(:last-child) { color: var(--color-primary); }
.options { max-height: 50vh; }
.option {
  display: flex; align-items: center; height: 52px; padding: 0 16px;
  font-size: 14px; border-bottom: 1px solid var(--color-divider);
  color: var(--color-text-primary);
}
.option:last-child { border-bottom: 0; }
.optionName { flex: 1; height: 100%; display: flex; align-items: center; justify-content: space-between; }
.enter { display: flex; align-items: center; gap: 2px; height: 100%; padding-left: var(--space-4); color: var(--color-text-tertiary); font-size: var(--font-size-13); }
.selected { color: var(--color-primary); font-weight: 500; }
.footer {
  display: flex; justify-content: space-between; align-items: center;
  height: 52px; padding: 0 16px;
  border-top: 8px solid var(--color-bg-base);
  color: var(--color-primary); font-size: 15px;
}
```

- [ ] **Step 4: 运行确认通过**

Run（`apps/demo/app`）: `node --test tests/attachments-folder-sheet.test.cjs`
Expected: 5 个用例 PASS

- [ ] **Step 5: 提交**

```bash
git add apps/demo/app/src/pages/system/attachments/FolderTreeSheet.tsx apps/demo/app/src/pages/system/attachments/FolderTreeSheet.module.scss apps/demo/app/tests/attachments-folder-sheet.test.cjs apps/demo/app/tests/fixtures/folder-sheet-host.tsx
git commit -m "feat(app): add single-select folder drill-down sheet for attachments

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 共享组件最小扩展 + 平台文件选择

**Files:**
- Modify: `apps/demo/app/src/components/management/LineIcon.tsx`（ICONS 对象内追加两项）
- Modify: `apps/demo/app/src/components/management/ManagementList.tsx`（`ManagementCellProps` + 渲染分支）
- Modify: `apps/demo/app/src/components/management/ManagementList.module.scss`（`.row__thumb`）
- Modify: `apps/demo/app/src/components/management/SelectionFooter.tsx` + `SelectionFooter.module.scss`
- Create: `apps/demo/app/src/pages/system/attachments/chooseFiles.ts`、`chooseFiles.h5.ts`
- Test: `apps/demo/app/tests/attachments-shared-ui.test.cjs`

**Interfaces:**
- Produces:
  - `LineIconName` 新增 `'video' | 'music'`
  - `ManagementCellProps.thumb?: { src?: string; glyph: LineIconName }`（与 `avatar`/`glyph` 互斥，优先级 `thumb > avatar > glyph`）
  - `SelectionFooterProps.confirmLabel?: string`（默认「确定」）、`confirmDanger?: boolean`
  - `chooseFiles(): Promise<UploadFile[]>`（两个平台文件同签名；用户取消返回 `[]`）

- [ ] **Step 1: 写失败测试** `apps/demo/app/tests/attachments-shared-ui.test.cjs`

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })
const flat = (v) => !v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(flat) : [v, ...flat(v.props?.children)]

test('LineIcon 提供 video 与 music', () => {
  const src = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/components/management/LineIcon.tsx'), 'utf8')
  assert.match(src, /\n\s+video:/)
  assert.match(src, /\n\s+music:/)
})

test('ManagementCell 的 thumb 渲染方形缩略图并以图标兜底', () => {
  const { ManagementCell } = loadTs('src/components/management/ManagementList.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image' },
    '@/components/atoms': { AppText: 'AppText', Avatar: 'Avatar' },
    '@/components/feedback': { StateView: 'StateView' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './ManagementList.module.scss': scss,
  })
  const withSrc = flat(ManagementCell({ title: 'a.png', thumb: { src: 'https://x/a.png', glyph: 'image' } }))
  const image = withSrc.find((n) => n.type === 'Image')
  assert.equal(image.props.src, 'https://x/a.png')
  assert.equal(image.props.mode, 'aspectFill')
  assert.ok(withSrc.some((n) => n.type === 'LineIcon' && n.props.name === 'image'), '图片下层保留图标兜底')
  const noSrc = flat(ManagementCell({ title: 'b.mp4', thumb: { glyph: 'video' } }))
  assert.equal(noSrc.find((n) => n.type === 'Image'), undefined)
  assert.ok(noSrc.some((n) => n.className === 'row__thumb' || n.props?.className === 'row__thumb'))
  assert.equal(flat(ManagementCell({ title: 'c', thumb: { glyph: 'file' }, avatar: { name: 'x' } })).find((n) => n.type === 'Avatar'), undefined)
})

test('SelectionFooter 支持自定义确认文案与危险样式，默认仍是「确定」', () => {
  const { SelectionFooter } = loadTs('src/components/management/SelectionFooter.tsx', {
    react: { useState: (v) => [v, () => {}] },
    '@tarojs/components': { View: 'View', Text: 'Text' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './SelectionFooter.module.scss': scss,
  })
  const base = { count: 2, unit: '个素材', items: [], onCancel() {}, onConfirm() {} }
  const danger = flat(SelectionFooter({ ...base, confirmLabel: '删除', confirmDanger: true }))
  const btn = danger.find((n) => n.props?.['aria-label'] === '删除')
  assert.ok(btn)
  assert.match(btn.props.className, /action--danger/)
  assert.ok(flat(SelectionFooter(base)).find((n) => n.props?.['aria-label'] === '确定'))
})

test('H5 chooseFiles 在同一调用栈内创建并点击 input（不被浏览器拦截）', async () => {
  const clicks = []
  let input
  global.document = {
    createElement: (tag) => {
      input = { tag, style: {}, files: [], click() { clicks.push(tag) }, set onchange(fn) { this._change = fn }, set oncancel(fn) { this._cancel = fn } }
      return input
    },
    body: { appendChild() {}, removeChild() {} },
  }
  global.URL = { createObjectURL: (f) => `blob:${f.name}` }
  const { chooseFiles } = loadTs('src/pages/system/attachments/chooseFiles.h5.ts', {})
  const pending = chooseFiles()
  assert.deepEqual(clicks, ['input'], 'click 必须同步发生')
  assert.equal(input.type, 'file')
  assert.equal(input.multiple, true)
  input.files = [{ name: 'a.pdf', size: 3, type: 'application/pdf' }]
  input._change()
  assert.deepEqual(await pending, [{ path: 'blob:a.pdf', name: 'a.pdf', size: 3, mimeType: 'application/pdf' }])
  delete global.document
  delete global.URL
})

test('小程序 chooseFiles 用户取消返回空数组', async () => {
  const { chooseFiles } = loadTs('src/pages/system/attachments/chooseFiles.ts', {
    '@tarojs/taro': { chooseMessageFile: async () => { throw { errMsg: 'chooseMessageFile:fail cancel' } } },
  })
  assert.deepEqual(await chooseFiles(), [])
})
```

- [ ] **Step 2: 运行确认失败**

Run（`apps/demo/app`）: `node --test tests/attachments-shared-ui.test.cjs`
Expected: FAIL（无 video/music、无 thumb、无 confirmLabel、无 chooseFiles）

- [ ] **Step 3: LineIcon 追加图标**（`ICONS` 对象内，与 `image` 相邻；路径取自 lucide，ISC）

```ts
  video:
    '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
```

- [ ] **Step 4: ManagementCell 增加 thumb**

在 `ManagementList.tsx` 顶部 import 增加 `Image`：`import { Image, Text, View } from '@tarojs/components'`。
`ManagementCellProps` 在 `avatar` 之前加：

```ts
  /** 行首方形缩略图（媒体类列表）；有 src 时图片覆盖在图标上，加载失败露出图标 */
  thumb?: { src?: string; glyph: LineIconName }
```

解构参数加 `thumb,`，把行首渲染分支改为：

```tsx
      {thumb ? (
        <View className={styles.row__thumb}>
          <LineIcon name={thumb.glyph} size={20} color={glyphColor} />
          {thumb.src ? (
            <Image className={styles.row__thumbImage} src={thumb.src} mode="aspectFill" lazyLoad />
          ) : null}
        </View>
      ) : avatar ? (
```

（后面原 `avatar` / `glyph` 分支保持不变。）`ManagementList.module.scss` 追加：

```scss
.row__thumb {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-primary-bg);
}

.row__thumbImage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 5: SelectionFooter 增加确认文案与危险样式**

`SelectionFooterProps` 追加：

```ts
  /** 右侧主按钮文案，默认「确定」；删除场景传「删除」 */
  confirmLabel?: string
  /** 主按钮用危险色 */
  confirmDanger?: boolean
```

解构加 `confirmLabel = '确定', confirmDanger = false,`，把非 readonly 分支的确认按钮改为：

```tsx
            <View
              className={cx(
                styles.action,
                styles['action--primary'],
                confirmDanger && styles['action--danger'],
              )}
              aria-label={confirmLabel}
              onClick={onConfirm}
            >
              <Text>{confirmLabel}</Text>
            </View>
```

`SelectionFooter.module.scss` 追加（放在 `.action--primary` 之后以覆盖背景）：

```scss
.action--danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #fff;
}
```

- [ ] **Step 6: 平台文件选择**

`chooseFiles.ts`（小程序）：

```ts
import Taro from '@tarojs/taro'
import type { UploadFile } from '@/api/admin/attachments'

const cancelled = (reason: unknown) =>
  Boolean(reason && typeof reason === 'object' && 'errMsg' in reason && String((reason as { errMsg: unknown }).errMsg).includes('cancel'))

/** 小程序从会话选择文件；用户取消返回空数组。 */
export async function chooseFiles(): Promise<UploadFile[]> {
  try {
    const result = await Taro.chooseMessageFile({ count: 9, type: 'all' })
    return result.tempFiles.map((file) => ({
      path: file.path,
      name: file.name,
      size: file.size,
      mimeType: 'application/octet-stream',
    }))
  } catch (reason) {
    if (cancelled(reason)) return []
    throw reason
  }
}
```

`chooseFiles.h5.ts`（H5；Taro 按 `.h5.ts` 后缀自动替换）：

```ts
import type { UploadFile } from '@/api/admin/attachments'

/**
 * H5 文件选择。必须在用户点击的同一调用栈内调用：input.click() 同步发生，
 * 前面有任何 await 浏览器都会拦截弹窗。调用方用完后自行 URL.revokeObjectURL。
 */
export function chooseFiles(): Promise<UploadFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)
    const done = (files: UploadFile[]) => {
      document.body.removeChild(input)
      resolve(files)
    }
    input.onchange = () =>
      done(
        Array.from(input.files || []).map((file) => ({
          path: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        })),
      )
    input.oncancel = () => done([])
    input.click()
  })
}
```

- [ ] **Step 7: 运行确认通过 + 回归共享组件测试**

Run（`apps/demo/app`）: `node --test tests/attachments-shared-ui.test.cjs tests/selection-footer.test.cjs tests/management-list-headers.test.cjs tests/detail-layout.test.cjs`
Expected: 全部 PASS（旧用例不受影响）

Run（仓库根）: `pnpm typecheck:mobile`
Expected: 退出码 0（Task 1 中 `KIND_GLYPH` 的类型错误此时消失）

- [ ] **Step 8: 提交**

```bash
git add apps/demo/app/src/components/management/LineIcon.tsx apps/demo/app/src/components/management/ManagementList.tsx apps/demo/app/src/components/management/ManagementList.module.scss apps/demo/app/src/components/management/SelectionFooter.tsx apps/demo/app/src/components/management/SelectionFooter.module.scss apps/demo/app/src/pages/system/attachments/chooseFiles.ts apps/demo/app/src/pages/system/attachments/chooseFiles.h5.ts apps/demo/app/tests/attachments-shared-ui.test.cjs
git commit -m "feat(app): add media thumbnails, danger selection footer and file chooser

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 注册 5 个新页面（占位）

**Files:**
- Modify: `apps/demo/app/src/constants/routes.ts`（`SYSTEM_PAGES`，紧跟 `attachments`）
- Modify: `apps/demo/app/src/constants/page-config.ts`（紧跟 `'pages/system/attachments/index'`）
- Modify: `apps/demo/app/src/modules/registry.ts`（`SECONDARY_MODULE_PAGES`）
- Create: `apps/demo/app/src/pages/system/attachments/{detail,form,import,folders,folder-form}/index.config.ts` 与占位 `index.tsx`
- Test: `apps/demo/app/tests/attachments-routes.test.cjs`

**Interfaces:**
- Produces: `SYSTEM_PAGES.attachmentDetail | attachmentForm | attachmentImport | attachmentFolders | attachmentFolderForm`

- [ ] **Step 1: 写失败测试** `apps/demo/app/tests/attachments-routes.test.cjs`

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const src = (file) => fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8')
const PAGES = {
  attachmentDetail: ['detail', null],
  attachmentForm: ['form', "['system:attachment:update']"],
  attachmentImport: ['import', "['system:attachment:create']"],
  attachmentFolders: ['folders', null],
  attachmentFolderForm: ['folder-form', null],
}

test('媒体库新页面已注册路由、页面配置与模块访问', () => {
  for (const [key, [dir, permissions]] of Object.entries(PAGES)) {
    const page = `pages/system/attachments/${dir}/index`
    assert.match(src('constants/routes.ts'), new RegExp(`${key}: '${page}'`))
    assert.match(src('constants/page-config.ts'), new RegExp(`'${page}'`))
    const entry = new RegExp(`'${page}': \\{\\s*moduleId: 'system-attachments'${permissions ? `,\\s*permissions: ${permissions.replace(/[[\]]/g, '\\$&')}` : ''}`)
    assert.match(src('modules/registry.ts'), entry, page)
    assert.ok(fs.existsSync(path.resolve(__dirname, '../src', `${page}.tsx`)))
    assert.match(src(`pages/system/attachments/${dir}/index.config.ts`), /navigationStyle: 'custom'/)
  }
})
```

- [ ] **Step 2: 运行确认失败**

Run（`apps/demo/app`）: `node --test tests/attachments-routes.test.cjs`
Expected: FAIL

- [ ] **Step 3: 注册**

`routes.ts` 在 `attachments: 'pages/system/attachments/index',` 之后加：

```ts
  attachmentDetail: 'pages/system/attachments/detail/index',
  attachmentForm: 'pages/system/attachments/form/index',
  attachmentImport: 'pages/system/attachments/import/index',
  attachmentFolders: 'pages/system/attachments/folders/index',
  attachmentFolderForm: 'pages/system/attachments/folder-form/index',
```

`page-config.ts` 在 `'pages/system/attachments/index',` 之后加：

```ts
    'pages/system/attachments/detail/index',
    'pages/system/attachments/form/index',
    'pages/system/attachments/import/index',
    'pages/system/attachments/folders/index',
    'pages/system/attachments/folder-form/index',
```

`registry.ts` 的 `SECONDARY_MODULE_PAGES` 末尾（`role/permissions` 等条目之后）加：

```ts
  'pages/system/attachments/detail/index': { moduleId: 'system-attachments' },
  'pages/system/attachments/form/index': {
    moduleId: 'system-attachments',
    permissions: ['system:attachment:update'],
  },
  'pages/system/attachments/import/index': {
    moduleId: 'system-attachments',
    permissions: ['system:attachment:create'],
  },
  'pages/system/attachments/folders/index': { moduleId: 'system-attachments' },
  'pages/system/attachments/folder-form/index': { moduleId: 'system-attachments' },
```

五个目录各建 `index.config.ts`（标题分别为「素材详情」「编辑素材」「链接导入」「分组管理」「分组」）：

```ts
export default definePageConfig({
  navigationBarTitleText: '素材详情',
  navigationStyle: 'custom',
})
```

各建占位 `index.tsx`（后续任务整体替换）：

```tsx
import { ManagementPage } from '@/components/management'

export default function Placeholder() {
  return <ManagementPage>{null}</ManagementPage>
}
```

- [ ] **Step 4: 运行确认通过 + 类型检查**

Run（`apps/demo/app`）: `node --test tests/attachments-routes.test.cjs tests/modules.test.cjs tests/router.test.cjs`
Expected: PASS
Run（仓库根）: `pnpm typecheck:mobile`
Expected: 退出码 0

- [ ] **Step 5: 提交**

```bash
git add apps/demo/app/src/constants/routes.ts apps/demo/app/src/constants/page-config.ts apps/demo/app/src/modules/registry.ts apps/demo/app/src/pages/system/attachments/detail apps/demo/app/src/pages/system/attachments/form apps/demo/app/src/pages/system/attachments/import apps/demo/app/src/pages/system/attachments/folders apps/demo/app/src/pages/system/attachments/folder-form apps/demo/app/tests/attachments-routes.test.cjs
git commit -m "feat(app): register attachments detail, form, import and folder pages

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 媒体库首页重写

**Files:**
- Rewrite: `apps/demo/app/src/pages/system/attachments/index.tsx`
- Modify: `apps/demo/app/src/pages/system/attachments/index.config.ts`（加 `enablePullDownRefresh: true`、`navigationStyle: 'custom'`，参照 `pages/system/position/index.config.ts`）
- Test: `apps/demo/app/tests/attachments-page.test.cjs`

**Interfaces:**
- Consumes: Task 1 全部常量与函数；Task 2 `FolderTreeSheet`；Task 3 `thumb`、`confirmLabel/confirmDanger`、`chooseFiles`；Task 4 `SYSTEM_PAGES.*`
- API：`listAttachments`、`getFolderTree`、`getCloudUploadConfig`、`uploadAttachment(file, { folderId?, kind }, cloud?)`、`batchDeleteAttachments(ids)`、`attachmentUrl(item, domain?)`

- [ ] **Step 1: 写失败测试** `apps/demo/app/tests/attachments-page.test.cjs`

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const ITEMS = [
  { id: 1, name: 'banner.png', originalName: 'b.png', kind: 'image', size: 1258291, status: '1', storage: 'local', path: '/u/b.png' },
  { id: 2, name: '', originalName: '介绍.mp4', kind: 'video', size: 100, status: '0', storage: 'local' },
]
const FOLDERS = [{ id: 7, name: '首页素材', status: '1', children: [] }]
const ALL = ['system:attachment:list', 'system:attachment:create', 'system:attachment:delete', 'system:attachment:update', 'system:option:list', 'system:storage:upload-token']

function mount({ permissions = ALL, cloud = { provider: 'disabled' }, confirm = true, session } = {}) {
  const calls = { deleted: [], uploads: [], navigate: [], toasts: [], queries: [] }
  let options
  const list = { list: ITEMS, total: 2, loading: false, refreshing: false, loadingMore: false, finished: true, error: null, keyword: '', filters: { folderId: 0, kind: '', status: '' }, refreshed: 0 }
  list.setKeyword = (k) => { list.keyword = k }
  list.setFilters = (patch) => { list.filters = { ...list.filters, ...patch } }
  list.refresh = async () => { list.refreshed++ }
  let version = 1
  const page = mountPage('src/pages/system/attachments/index.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text' },
    '@tarojs/taro': {
      showToast: (o) => calls.toasts.push(o.title),
      pageScrollTo: async () => {},
      chooseImage: async () => ({ tempFiles: [{ path: 'p1', size: 10, type: 'image/png', originalFileObj: { name: 'a.png' } }] }),
      chooseVideo: async () => ({ tempFilePath: 'v.mp4', size: 20 }),
    },
    '@/api/admin/attachments': {
      listAttachments: async (query) => { calls.queries.push(query); return { data: [], pagination: { total: 0 } } },
      getFolderTree: async () => FOLDERS,
      getCloudUploadConfig: async () => cloud,
      uploadAttachment: async (file, meta, c) => { calls.uploads.push({ name: file.name, meta, cloud: Boolean(c) }); if (session) version++ ; return [] },
      batchDeleteAttachments: async (ids) => { calls.deleted.push(ids) },
      attachmentUrl: (item) => item.path ? `https://api.test${item.path}` : '',
    },
    '@/api/client': { getSessionVersion: () => version },
    '@/components/atoms': { Tag: 'Tag' },
    '@/components/management': Object.fromEntries(['ActionSheet', 'Checkbox', 'BottomSelectSheet', 'ManagementCell', 'ManagementFilterBar', 'ManagementFilterClear', 'ManagementFilterTriggers', 'ManagementHeaderAction', 'ManagementList', 'ManagementListFooter', 'ManagementPage', 'ManagementPageHeader', 'ManagementSearchBar', 'ManagementStates', 'SelectionFooter'].map((k) => [k, k])),
    '@/constants/routes': { SYSTEM_PAGES: { attachmentDetail: 'D', attachmentImport: 'I', attachmentFolders: 'F' } },
    '@/hooks': {
      useCanWrite: (...codes) => codes.every((c) => permissions.includes(c)),
      useListPagination: (o) => { options = o; return list },
      confirmAction: async () => confirm,
    },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      useCurrentModuleAccess: () => (required = []) => required.every((c) => permissions.includes(c)),
    },
    '@/utils/router': { navigateTo: (url) => calls.navigate.push(url) },
    '../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
    './chooseFiles': { chooseFiles: async () => [{ path: 'f', name: 'c.pdf', size: 1, mimeType: 'application/pdf' }] },
    './FolderTreeSheet': { FolderTreeSheet: 'FolderTreeSheet' },
  })
  return { page, calls, list, fetcher: () => options.fetcher }
}

test('fetcher 把关键词与筛选映射为查询参数', async () => {
  const { fetcher, calls } = mount()
  const result = await fetcher()({ page: 1, pageSize: 20, keyword: ' a ', filters: { folderId: 7, kind: 'image', status: '0' } })
  assert.deepEqual(calls.queries, [{ page: 1, pageSize: 20, keyword: 'a', folderId: 7, kind: 'image', status: '0' }])
  assert.deepEqual(result, { list: [], total: 0 })
})

test('列表行：缩略图、标题回退原始名、单行大小描述、仅禁用显示标签、点行进详情', async () => {
  const { page, calls } = mount()
  await page.settle()
  const cells = page.all('ManagementCell')
  assert.equal(cells.length, 2)
  assert.deepEqual(cells[0].props.thumb, { src: 'https://api.test/u/b.png', glyph: 'image' })
  assert.equal(cells[0].props.description, '1.2 MB')
  assert.equal(cells[0].props.tag, undefined)
  assert.equal(cells[1].props.title, '介绍.mp4')
  assert.deepEqual(cells[1].props.thumb, { src: undefined, glyph: 'video' })
  assert.ok(cells[1].props.tag)
  cells[0].props.onClick()
  assert.deepEqual(calls.navigate, ['/D?id=1'])
})

test('无 create 权限不显示上传；无 delete 权限不显示管理', async () => {
  const { page } = mount({ permissions: ['system:attachment:list'] })
  await page.settle()
  assert.equal(page.byLabel('上传'), undefined)
  assert.equal(page.byLabel('管理'), undefined)
})

test('上传面板：七牛选项只在配置七牛且有权限时出现', async () => {
  const off = mount()
  await off.page.settle()
  off.page.byLabel('上传').props.onClick()
  assert.equal(off.page.one('ActionSheet').props.items.some((i) => i.label === '上传到七牛云'), false)
  const on = mount({ cloud: { provider: 'qiniu', domain: 'cdn.test' } })
  await on.page.settle()
  on.page.byLabel('上传').props.onClick()
  assert.ok(on.page.one('ActionSheet').props.items.some((i) => i.label === '上传到七牛云'))
})

test('上传图片到当前分组并刷新列表', async () => {
  const { page, calls, list } = mount()
  list.filters = { folderId: 7, kind: '', status: '' }
  await page.settle()
  page.byLabel('上传').props.onClick()
  page.one('ActionSheet').props.items.find((i) => i.label === '图片').onClick()
  await page.settle()
  assert.deepEqual(calls.uploads, [{ name: 'a.png', meta: { folderId: 7, kind: 'image' }, cloud: false }])
  assert.ok(calls.toasts.includes('已上传 1 个文件'))
  assert.ok(list.refreshed >= 1)
})

test('链接导入带当前分组跳转', async () => {
  const { page, calls, list } = mount()
  list.filters = { folderId: 7, kind: '', status: '' }
  await page.settle()
  page.byLabel('上传').props.onClick()
  page.one('ActionSheet').props.items.find((i) => i.label === '链接导入').onClick()
  assert.deepEqual(calls.navigate, ['/I?folderId=7'])
})

test('多选删除：确认后批量删除并退出多选；取消确认不发请求', async () => {
  const { page, calls } = mount()
  await page.settle()
  page.byLabel('管理').props.onClick()
  page.rerender()
  page.all('ManagementCell')[0].props.onClick()
  page.all('ManagementCell')[1].props.onClick()
  page.rerender()
  const footer = page.one('SelectionFooter')
  assert.equal(footer.props.count, 2)
  assert.equal(footer.props.confirmLabel, '删除')
  assert.equal(footer.props.confirmDanger, true)
  footer.props.onConfirm()
  await page.settle()
  assert.deepEqual(calls.deleted, [[1, 2]])
  assert.equal(page.one('SelectionFooter'), undefined)
  const cancelled = mount({ confirm: false })
  await cancelled.page.settle()
  cancelled.page.byLabel('管理').props.onClick()
  cancelled.page.rerender()
  cancelled.page.all('ManagementCell')[0].props.onClick()
  cancelled.page.rerender()
  cancelled.page.one('SelectionFooter').props.onConfirm()
  await cancelled.page.settle()
  assert.deepEqual(cancelled.calls.deleted, [])
})

test('筛选或关键词变化清空已选', async () => {
  const { page, list } = mount()
  await page.settle()
  page.byLabel('管理').props.onClick()
  page.rerender()
  page.all('ManagementCell')[0].props.onClick()
  page.rerender()
  assert.equal(page.one('SelectionFooter').props.count, 1)
  list.filters = { ...list.filters, kind: 'image' }
  await page.settle()
  assert.equal(page.one('SelectionFooter').props.count, 0)
})

test('分组筛选面板底部有「管理分组」入口，不依赖上传权限', async () => {
  const { page, calls } = mount({ permissions: ['system:attachment:list'] })
  await page.settle()
  const sheet = page.one('FolderTreeSheet')
  assert.equal(sheet.props.footer.label, '管理分组')
  sheet.props.footer.onClick()
  assert.deepEqual(calls.navigate, ['/F'])
})

test('上传中会话切换：停止后续文件且不 toast', async () => {
  const { page, calls } = mount({ session: true })
  await page.settle()
  page.byLabel('上传').props.onClick()
  page.one('ActionSheet').props.items.find((i) => i.label === '图片').onClick()
  await page.settle()
  assert.equal(calls.uploads.length, 1)
  assert.equal(calls.toasts.includes('已上传 1 个文件'), false)
})
```

- [ ] **Step 2: 运行确认失败**

Run（`apps/demo/app`）: `node --test tests/attachments-page.test.cjs`
Expected: FAIL（旧页面结构不匹配）

- [ ] **Step 3: 重写首页** `index.tsx`

```tsx
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import {
  type Attachment,
  type AttachmentFolder,
  attachmentUrl,
  batchDeleteAttachments,
  type CloudUploadConfig,
  getCloudUploadConfig,
  getFolderTree,
  listAttachments,
  type UploadFile,
  uploadAttachment,
} from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import { Tag } from '@/components/atoms'
import {
  ActionSheet,
  type ActionSheetItem,
  BottomSelectSheet,
  Checkbox,
  ManagementCell,
  ManagementFilterBar,
  ManagementFilterClear,
  ManagementFilterTriggers,
  ManagementHeaderAction,
  ManagementList,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
  SelectionFooter,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { confirmAction, useCanWrite, useListPagination } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../_shared/AdminUI'
import { chooseFiles } from './chooseFiles'
import { FolderTreeSheet } from './FolderTreeSheet'
import {
  buildAttachmentQuery,
  DEFAULT_ATTACHMENT_FILTERS,
  folderLabel,
  formatSize,
  KIND_GLYPH,
  KIND_OPTIONS,
  kindOfFile,
  readAttachmentFilters,
  STATUS_OPTIONS,
} from './model'

const CREATE = 'system:attachment:create'
const DELETE = 'system:attachment:delete'
const CLOUD = [CREATE, 'system:option:list', 'system:storage:upload-token']

function AttachmentsPage() {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const isCurrent = useCurrentModuleAccess('system-attachments')
  const canCreate = useCanWrite(CREATE)
  const canDelete = useCanWrite(DELETE)
  const canCloud = useCanWrite(...CLOUD)
  const canReadOptions = useCanWrite('system:option:list')
  const [panel, setPanel] = useState<string | null>(null)
  const [uploadSheet, setUploadSheet] = useState<'local' | 'cloud' | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [cloud, setCloud] = useState<CloudUploadConfig | undefined>()
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const list = useListPagination<Attachment>({
    enabled: guard.ready && guard.allowed,
    initialFilters: { ...DEFAULT_ATTACHMENT_FILTERS },
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const result = await listAttachments(
        buildAttachmentQuery(page, pageSize, keyword, readAttachmentFilters(filters)),
      )
      return { list: result.data, total: result.pagination.total }
    },
  })
  const filters = readAttachmentFilters(list.filters)

  // 筛选变化后看不到的素材不能还挂在已选里，否则会被一起删掉
  useEffect(() => {
    setSelected([])
  }, [list.keyword, list.filters])

  const loadFolders = () => {
    getFolderTree()
      .then((data) => setFolders(data))
      .catch(() => {
        // 分组树只用于筛选与显示名称，失败时保留「全部分组」
      })
  }
  useEffect(() => {
    if (!guard.ready || !guard.allowed) return
    loadFolders()
    if (!canReadOptions) return
    getCloudUploadConfig()
      .then(setCloud)
      .catch(() => setCloud(undefined))
  }, [guard.ready, guard.allowed, canReadOptions])
  useDidShow(() => {
    if (!guard.ready || !guard.allowed) return
    loadFolders()
    void list.refresh()
  })
  useDidHide(() => {
    setPanel(null)
    setUploadSheet(null)
  })

  const changeFilters = (patch: Record<string, unknown>) => {
    list.setFilters(patch)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const clearFilters = () => {
    list.setKeyword('')
    changeFilters({ ...DEFAULT_ATTACHMENT_FILTERS })
  }

  async function upload(files: UploadFile[], useCloud: boolean) {
    const required = useCloud ? CLOUD : [CREATE]
    if (!files.length || locked.current || !isCurrent(required)) return
    const session = getSessionVersion()
    const current = () => session === getSessionVersion() && isCurrent(required)
    locked.current = true
    setBusy(true)
    let uploaded = 0
    try {
      for (const file of files) {
        if (!current()) return
        await uploadAttachment(
          file,
          { folderId: filters.folderId || undefined, kind: kindOfFile(file) },
          useCloud ? cloud : undefined,
        )
        if (!current()) return
        uploaded++
      }
      void Taro.showToast({ title: `已上传 ${uploaded} 个文件`, icon: 'success' })
      void list.refresh()
    } catch (reason) {
      if (!current()) return
      const done = uploaded ? `，已成功上传 ${uploaded} 个` : ''
      void Taro.showToast({ title: `${errorMessage(reason)}${done}`, icon: 'none' })
      if (uploaded) void list.refresh()
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  const cancelled = (reason: unknown) =>
    Boolean(reason && typeof reason === 'object' && 'errMsg' in reason && String((reason as { errMsg: unknown }).errMsg).includes('cancel'))

  async function pickImages(useCloud: boolean) {
    try {
      const result = await Taro.chooseImage({ count: 9 })
      await upload(
        result.tempFiles.map((file) => ({
          path: file.path,
          name: file.originalFileObj?.name || file.path.split('/').pop() || 'image.jpg',
          size: file.size,
          mimeType: file.type || 'image/jpeg',
        })),
        useCloud,
      )
    } catch (reason) {
      if (!cancelled(reason)) void Taro.showToast({ title: errorMessage(reason), icon: 'none' })
    }
  }
  async function pickVideo(useCloud: boolean) {
    try {
      const result = await Taro.chooseVideo({ sourceType: ['album', 'camera'] })
      await upload(
        [{ path: result.tempFilePath, name: result.tempFilePath.split('/').pop() || 'video.mp4', size: result.size, mimeType: 'video/mp4' }],
        useCloud,
      )
    } catch (reason) {
      if (!cancelled(reason)) void Taro.showToast({ title: errorMessage(reason), icon: 'none' })
    }
  }
  function pickFiles(useCloud: boolean) {
    // H5 下 chooseFiles 内部同步 click()，这里不能先 await 别的东西
    chooseFiles()
      .then(async (files) => {
        try {
          await upload(files, useCloud)
        } finally {
          if (process.env.TARO_ENV === 'h5') for (const file of files) URL.revokeObjectURL(file.path)
        }
      })
      .catch((reason) => void Taro.showToast({ title: errorMessage(reason), icon: 'none' }))
  }

  const sourceItems = (useCloud: boolean): ActionSheetItem[] => [
    { key: 'image', label: '图片', icon: 'image', onClick: () => { setUploadSheet(null); void pickImages(useCloud) } },
    { key: 'video', label: '视频', icon: 'video', onClick: () => { setUploadSheet(null); void pickVideo(useCloud) } },
    { key: 'file', label: '文件', icon: 'file', onClick: () => { setUploadSheet(null); pickFiles(useCloud) } },
  ]
  const uploadItems: ActionSheetItem[] =
    uploadSheet === 'cloud'
      ? sourceItems(true)
      : [
          ...sourceItems(false),
          {
            key: 'import',
            label: '链接导入',
            icon: 'globe',
            onClick: () => {
              setUploadSheet(null)
              navigateTo(`/${SYSTEM_PAGES.attachmentImport}${filters.folderId ? `?folderId=${filters.folderId}` : ''}`)
            },
          },
          ...(cloud?.provider === 'qiniu' && canCloud
            ? [{ key: 'cloud', label: '上传到七牛云', icon: 'cloud' as const, onClick: () => setUploadSheet('cloud') }]
            : []),
        ]

  async function removeSelected() {
    if (!selected.length || locked.current || !isCurrent([DELETE])) return
    const session = getSessionVersion()
    const current = () => session === getSessionVersion() && isCurrent([DELETE])
    locked.current = true
    setBusy(true)
    try {
      const ok = await confirmAction({ title: '删除素材', content: `确认删除已选择的 ${selected.length} 个素材？` })
      if (!ok || !current()) return
      await batchDeleteAttachments(selected)
      if (!current()) return
      setSelected([])
      setSelecting(false)
      void Taro.showToast({ title: '已删除', icon: 'success' })
      void list.refresh()
    } catch (reason) {
      if (current()) void Taro.showToast({ title: errorMessage(reason), icon: 'none' })
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const filtered = Boolean(list.keyword || filters.folderId || filters.kind || filters.status)
  const kind = list.error
    ? 'error'
    : list.loading && !list.list.length
      ? 'loading'
      : !list.list.length
        ? 'empty'
        : 'ready'
  const kindLabel = KIND_OPTIONS.find((option) => option.key === filters.kind)?.label ?? '全部类型'
  const statusLabel = STATUS_OPTIONS.find((option) => option.key === filters.status)?.label ?? '全部状态'
  const toggle = (id: number) =>
    setSelected((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]))

  return (
    <ManagementPage>
      <ManagementPageHeader
        title="媒体库"
        action={
          selecting ? (
            <ManagementHeaderAction label="完成" onClick={() => { setSelecting(false); setSelected([]) }} />
          ) : (
            <View style={{ display: 'flex', gap: '16px' }}>
              {canDelete ? <ManagementHeaderAction label="管理" onClick={() => setSelecting(true)} /> : null}
              {canCreate ? <ManagementHeaderAction label="上传" onClick={() => setUploadSheet('local')} /> : null}
            </View>
          )
        }
      />
      <ManagementFilterBar>
        <ManagementSearchBar value={list.keyword} onChange={list.setKeyword} placeholder="搜索素材名称" />
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={(key) => setPanel(panel === key ? null : key)}
          triggers={[
            { key: 'folder', label: folderLabel(folders, filters.folderId, '全部分组'), active: Boolean(filters.folderId) },
            { key: 'kind', label: kindLabel, active: Boolean(filters.kind) },
            { key: 'status', label: statusLabel, active: Boolean(filters.status) },
          ]}
        />
      </ManagementFilterBar>
      <FolderTreeSheet
        open={panel === 'folder'}
        title="选择分组"
        folders={folders}
        value={filters.folderId}
        rootLabel="全部分组"
        footer={{ label: '管理分组', onClick: () => navigateTo(`/${SYSTEM_PAGES.attachmentFolders}`) }}
        onSelect={(folderId) => changeFilters({ folderId })}
        onClose={() => setPanel(null)}
      />
      <BottomSelectSheet
        open={panel === 'kind' || panel === 'status'}
        title={panel === 'kind' ? '素材类型' : '素材状态'}
        options={panel === 'kind' ? KIND_OPTIONS : STATUS_OPTIONS}
        value={panel === 'kind' ? filters.kind : filters.status}
        onSelect={(key) => changeFilters(panel === 'kind' ? { kind: key } : { status: key })}
        onClose={() => setPanel(null)}
      />
      <ActionSheet
        open={uploadSheet !== null}
        title={uploadSheet === 'cloud' ? '上传到七牛云' : `上传到「${folderLabel(folders, filters.folderId, '未分组')}」`}
        items={uploadItems}
        onClose={() => setUploadSheet(null)}
      />
      {kind === 'empty' && filtered ? <ManagementFilterClear onClick={clearFilters} /> : null}
      <ManagementStates
        kind={kind}
        errorText={list.error || undefined}
        emptyText={filtered ? '未找到符合条件的素材' : '暂无素材'}
        onRetry={list.refresh}
      >
        <ManagementList>
          {list.list.map((item, index) => (
            <View key={item.id} style={selecting ? { display: 'flex', alignItems: 'center', paddingLeft: '16px' } : undefined}>
              {selecting ? <Checkbox checked={selected.includes(item.id)} /> : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <ManagementCell
                  bordered={index < list.list.length - 1}
                  thumb={{
                    src: item.kind === 'image' ? attachmentUrl(item, cloud?.domain) || undefined : undefined,
                    glyph: KIND_GLYPH[item.kind],
                  }}
                  title={item.name || item.originalName}
                  description={formatSize(item.size)}
                  tag={item.status === '0' ? <Tag size="sm" variant="default">禁用</Tag> : undefined}
                  showArrow={!selecting}
                  onClick={() =>
                    selecting ? toggle(item.id) : navigateTo(`/${SYSTEM_PAGES.attachmentDetail}?id=${item.id}`)
                  }
                />
              </View>
            </View>
          ))}
        </ManagementList>
      </ManagementStates>
      {selecting ? (
        <SelectionFooter
          count={selected.length}
          unit="个素材"
          items={list.list
            .filter((item) => selected.includes(item.id))
            .map((item) => ({ id: item.id, label: item.name || item.originalName, path: [] }))}
          confirmLabel="删除"
          confirmDanger
          onRemoveItem={toggle}
          onCancel={() => { setSelecting(false); setSelected([]) }}
          onConfirm={() => void (busy ? undefined : removeSelected())}
        />
      ) : (
        <ManagementListFooter
          loadingMore={list.loadingMore}
          refreshing={list.refreshing}
          finished={list.finished}
          empty={!list.list.length}
          summary={kind === 'ready' ? `共 ${list.total} 个素材` : undefined}
        />
      )}
    </ManagementPage>
  )
}

export default withAccountScope(AttachmentsPage)
```

注意：
- 多选模式的行内 inline style 是为了把 Checkbox 放在行首；如 biome/规范要求，改为 `index.module.scss` 的 `.selectRow { display:flex; align-items:center; padding-left: var(--space-4) }` 与 `.selectCell { flex:1; min-width:0 }`（推荐这样做，并在 Step 1 测试里不依赖 style）。
- `ManagementHeaderAction` 的 `aria-label` 等于 `label`，测试用 `byLabel('上传')`/`byLabel('管理')` 命中的是该元素的 `label` prop（驱动器的 `byLabel` 同时匹配 `aria-label` 与 `label`）。

- [ ] **Step 4: 运行确认通过**

Run（`apps/demo/app`）: `node --test tests/attachments-page.test.cjs`
Expected: 全部 PASS。若某个断言与实现细节冲突（例如 toast 文案），以 spec 为准修改实现，不要削弱断言。

- [ ] **Step 5: 类型检查 + lint**

Run（仓库根）: `pnpm typecheck:mobile`；（`apps/demo/app`）`npx biome lint src/pages/system/attachments/index.tsx`
Expected: 均无错误

- [ ] **Step 6: 提交**

```bash
git add apps/demo/app/src/pages/system/attachments/index.tsx apps/demo/app/src/pages/system/attachments/index.config.ts apps/demo/app/src/pages/system/attachments/index.module.scss apps/demo/app/tests/attachments-page.test.cjs
git commit -m "feat(app): rebuild attachments list with filters, upload sheet and multi-select delete

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 素材详情页

**Files:**
- Replace: `apps/demo/app/src/pages/system/attachments/detail/index.tsx`
- Create: `apps/demo/app/src/pages/system/attachments/detail/index.module.scss`
- Test: `apps/demo/app/tests/attachments-detail.test.cjs`

**Interfaces:**
- Consumes: `getAttachment`、`deleteAttachment`、`getCloudUploadConfig`、`attachmentUrl`；Task 1 `KIND_LABELS`、`formatSize`；`SYSTEM_PAGES.attachmentForm`
- 路由参数：`id`

- [ ] **Step 1: 写失败测试** `apps/demo/app/tests/attachments-detail.test.cjs`

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const IMAGE = { id: 9, name: 'banner.png', originalName: 'IMG.png', kind: 'image', size: 1258291, status: '1', storage: 'local', path: '/u/b.png', mimeType: 'image/png', width: 1920, height: 800, folderName: '首页素材', metadata: { alt: '首页' }, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' }
const ALL = ['system:attachment:list', 'system:attachment:update', 'system:attachment:delete', 'system:option:list']
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })

function mount({ item = IMAGE, permissions = ALL, confirm = true } = {}) {
  const calls = { deleted: [], copied: [], back: 0, navigate: [], preview: [] }
  const page = mountPage('src/pages/system/attachments/detail/index.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image', Video: 'Video' },
    '@tarojs/taro': {
      showToast() {},
      setClipboardData: async ({ data }) => calls.copied.push(data),
      previewImage: ({ current }) => calls.preview.push(current),
      createInnerAudioContext: () => ({ play() {}, stop() {}, destroy() {}, onError() {} }),
    },
    '@/api/admin/attachments': {
      getAttachment: async () => item,
      deleteAttachment: async (id) => calls.deleted.push(id),
      getCloudUploadConfig: async () => ({ provider: 'disabled' }),
      attachmentUrl: (x) => (x.path ? `https://api.test${x.path}` : ''),
    },
    '@/api/client': { getSessionVersion: () => 1 },
    '@/components/atoms': { Tag: 'Tag' },
    '@/components/feedback': { StateView: 'StateView' },
    '@/components/management': Object.fromEntries(['ActionSheet', 'BottomActionBar', 'DetailContent', 'DetailRow', 'DetailSection', 'LineIcon', 'ManagementPage'].map((k) => [k, k])),
    '@/components/molecules': { PageHeader: 'PageHeader' },
    '@/constants/routes': { SYSTEM_PAGES: { attachmentForm: 'E' } },
    '@/hooks': { useCanWrite: (...c) => c.every((x) => permissions.includes(x)), confirmAction: async () => confirm },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      useCurrentModuleAccess: () => (r = []) => r.every((x) => permissions.includes(x)),
    },
    '@/utils/format': { formatDateTime: (v) => `T(${v})` },
    '@/utils/router': { navigateBack: () => calls.back++, navigateTo: (u) => calls.navigate.push(u) },
    '../../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
    './index.module.scss': scss,
  }, { router: { id: '9' } })
  return { page, calls }
}
const rows = (page) => Object.fromEntries(page.all('DetailRow').map((r) => [r.props.label, r.props]))

test('图片详情：预览可点开大图，分组信息完整，只读行不带箭头', async () => {
  const { page, calls } = mount()
  await page.settle()
  const image = page.one('Image')
  assert.equal(image.props.src, 'https://api.test/u/b.png')
  image.props.onClick()
  assert.deepEqual(calls.preview, ['https://api.test/u/b.png'])
  const r = rows(page)
  assert.equal(r['分组'].value, '首页素材')
  assert.equal(r['类型'].value, '图片')
  assert.equal(r['大小'].value, '1.2 MB')
  assert.equal(r['尺寸'].value, '1920 × 800')
  assert.equal(r['分组'].showArrow, undefined)
  assert.ok(page.all('DetailSection').some((s) => s.props.title === '扩展信息'))
})

test('点击文件链接行复制链接', async () => {
  const { page, calls } = mount()
  await page.settle()
  rows(page)['文件链接'].onClick()
  await page.settle()
  assert.deepEqual(calls.copied, ['https://api.test/u/b.png'])
})

test('无链接显示暂无可预览链接，且无复制链接操作', async () => {
  const { page } = mount({ item: { ...IMAGE, path: undefined, metadata: null } })
  await page.settle()
  assert.match(page.text(), /暂无可预览链接/)
  assert.equal(page.one('BottomActionBar').props.actions.some((a) => a.key === 'copy'), false)
  assert.equal(page.all('DetailSection').some((s) => s.props.title === '扩展信息'), false)
})

test('权限决定底部操作；编辑跳转编辑页', async () => {
  const ro = mount({ permissions: ['system:attachment:list'] })
  await ro.page.settle()
  assert.deepEqual(ro.page.one('BottomActionBar').props.actions.map((a) => a.key), ['copy'])
  const rw = mount()
  await rw.page.settle()
  const actions = rw.page.one('BottomActionBar').props.actions
  assert.deepEqual(actions.map((a) => a.key), ['edit', 'copy', 'more'])
  actions[0].onClick()
  assert.deepEqual(rw.calls.navigate, ['/E?id=9'])
})

test('删除：取消确认不发请求；确认后删除并返回', async () => {
  const no = mount({ confirm: false })
  await no.page.settle()
  no.page.one('BottomActionBar').props.actions.find((a) => a.key === 'more').onClick()
  no.page.rerender()
  no.page.one('ActionSheet').props.items.find((i) => i.key === 'delete').onClick()
  await no.page.settle()
  assert.deepEqual(no.calls.deleted, [])
  const yes = mount()
  await yes.page.settle()
  yes.page.one('BottomActionBar').props.actions.find((a) => a.key === 'more').onClick()
  yes.page.rerender()
  yes.page.one('ActionSheet').props.items.find((i) => i.key === 'delete').onClick()
  await yes.page.settle()
  assert.deepEqual(yes.calls.deleted, [9])
  assert.equal(yes.calls.back, 1)
})
```

- [ ] **Step 2: 运行确认失败**

Run（`apps/demo/app`）: `node --test tests/attachments-detail.test.cjs`
Expected: FAIL（占位页）

- [ ] **Step 3: 实现** `detail/index.tsx`

```tsx
import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'
import { Image, Text, Video, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import {
  type Attachment,
  attachmentUrl,
  deleteAttachment,
  getAttachment,
  getCloudUploadConfig,
} from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  type BottomAction,
  BottomActionBar,
  DetailContent,
  DetailRow,
  DetailSection,
  LineIcon,
  ManagementPage,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { SYSTEM_PAGES } from '@/constants/routes'
import { confirmAction, useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { formatDateTime } from '@/utils/format'
import { navigateBack, navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { formatSize, KIND_GLYPH, KIND_LABELS } from '../model'
import styles from './index.module.scss'

const DELETE = 'system:attachment:delete'

function AttachmentDetailPage() {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const isCurrent = useCurrentModuleAccess('system-attachments')
  const id = Number(useRouter().params.id)
  const canUpdate = useCanWrite('system:attachment:update')
  const canDelete = useCanWrite(DELETE)
  const canReadOptions = useCanWrite('system:option:list')
  const [item, setItem] = useState<Attachment | null>(null)
  const [domain, setDomain] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const sequence = useRef(0)
  const refreshOnShow = useRef(false)
  const audio = useRef<ReturnType<typeof Taro.createInnerAudioContext> | null>(null)

  async function load() {
    if (!guard.ready || !guard.allowed) return
    const current = ++sequence.current
    const session = getSessionVersion()
    const active = () => current === sequence.current && session === getSessionVersion()
    setLoading(true)
    setError('')
    try {
      if (!Number.isInteger(id) || id <= 0) throw new Error('素材 ID 缺失或无效')
      const data = await getAttachment(id)
      if (active()) setItem(data)
    } catch (cause) {
      if (active()) setError(errorMessage(cause))
    } finally {
      if (active()) setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    return () => {
      sequence.current++
      audio.current?.destroy()
    }
  }, [id, guard.ready, guard.allowed])
  useEffect(() => {
    if (!guard.allowed || !canReadOptions) return
    // 七牛素材需要域名拼链接；拿不到时链接退化为空，页面照常显示
    getCloudUploadConfig()
      .then((config) => setDomain(config.domain))
      .catch(() => setDomain(undefined))
  }, [guard.allowed, canReadOptions])
  useDidHide(() => {
    refreshOnShow.current = true
    setMore(false)
    audio.current?.stop()
  })
  useDidShow(() => {
    if (refreshOnShow.current) {
      refreshOnShow.current = false
      void load()
    }
  })

  async function remove() {
    if (!item || locked.current || !isCurrent([DELETE])) return
    const session = getSessionVersion()
    const current = () => session === getSessionVersion() && isCurrent([DELETE])
    setMore(false)
    locked.current = true
    setBusy(true)
    try {
      const ok = await confirmAction({ title: '删除素材', content: `确认删除「${item.name || item.originalName}」？` })
      if (!ok || !current()) return
      await deleteAttachment(item.id)
      if (!current()) return
      void Taro.showToast({ title: '已删除', icon: 'success' })
      navigateBack(1)
    } catch (cause) {
      if (current()) void Taro.showToast({ title: errorMessage(cause), icon: 'none' })
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const url = item ? attachmentUrl(item, domain) : ''
  const copy = () => {
    if (!url) return
    void Taro.setClipboardData({ data: url }).then(() => Taro.showToast({ title: '已复制', icon: 'success' }))
  }
  const playAudio = () => {
    if (!url) return
    audio.current?.destroy()
    const player = Taro.createInnerAudioContext()
    audio.current = player
    player.src = url
    player.onError(() => void Taro.showToast({ title: '音频无法播放', icon: 'none' }))
    player.play()
  }
  const actions: BottomAction[] = [
    ...(canUpdate
      ? [{ key: 'edit', label: '编辑', icon: 'pencil' as const, tone: 'primary' as const, onClick: () => navigateTo(`/${SYSTEM_PAGES.attachmentForm}?id=${id}`) }]
      : []),
    ...(url ? [{ key: 'copy', label: '复制链接', icon: 'file' as const, tone: 'muted' as const, onClick: copy }] : []),
    ...(canDelete
      ? [{ key: 'more', label: '更多', icon: 'moreVertical' as const, tone: 'muted' as const, onClick: () => setMore(true) }]
      : []),
  ]
  const metadata = item?.metadata == null || (typeof item.metadata === 'object' && !Object.keys(item.metadata as object).length)
    ? ''
    : JSON.stringify(item.metadata, null, 2)

  return (
    <ManagementPage withActions={actions.length > 0}>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="素材详情" /> : null}
      <DetailContent>
        <StateView kind={error ? 'error' : loading && !item ? 'loading' : !item ? 'empty' : 'ready'} text={error || undefined} onRetry={load} minHeight={300}>
          {item ? (
            <>
              <View className={styles.preview}>
                {!url ? (
                  <View className={styles.placeholder}>
                    <LineIcon name={KIND_GLYPH[item.kind]} size={32} color="#86909C" />
                    <Text className={styles.placeholderText}>暂无可预览链接</Text>
                  </View>
                ) : item.kind === 'image' ? (
                  <Image className={styles.media} src={url} mode="widthFix" onClick={() => Taro.previewImage({ current: url, urls: [url] })} />
                ) : item.kind === 'video' ? (
                  <Video className={styles.media} src={url} controls />
                ) : item.kind === 'audio' ? (
                  <View className={styles.audio}>
                    <View className={styles.audioButton} aria-label="播放" onClick={playAudio}><Text>播放</Text></View>
                    <View className={styles.audioButton} aria-label="停止" onClick={() => audio.current?.stop()}><Text>停止</Text></View>
                  </View>
                ) : (
                  <View className={styles.placeholder}>
                    <LineIcon name="file" size={32} color="#1677FF" />
                  </View>
                )}
                <Text className={styles.name}>{item.name || item.originalName}</Text>
                <Text className={styles.note}>{`${KIND_LABELS[item.kind]}，${formatSize(item.size)}`}</Text>
              </View>

              <DetailSection title="基本信息">
                <DetailRow label="名称" value={item.name || item.originalName} />
                <DetailRow label="分组" value={item.folderName || '未分组'} />
                <DetailRow label="类型" value={KIND_LABELS[item.kind]} />
                <DetailRow label="状态" value={item.status === '1' ? '启用' : '禁用'} />
                <DetailRow label="大小" value={formatSize(item.size)} />
                {item.width && item.height ? <DetailRow label="尺寸" value={`${item.width} × ${item.height}`} /> : null}
                {item.duration ? <DetailRow label="时长" value={`${item.duration} 秒`} /> : null}
              </DetailSection>

              <DetailSection title="文件信息">
                <DetailRow label="原始文件" value={item.originalName} />
                <DetailRow label="MIME" value={item.mimeType} />
                <DetailRow label="存储" value={item.storage === 'qiniu' ? '七牛云' : item.storage === 'local' ? '本地存储' : item.storage} />
                {url ? <DetailRow label="文件链接" value="点击复制" onClick={copy} /> : null}
              </DetailSection>

              {metadata ? (
                <DetailSection title="扩展信息">
                  <DetailRow label="内容" value={metadata} multiline />
                </DetailSection>
              ) : null}

              <DetailSection title="账号记录" collapsible defaultCollapsed>
                <DetailRow label="创建时间" value={formatDateTime(item.createdAt)} />
                <DetailRow label="更新时间" value={formatDateTime(item.updatedAt)} />
              </DetailSection>
            </>
          ) : null}
        </StateView>
      </DetailContent>
      <BottomActionBar actions={actions} disabled={busy || loading} />
      <ActionSheet
        open={more}
        items={[{ key: 'delete', label: '删除素材', icon: 'trash', danger: true, onClick: () => void remove() }]}
        onClose={() => setMore(false)}
      />
    </ManagementPage>
  )
}

export default withAccountScope(AttachmentDetailPage)
```

`detail/index.module.scss`（hero 例外：白色整宽块，上下 16px，无圆角无左右外边距）：

```scss
.preview {
  margin: var(--space-4) 0;
  padding: var(--space-4);
  background: var(--color-bg-surface);
}
.media { display: block; width: 100%; border-radius: var(--radius-lg); }
.placeholder {
  height: 160px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2);
  border-radius: var(--radius-lg);
  background: var(--color-bg-base);
}
.placeholderText { font-size: var(--font-size-13); color: var(--color-text-tertiary); }
.audio { display: flex; gap: var(--space-3); }
.audioButton {
  flex: 1; height: 40px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-md); background: var(--color-primary-bg); color: var(--color-primary);
}
.name { display: block; margin-top: var(--space-3); font-size: var(--font-size-17, 17px); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.note { display: block; margin-top: 4px; font-size: var(--font-size-13); color: var(--color-text-tertiary); }
```

- [ ] **Step 4: 运行确认通过**

Run（`apps/demo/app`）: `node --test tests/attachments-detail.test.cjs`
Expected: 5 个用例 PASS

- [ ] **Step 5: 类型检查 + lint + 提交**

Run（仓库根）: `pnpm typecheck:mobile`；（`apps/demo/app`）`npx biome lint src/pages/system/attachments/detail`

```bash
git add apps/demo/app/src/pages/system/attachments/detail apps/demo/app/tests/attachments-detail.test.cjs
git commit -m "feat(app): add attachment detail page with preview and grouped info

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 素材编辑页

**Files:**
- Replace: `apps/demo/app/src/pages/system/attachments/form/index.tsx`
- Create: `apps/demo/app/src/pages/system/attachments/form/index.module.scss`（仅 `.value` 右对齐文本，参照 `pages/system/role/form/index.module.scss` 的 `.pickerValue`）
- Test: `apps/demo/app/tests/attachments-form.test.cjs`

**Interfaces:**
- Consumes: `getAttachment`、`getFolderTree`、`updateAttachment`；Task 1 `attachmentEditPayload`、`folderLabel`、`STATUS_ENUM`；Task 2 `FolderTreeSheet`
- 路由参数：`id`

- [ ] **Step 1: 写失败测试** `apps/demo/app/tests/attachments-form.test.cjs`

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const ITEM = { id: 9, name: 'banner.png', originalName: 'IMG.png', kind: 'image', folderId: 7, status: '1', metadata: { alt: 'x' } }
const FOLDERS = [{ id: 7, name: '首页素材', status: '1', children: [] }]
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })

function mount({ permissions = ['system:attachment:update'], update } = {}) {
  const calls = { updates: [], back: 0 }
  let version = 1
  const page = mountPage('src/pages/system/attachments/form/index.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text' },
    '@tarojs/taro': { showToast() {}, setNavigationBarTitle() {} },
    '@/api/admin/attachments': {
      getAttachment: async () => ITEM,
      getFolderTree: async () => FOLDERS,
      updateAttachment: update || (async (id, data) => { calls.updates.push({ id, data }); return ITEM }),
    },
    '@/api/client': { getSessionVersion: () => version },
    '@/components/feedback': { StateView: 'StateView' },
    '@/components/management': Object.fromEntries(['EnumField', 'FormContent', 'FormError', 'FormField', 'FormSection', 'FormSubmitBar', 'ManagementPage', 'TextField'].map((k) => [k, k])),
    '@/components/molecules': { PageHeader: 'PageHeader' },
    '@/hooks': { useCanWrite: (...c) => c.every((x) => permissions.includes(x)) },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      canWriteModuleNow: (_, r) => r.every((x) => permissions.includes(x)),
    },
    '@/utils/router': { navigateBack: () => calls.back++ },
    '../../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
    '../FolderTreeSheet': { FolderTreeSheet: 'FolderTreeSheet' },
    './index.module.scss': scss,
  }, { router: { id: '9' } })
  return { page, calls, bump: () => version++ }
}

test('加载后回填；保存只提交 name/folderId/status，不含 metadata', async () => {
  const { page, calls } = mount()
  await page.settle()
  assert.equal(page.one('TextField').props.value, 'banner.png')
  page.one('TextField').props.onChange(' 新名称 ')
  page.one('FolderTreeSheet').props.onSelect(0)
  page.one('EnumField').props.onChange('0')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(calls.updates.length, 1)
  assert.deepEqual(Object.keys(calls.updates[0].data).sort(), ['folderId', 'name', 'status'])
  assert.deepEqual(calls.updates[0].data, { name: '新名称', folderId: null, status: '0' })
  assert.equal(calls.back, 1)
})

test('分组行显示当前分组名并可打开选择面板', async () => {
  const { page } = mount()
  await page.settle()
  const row = page.all('FormField').find((f) => f.props.label === '分组')
  assert.equal(row.props.arrow, true)
  assert.match(JSON.stringify(row.props.children), /首页素材/)
  row.props.onArrowClick()
  page.rerender()
  assert.equal(page.one('FolderTreeSheet').props.open, true)
  assert.equal(page.one('FolderTreeSheet').props.rootLabel, '未分组')
})

test('名称为空就地报错不提交', async () => {
  const { page, calls } = mount()
  await page.settle()
  page.one('TextField').props.onChange('  ')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(calls.updates.length, 0)
  assert.match(page.text(), /请输入素材名称/)
})

test('保存失败保留输入且不返回', async () => {
  const { page, calls } = mount({ update: async () => { throw new Error('名称重复') } })
  await page.settle()
  page.one('TextField').props.onChange('x')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(page.one('TextField').props.value, 'x')
  assert.match(page.text(), /名称重复/)
  assert.equal(calls.back, 0)
})

test('无 update 权限不显示提交栏', async () => {
  const { page } = mount({ permissions: [] })
  await page.settle()
  assert.equal(page.one('FormSubmitBar'), undefined)
})

test('保存期间会话切换：不返回', async () => {
  let resolve
  const ctx = mount({ update: () => new Promise((r) => { resolve = r }) })
  await ctx.page.settle()
  ctx.page.one('FormSubmitBar').props.onSubmit()
  ctx.bump()
  resolve({})
  await ctx.page.settle()
  assert.equal(ctx.calls.back, 0)
})
```

- [ ] **Step 2: 运行确认失败**

Run（`apps/demo/app`）: `node --test tests/attachments-form.test.cjs`
Expected: FAIL

- [ ] **Step 3: 实现** `form/index.tsx`（结构参照 `pages/system/position/form/index.tsx`）

```tsx
import Taro, { useRouter } from '@tarojs/taro'
import { Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import { type AttachmentFolder, getAttachment, getFolderTree, updateAttachment } from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  EnumField,
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { FolderTreeSheet } from '../FolderTreeSheet'
import { attachmentEditPayload, folderLabel, STATUS_ENUM } from '../model'
import styles from './index.module.scss'

const UPDATE = 'system:attachment:update'

function AttachmentFormPage() {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const id = Number(useRouter().params.id)
  const canSave = useCanWrite(UPDATE)
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState(0)
  const [status, setStatus] = useState<'0' | '1'>('1')
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [picking, setPicking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') void Taro.setNavigationBarTitle({ title: '编辑素材' })
  }, [])
  useEffect(() => {
    mounted.current = true
    let current = true
    if (guard.ready && guard.allowed) {
      setLoading(true)
      setError('')
      void (async () => {
        try {
          if (!Number.isInteger(id) || id <= 0) throw new Error('素材 ID 缺失或无效')
          const [item, tree] = await Promise.all([getAttachment(id), getFolderTree().catch(() => [])])
          if (!current || !active()) return
          setName(item.name || item.originalName)
          setFolderId(item.folderId || 0)
          setStatus(item.status)
          setFolders(tree)
        } catch (cause) {
          if (current && active()) setError(errorMessage(cause))
        } finally {
          if (current && active()) setLoading(false)
        }
      })()
    }
    return () => {
      current = false
      mounted.current = false
    }
  }, [id, retry, guard.ready, guard.allowed, session])

  const disabled = !canSave || busy || loading
  async function save() {
    if (disabled || locked.current || !active() || !canWriteModuleNow('system-attachments', [UPDATE])) return
    let payload: ReturnType<typeof attachmentEditPayload>
    try {
      payload = attachmentEditPayload(name, folderId, status)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      await updateAttachment(id, payload)
      if (active() && canWriteModuleNow('system-attachments', [UPDATE])) {
        void Taro.showToast({ title: '保存成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (active()) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="编辑素材" /> : null}
      <StateView kind={error ? 'error' : loading ? 'loading' : 'ready'} text={error || undefined} onRetry={() => setRetry((value) => value + 1)}>
        <FormContent>
          <FormSection title="基础信息">
            <FormField label="名称" required>
              <TextField value={name} onChange={setName} placeholder="请输入素材名称" maxlength={255} disabled={disabled} />
            </FormField>
            <FormField label="分组" arrow onArrowClick={() => !disabled && setPicking(true)}>
              <Text className={styles.value} onClick={() => !disabled && setPicking(true)}>
                {folderLabel(folders, folderId, '未分组')}
              </Text>
            </FormField>
            <EnumField label="状态" value={status} options={STATUS_ENUM} onChange={setStatus} disabled={disabled} />
          </FormSection>
          <FormError>{submitError}</FormError>
        </FormContent>
        {canSave ? <FormSubmitBar text="保存" submitting={busy} onSubmit={() => void save()} /> : null}
      </StateView>
      <FolderTreeSheet
        open={picking}
        title="选择分组"
        folders={folders}
        value={folderId}
        rootLabel="未分组"
        onSelect={setFolderId}
        onClose={() => setPicking(false)}
      />
    </ManagementPage>
  )
}

export default withAccountScope(AttachmentFormPage)
```

`form/index.module.scss`：

```scss
.value {
  flex: 1;
  text-align: right;
  color: var(--color-text-primary);
}
```

- [ ] **Step 4: 运行确认通过**

Run（`apps/demo/app`）: `node --test tests/attachments-form.test.cjs`
Expected: 6 个用例 PASS

- [ ] **Step 5: 类型检查 + lint + 提交**

```bash
git add apps/demo/app/src/pages/system/attachments/form apps/demo/app/tests/attachments-form.test.cjs
git commit -m "feat(app): add attachment edit page that submits only name, folder and status

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 链接导入页

**Files:**
- Replace: `apps/demo/app/src/pages/system/attachments/import/index.tsx`
- Test: `apps/demo/app/tests/attachments-import.test.cjs`

**Interfaces:**
- Consumes: `importImages(urls, folderId?)`；Task 1 `parseImportLinks`
- 路由参数：`folderId`（可选）

- [ ] **Step 1: 写失败测试** `apps/demo/app/tests/attachments-import.test.cjs`

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

function mount({ router = { folderId: '7' }, importImages } = {}) {
  const calls = { imports: [], back: 0 }
  const page = mountPage('src/pages/system/attachments/import/index.tsx', {
    '@tarojs/components': { Text: 'Text' },
    '@tarojs/taro': { showToast() {}, setNavigationBarTitle() {} },
    '@/api/admin/attachments': { importImages: importImages || (async (urls, folderId) => { calls.imports.push({ urls, folderId }); return [] }) },
    '@/api/client': { getSessionVersion: () => 1 },
    '@/components/management': Object.fromEntries(['FormContent', 'FormError', 'FormField', 'FormSection', 'FormSubmitBar', 'ManagementPage', 'TextAreaField'].map((k) => [k, k])),
    '@/components/molecules': { PageHeader: 'PageHeader' },
    '@/hooks': { useCanWrite: () => true },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }), canWriteModuleNow: () => true },
    '@/utils/router': { navigateBack: () => calls.back++ },
    '../../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
  }, { router })
  return { page, calls }
}

test('导入到路由携带的分组并返回', async () => {
  const { page, calls } = mount()
  page.one('TextAreaField').props.onChange('https://a.test/1.png\nhttps://a.test/2.png')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.deepEqual(calls.imports, [{ urls: ['https://a.test/1.png', 'https://a.test/2.png'], folderId: 7 }])
  assert.equal(calls.back, 1)
})

test('未指定分组时不传 folderId', async () => {
  const { page, calls } = mount({ router: {} })
  page.one('TextAreaField').props.onChange('https://a.test/1.png')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(calls.imports[0].folderId, undefined)
})

test('非法链接就地报错，不发请求；占位文案不重复写提示', async () => {
  const { page, calls } = mount()
  assert.equal(page.one('TextAreaField').props.placeholder, '每行一个 HTTP/HTTPS 图片链接，最多 20 个')
  page.one('TextAreaField').props.onChange('ftp://x/1.png')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.deepEqual(calls.imports, [])
  assert.match(page.text(), /HTTP/)
})

test('导入失败保留输入且不返回', async () => {
  const { page, calls } = mount({ importImages: async () => { throw new Error('链接无法访问') } })
  page.one('TextAreaField').props.onChange('https://a.test/1.png')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(page.one('TextAreaField').props.value, 'https://a.test/1.png')
  assert.match(page.text(), /链接无法访问/)
  assert.equal(calls.back, 0)
})
```

- [ ] **Step 2: 运行确认失败** — `node --test tests/attachments-import.test.cjs` → FAIL

- [ ] **Step 3: 实现** `import/index.tsx`

```tsx
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { importImages } from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import {
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  TextAreaField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { parseImportLinks } from '../model'

const CREATE = 'system:attachment:create'

function AttachmentImportPage() {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const folderId = Number(useRouter().params.folderId) || undefined
  const canSave = useCanWrite(CREATE)
  const [links, setLinks] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()
  useEffect(() => {
    mounted.current = true
    if (process.env.TARO_ENV !== 'h5') void Taro.setNavigationBarTitle({ title: '链接导入' })
    return () => {
      mounted.current = false
    }
  }, [])

  async function submit() {
    if (!canSave || locked.current || !active() || !canWriteModuleNow('system-attachments', [CREATE])) return
    let urls: string[]
    try {
      urls = parseImportLinks(links)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      await importImages(urls, folderId)
      if (active() && canWriteModuleNow('system-attachments', [CREATE])) {
        void Taro.showToast({ title: '导入成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (active()) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="链接导入" /> : null}
      <FormContent>
        <FormSection title="图片链接">
          <FormField label="图片链接" stacked>
            <TextAreaField
              value={links}
              onChange={setLinks}
              placeholder="每行一个 HTTP/HTTPS 图片链接，最多 20 个"
              maxlength={-1}
              disabled={!canSave || busy}
            />
          </FormField>
        </FormSection>
        <FormError>{submitError}</FormError>
      </FormContent>
      {canSave ? <FormSubmitBar text="导入" submitting={busy} onSubmit={() => void submit()} /> : null}
    </ManagementPage>
  )
}

export default withAccountScope(AttachmentImportPage)
```

- [ ] **Step 4: 运行确认通过** — `node --test tests/attachments-import.test.cjs` → 4 PASS

- [ ] **Step 5: 类型检查 + lint + 提交**

```bash
git add apps/demo/app/src/pages/system/attachments/import apps/demo/app/tests/attachments-import.test.cjs
git commit -m "feat(app): add attachment link import page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: 分组管理页 + 分组表单页

**Files:**
- Replace: `apps/demo/app/src/pages/system/attachments/folders/index.tsx`
- Replace: `apps/demo/app/src/pages/system/attachments/folder-form/index.tsx`
- Create: `apps/demo/app/src/pages/system/attachments/folder-form/index.module.scss`（同 Task 7 的 `.value`）
- Test: `apps/demo/app/tests/attachments-folders.test.cjs`

**Interfaces:**
- Consumes: `getFolderTree`、`getFolder`、`createFolder`、`updateFolder`、`deleteFolder`；Task 1 `folderPayload`、`subtreeIds`、`folderLabel`、`FOLDER_KIND_OPTIONS`、`KIND_LABELS`、`STATUS_ENUM`；Task 2 `FolderTreeSheet`；`ManagementTreeCell`（现有，props：`title, description, tag, glyph, depth, hasChildren, expanded, onToggle, bordered, onClick`）
- 路由：分组表单 `?id=`（编辑）或 `?parentId=`（新建默认上级）

- [ ] **Step 1: 写失败测试** `apps/demo/app/tests/attachments-folders.test.cjs`

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const TREE = [
  { id: 1, name: '营销素材', kind: 'all', status: '1', sort_order: 0, children: [
    { id: 2, name: '首页素材', kind: 'image', status: '1', sort_order: 0, children: [] },
  ] },
  { id: 5, name: '短视频', kind: 'video', status: '0', sort_order: 1 },
]
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })
const common = (permissions) => ({
  '@tarojs/components': { View: 'View', Text: 'Text' },
  '@/api/client': { getSessionVersion: () => 1 },
  '@/components/atoms': { Tag: 'Tag' },
  '@/components/feedback': { StateView: 'StateView' },
  '@/components/molecules': { PageHeader: 'PageHeader' },
  '@/constants/routes': { SYSTEM_PAGES: { attachmentFolderForm: 'FF' } },
  '@/hooks': { useCanWrite: (...c) => c.every((x) => permissions.includes(x)), confirmAction: async () => true },
  '@/utils/auth-guard': {
    useRequireAuth: () => ({ ready: true, allowed: true }),
    canWriteModuleNow: (_, r) => r.every((x) => permissions.includes(x)),
    useCurrentModuleAccess: () => (r = []) => r.every((x) => permissions.includes(x)),
  },
  '../../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
})

function mountList(permissions = ['system:attachment:create']) {
  const nav = []
  const page = mountPage('src/pages/system/attachments/folders/index.tsx', {
    ...common(permissions),
    '@tarojs/taro': {},
    '@/api/admin/attachments': { getFolderTree: async () => TREE },
    '@/components/management': Object.fromEntries(['ManagementHeaderAction', 'ManagementList', 'ManagementPage', 'ManagementPageHeader', 'ManagementStates', 'ManagementTreeCell'].map((k) => [k, k])),
    '@/utils/router': { navigateTo: (u) => nav.push(u) },
  })
  return { page, nav }
}

test('分组列表：默认只显示顶层，展开后显示子分组；点行进编辑；类型限制作描述、禁用作标签', async () => {
  const { page, nav } = mountList()
  await page.settle()
  let cells = page.all('ManagementTreeCell')
  assert.deepEqual(cells.map((c) => c.props.title), ['营销素材', '短视频'])
  assert.equal(cells[0].props.hasChildren, true)
  assert.equal(cells[0].props.description, undefined)
  assert.equal(cells[1].props.description, '仅视频')
  assert.ok(cells[1].props.tag)
  cells[0].props.onToggle()
  cells = page.all('ManagementTreeCell')
  assert.deepEqual(cells.map((c) => c.props.title), ['营销素材', '首页素材', '短视频'])
  assert.equal(cells[1].props.depth, 1)
  cells[1].props.onClick()
  assert.deepEqual(nav, ['/FF?id=2'])
})

test('新建入口受 create 权限控制', async () => {
  const yes = mountList()
  await yes.page.settle()
  yes.page.byLabel('新建').props.onClick()
  assert.deepEqual(yes.nav, ['/FF'])
  const no = mountList([])
  await no.page.settle()
  assert.equal(no.page.byLabel('新建'), undefined)
})

function mountForm({ router = {}, permissions = ['system:attachment:create', 'system:attachment:update', 'system:attachment:delete'] } = {}) {
  const calls = { creates: [], updates: [], deletes: [], back: 0 }
  const page = mountPage('src/pages/system/attachments/folder-form/index.tsx', {
    ...common(permissions),
    '@tarojs/taro': { showToast() {}, setNavigationBarTitle() {} },
    '@/api/admin/attachments': {
      getFolderTree: async () => TREE,
      getFolder: async () => ({ ...TREE[0], remark: '旧备注' }),
      createFolder: async (d) => calls.creates.push(d),
      updateFolder: async (id, d) => calls.updates.push({ id, d }),
      deleteFolder: async (id) => calls.deletes.push(id),
    },
    '@/components/management': Object.fromEntries(['ActionSheet', 'EnumField', 'FormContent', 'FormError', 'FormField', 'FormSection', 'FormSubmitBar', 'ManagementHeaderAction', 'ManagementPage', 'TextAreaField', 'TextField'].map((k) => [k, k])),
    '@/utils/router': { navigateBack: () => calls.back++ },
    '../FolderTreeSheet': { FolderTreeSheet: 'FolderTreeSheet' },
    './index.module.scss': scss,
  }, { router })
  return { page, calls }
}

test('新建分组：默认上级来自路由，提交完整 FolderInput', async () => {
  const { page, calls } = mountForm({ router: { parentId: '1' } })
  await page.settle()
  page.all('TextField')[0].props.onChange('活动')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.deepEqual(calls.creates, [{ name: '活动', parentId: 1, kind: 'all', status: '1', sort_order: 0, remark: '' }])
  assert.equal(calls.back, 1)
})

test('编辑分组：回填全部字段，上级选择排除自身及后代', async () => {
  const { page, calls } = mountForm({ router: { id: '1' } })
  await page.settle()
  assert.equal(page.all('TextField')[0].props.value, '营销素材')
  assert.equal(page.one('TextAreaField').props.value, '旧备注')
  assert.deepEqual([...page.one('FolderTreeSheet').props.excludeIds].sort(), [1, 2])
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.deepEqual(calls.updates, [{ id: 1, d: { name: '营销素材', parentId: 0, kind: 'all', status: '1', sort_order: 0, remark: '旧备注' } }])
})

test('编辑态更多→删除，确认文案含限制说明', async () => {
  const { page, calls } = mountForm({ router: { id: '1' } })
  await page.settle()
  page.byLabel('更多').props.onClick()
  page.rerender()
  page.one('ActionSheet').props.items.find((i) => i.key === 'delete').onClick()
  await page.settle()
  assert.deepEqual(calls.deletes, [1])
  assert.equal(calls.back, 1)
})
```

- [ ] **Step 2: 运行确认失败** — `node --test tests/attachments-folders.test.cjs` → FAIL

- [ ] **Step 3: 实现分组管理** `folders/index.tsx`

```tsx
import { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { type AttachmentFolder, getFolderTree } from '@/api/admin/attachments'
import { Tag } from '@/components/atoms'
import {
  ManagementHeaderAction,
  ManagementList,
  ManagementPage,
  ManagementPageHeader,
  ManagementStates,
  ManagementTreeCell,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { KIND_LABELS } from '../model'

function FoldersPage() {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const canCreate = useCanWrite('system:attachment:create')
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!guard.ready || !guard.allowed) return
    setLoading(true)
    setError('')
    try {
      setFolders(await getFolderTree())
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [guard.ready, guard.allowed])
  useDidShow(() => {
    void load()
  })

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const rows: { folder: AttachmentFolder; depth: number }[] = []
  const walk = (nodes: AttachmentFolder[], depth: number) => {
    for (const folder of nodes) {
      rows.push({ folder, depth })
      if (expanded.has(folder.id)) walk(folder.children || [], depth + 1)
    }
  }
  walk(folders, 0)
  const toggle = (id: number) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <ManagementPage>
      <ManagementPageHeader
        title="分组管理"
        action={canCreate ? <ManagementHeaderAction label="新建" onClick={() => navigateTo(`/${SYSTEM_PAGES.attachmentFolderForm}`)} /> : undefined}
      />
      <ManagementStates
        kind={error ? 'error' : loading && !folders.length ? 'loading' : !folders.length ? 'empty' : 'ready'}
        errorText={error || undefined}
        emptyText="暂无分组"
        onRetry={load}
      >
        <ManagementList>
          {rows.map(({ folder, depth }, index) => (
            <ManagementTreeCell
              key={folder.id}
              glyph="folder"
              title={folder.name}
              description={folder.kind === 'all' ? undefined : `仅${KIND_LABELS[folder.kind]}`}
              tag={folder.status === '0' ? <Tag size="sm" variant="default">禁用</Tag> : undefined}
              depth={depth}
              hasChildren={Boolean(folder.children?.length)}
              expanded={expanded.has(folder.id)}
              onToggle={() => toggle(folder.id)}
              bordered={index < rows.length - 1}
              onClick={() => navigateTo(`/${SYSTEM_PAGES.attachmentFolderForm}?id=${folder.id}`)}
            />
          ))}
        </ManagementList>
      </ManagementStates>
    </ManagementPage>
  )
}

export default withAccountScope(FoldersPage)
```

- [ ] **Step 4: 实现分组表单** `folder-form/index.tsx`

```tsx
import Taro, { useRouter } from '@tarojs/taro'
import { Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import {
  type AttachmentFolder,
  createFolder,
  deleteFolder,
  getFolder,
  getFolderTree,
  updateFolder,
} from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  EnumField,
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementHeaderAction,
  ManagementPage,
  TextAreaField,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { confirmAction, useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { FolderTreeSheet } from '../FolderTreeSheet'
import { FOLDER_KIND_OPTIONS, type FolderFormValues, folderLabel, folderPayload, STATUS_ENUM, subtreeIds } from '../model'
import styles from './index.module.scss'

const DELETE = 'system:attachment:delete'

function FolderFormPage() {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const params = useRouter().params
  const id = params.id ? Number(params.id) : undefined
  const required = id ? 'system:attachment:update' : 'system:attachment:create'
  const canSave = useCanWrite(required)
  const canDelete = useCanWrite(DELETE)
  const [values, setValues] = useState<FolderFormValues>({
    name: '',
    parentId: Number(params.parentId) || 0,
    kind: 'all',
    status: '1',
    sort: '0',
    remark: '',
  })
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [picking, setPicking] = useState(false)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()
  const title = id ? '编辑分组' : '新建分组'

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') void Taro.setNavigationBarTitle({ title })
  }, [title])
  useEffect(() => {
    mounted.current = true
    let current = true
    if (guard.ready && guard.allowed) {
      setLoading(Boolean(id))
      setError('')
      void (async () => {
        try {
          const [tree, folder] = await Promise.all([
            getFolderTree().catch(() => []),
            id ? getFolder(id) : Promise.resolve(null),
          ])
          if (!current || !active()) return
          setFolders(tree)
          if (folder)
            setValues({
              name: folder.name,
              parentId: folder.parentId || 0,
              kind: folder.kind,
              status: folder.status,
              sort: String(folder.sort_order),
              remark: folder.remark || '',
            })
        } catch (cause) {
          if (current && active()) setError(errorMessage(cause))
        } finally {
          if (current && active()) setLoading(false)
        }
      })()
    }
    return () => {
      current = false
      mounted.current = false
    }
  }, [id, retry, guard.ready, guard.allowed, session])

  const patch = (next: Partial<FolderFormValues>) => setValues((previous) => ({ ...previous, ...next }))
  const disabled = !canSave || busy || loading

  async function save() {
    if (disabled || locked.current || !active() || !canWriteModuleNow('system-attachments', [required])) return
    let payload: ReturnType<typeof folderPayload>
    try {
      payload = folderPayload(values)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      if (id) await updateFolder(id, payload)
      else await createFolder(payload)
      if (active() && canWriteModuleNow('system-attachments', [required])) {
        void Taro.showToast({ title: '保存成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (active()) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  async function remove() {
    setMore(false)
    if (!id || locked.current || !active() || !canWriteModuleNow('system-attachments', [DELETE])) return
    locked.current = true
    setBusy(true)
    try {
      const ok = await confirmAction({ title: '删除分组', content: `确认删除「${values.name}」？包含子分组或素材的分组不能删除。` })
      if (!ok || !active()) return
      await deleteFolder(id)
      if (!active()) return
      void Taro.showToast({ title: '已删除', icon: 'success' })
      navigateBack(1)
    } catch (cause) {
      if (active()) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? (
        <PageHeader
          title={title}
          {...(id && canDelete ? { extra: <ManagementHeaderAction label="更多" onClick={() => setMore(true)} /> } : {})}
        />
      ) : null}
      {process.env.TARO_ENV !== 'h5' && id && canDelete ? (
        <ManagementHeaderAction label="更多" onClick={() => setMore(true)} />
      ) : null}
      <StateView kind={error ? 'error' : loading ? 'loading' : 'ready'} text={error || undefined} onRetry={() => setRetry((value) => value + 1)}>
        <FormContent>
          <FormSection title="基础信息">
            <FormField label="名称" required>
              <TextField value={values.name} onChange={(name) => patch({ name })} placeholder="请输入分组名称" maxlength={100} disabled={disabled} />
            </FormField>
            <FormField label="上级分组" arrow onArrowClick={() => !disabled && setPicking(true)}>
              <Text className={styles.value} onClick={() => !disabled && setPicking(true)}>
                {folderLabel(folders, values.parentId, '顶级分组')}
              </Text>
            </FormField>
            <EnumField label="素材类型" value={values.kind} options={FOLDER_KIND_OPTIONS} onChange={(kind) => patch({ kind })} disabled={disabled} />
            <EnumField label="状态" value={values.status} options={STATUS_ENUM} onChange={(status) => patch({ status })} disabled={disabled} />
            <FormField label="排序">
              <TextField value={values.sort} onChange={(sort) => patch({ sort })} placeholder="非负整数，越小越靠前" disabled={disabled} />
            </FormField>
            <FormField label="备注" stacked>
              <TextAreaField value={values.remark} onChange={(remark) => patch({ remark })} placeholder="请输入备注" maxlength={255} disabled={disabled} />
            </FormField>
          </FormSection>
          <FormError>{submitError}</FormError>
        </FormContent>
        {canSave ? <FormSubmitBar text="保存" submitting={busy} onSubmit={() => void save()} /> : null}
      </StateView>
      <FolderTreeSheet
        open={picking}
        title="选择上级分组"
        folders={folders}
        value={values.parentId}
        rootLabel="顶级分组"
        excludeIds={id ? subtreeIds(folders, id) : undefined}
        onSelect={(parentId) => patch({ parentId })}
        onClose={() => setPicking(false)}
      />
      <ActionSheet
        open={more}
        items={[{ key: 'delete', label: '删除分组', icon: 'trash', danger: true, onClick: () => void remove() }]}
        onClose={() => setMore(false)}
      />
    </ManagementPage>
  )
}

export default withAccountScope(FolderFormPage)
```

注意：「更多」入口的位置——先查 `@/components/molecules` 的 `PageHeader` 是否支持右侧操作（`grep -n "interface PageHeaderProps" -A10 src/components/molecules`）。若支持，用它的现有 prop 名替换上面的 `extra`；若不支持，改用 `ManagementPageHeader title={title} action={<ManagementHeaderAction label="更多" .../>}`（与首页一致，同时覆盖 H5 与小程序），删掉两段条件渲染。测试只依赖 `byLabel('更多')`。

- [ ] **Step 5: 运行确认通过** — `node --test tests/attachments-folders.test.cjs` → 5 PASS

- [ ] **Step 6: 类型检查 + lint + 提交**

```bash
git add apps/demo/app/src/pages/system/attachments/folders apps/demo/app/src/pages/system/attachments/folder-form apps/demo/app/tests/attachments-folders.test.cjs
git commit -m "feat(app): add attachment folder management and folder form pages

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: 清理旧组件 + 全量验证 + H5 走查

**Files:**
- Delete: `apps/demo/app/src/pages/system/attachments/AttachmentCard.tsx`、`FolderForm.tsx`、`FileUpload.tsx`、`FileUpload.h5.tsx`

- [ ] **Step 1: 确认无引用后删除**

Run（`apps/demo/app`）: `grep -rn "AttachmentCard\|FolderForm\|FileUpload" src tests`
Expected: 无输出（若有，先迁移再删）

```bash
git rm apps/demo/app/src/pages/system/attachments/AttachmentCard.tsx apps/demo/app/src/pages/system/attachments/FolderForm.tsx apps/demo/app/src/pages/system/attachments/FileUpload.tsx apps/demo/app/src/pages/system/attachments/FileUpload.h5.tsx
```

- [ ] **Step 2: 确认媒体库已不使用旧写法**

Run（`apps/demo/app`）: `grep -rnE "admin-card|admin-row|admin-meta|AdminPage|AdminSelect|AdminNotice|·" src/pages/system/attachments`
Expected: 无输出

- [ ] **Step 3: 全量测试与检查**

Run（`apps/demo/app`）: `pnpm test`
Expected: 0 fail（总数 = 原 430 + 新增）
Run（仓库根）: `pnpm typecheck:mobile` → 退出码 0
Run（仓库根）: `pnpm check:boundaries` → 退出码 0
Run（`apps/demo/app`）: `npx biome lint src/pages/system/attachments src/components/management tests/helpers/mount-page.cjs` → 无错误

- [ ] **Step 4: H5 走查**（H5 开发服务器 `http://127.0.0.1:21003`，新增页面需重启：在 `apps/demo/app` 运行 `pnpm dev:h5`）

逐项确认并记录结果：
1. 首页：搜索、三个筛选、清除筛选、下拉刷新、触底加载、「共 N 个素材」。
2. 上传：图片 / 视频 / **文件（确认浏览器未拦截文件选择框）** / 链接导入；已配置七牛时出现「上传到七牛云」。
3. 多选：管理 → 勾选 → 底部「删除」→ 确认 → 列表刷新；切换筛选后已选清零。
4. 详情：图片大图、视频播放、音频播放/停止、复制链接、编辑、更多 → 删除。
5. 编辑：名称 / 分组 / 状态保存后详情刷新。
6. 分组：筛选面板底部「管理分组」→ 展开 / 新建（默认上级）/ 编辑 / 上级不可选自身及后代 / 删除。
7. 视觉：两级间距 16/8、列表整宽、只读行无箭头、无「·」。

- [ ] **Step 5: 提交**

```bash
git add -A apps/demo/app/src/pages/system/attachments
git commit -m "refactor(app): remove legacy attachments card, folder form and upload buttons

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
