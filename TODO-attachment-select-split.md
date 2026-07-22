# TODO: `AttachmentSelect` 拆分（1315 行 → 拆为两个目录）

> 父文档：[TODO.md](./TODO.md) · 优先级：🟡 中 · 估算：半天

## 现状

文件 `apps/yishan-admin/src/components/AttachmentSelect/index.tsx` 包含 **1315 行**，是一个超大门面组件，内部定义了多个 React 组件：

- `AttachmentLibraryModal`（约 850 行，素材库 Modal）
- `AttachmentSelect`（约 230 行，素材选择器）
- 6 个导出变体（`AttachmentSelect`、`AttachmentImage`、`AttachmentImageSelect` 等）

文件单一定义了多个组件导致：
- 阅读时难以定位某个组件的 props 和渲染逻辑
- 改动一处会触发整文件热重载
- tree-shaking 不友好（整个文件作为一个 chunk）
- 测试覆盖几乎不可能（拆不开）

## 目标

把 `AttachmentSelect/index.tsx` 拆为两个独立目录：

```
src/components/AttachmentLibraryModal/   # 素材库 Modal，约 850 行
src/components/AttachmentSelect/         # 素材选择器（其余）
```

每个目录有自己的 `index.tsx` + `types.ts`（如需要）+ `__tests__/`（如需要）。

## 步骤

### Step 1：分析依赖

- 读 `AttachmentSelect/index.tsx` 全文，列出每个 export 组件的 props、内部 hooks、依赖
- 找出 `AttachmentLibraryModal` 与 `AttachmentSelect` 的**精确边界**（哪个 export 属于哪个新目录）
- 列出现在所有引用这些组件的地方（业务页面、其他 components）

### Step 2：抽出 `AttachmentLibraryModal`

- 新建 `src/components/AttachmentLibraryModal/` 目录
- 把内部 `AttachmentLibraryModal` 函数定义及其依赖搬过去
- 调整 import 路径

### Step 3：抽出 `AttachmentSelect` 及其变体

- 保留 `src/components/AttachmentSelect/` 目录（已是独立目录）
- 把 `AttachmentLibraryModal` 之外的组件定义搬到 `AttachmentSelect/index.tsx`
- 6 个 export 变体（如 `AttachmentImage`、`AttachmentImageSelect`）保留在 `AttachmentSelect` 中

### Step 4：跨目录 import

- `AttachmentSelect` 需要使用 `AttachmentLibraryModal` → `import { AttachmentLibraryModal } from '@/components/AttachmentLibraryModal'`
- 业务页面的 import 路径不变（仍 `from '@/components/AttachmentSelect'` 拿老导出）

### Step 5：删除原超大文件

- 删 `src/components/AttachmentSelect/index.tsx` 的旧版本
- 用 git mv 保留历史

## 验收

- [ ] `AttachmentLibraryModal/` 目录独立，行数 < 1000
- [ ] `AttachmentSelect/index.tsx` 行数 < 400
- [ ] 所有 export 仍能通过 `from '@/components/AttachmentSelect'` 拿到（兼容老引用）
- [ ] `tsc --noEmit` 0 错误
- [ ] admin jest 21/21 通过（无回归）
- [ ] 手动跑一次 `/account/center` 页面的"上传素材"流程，确认 modal 能正常打开

## 风险

- **边界划分**：原文件多组件混在一起，划分时容易把一个组件的内部状态留在错误的文件 → Step 1 必须先把依赖关系全列清楚再动手
- **循环依赖**：`AttachmentSelect` 和 `AttachmentLibraryModal` 互相 import 时容易出现循环 → 通过 `props.children` 或回调注入打破循环
- **导出兼容**：6 个变体 export 顺序、命名不能变，否则业务页面 import 会断 → Step 1 列出当前所有 export 名称，拆分后逐一核对

## 相关文件

- `apps/yishan-admin/src/components/AttachmentSelect/index.tsx`（待拆分）
- `apps/yishan-admin/src/pages/account/center/index.tsx`（重度使用 AttachmentImageSelect）
- `apps/yishan-admin/src/components/index.ts`（聚合导出）