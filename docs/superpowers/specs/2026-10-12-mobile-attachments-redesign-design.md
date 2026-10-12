# 移动端媒体库重构设计

日期：2026-10-12
范围：`apps/demo/app/src/pages/system/attachments`（移动端），PC 与后端不变。

## 1. 背景与目标

媒体库是移动端最后一个仍使用旧 `AdminPage` / `admin-card` / `AdminSelect` 写法的系统模块：
四个竖排下拉筛选、一排上传按钮、可展开的分组管理、每张卡片内联展开详情与编辑表单，
信息用「·」拼接，并有手动「刷新」按钮。与已改造的用户、角色、部门等模块不是一套语言，
也违反 CLAUDE.md「Mobile form & list conventions」。

目标：功能不减（编辑素材按下文收敛），按移动端规范重构交互与视觉，与已改造模块一致。

不变：后端接口（`src/api/admin/attachments.ts`）、权限点、PC 端。

## 2. 已确认的决策

| 决策 | 结论 |
|---|---|
| 首页素材形态 | 列表 + 48px 缩略图（不做宫格、不做视图切换） |
| 素材编辑 | 仅保留名称 / 分组 / 状态；去掉 JSON 扩展信息编辑，详情页只读展示；保存不再提交 `metadata` |
| 七牛直传 | 保留为上传面板中的独立选项，仅在已配置七牛且有权限时出现，行为同现状 |

PC 对照：PC 媒体库为分组树 + 宫格 + 上传 + 预览弹窗 + 批量删除，无单素材编辑；移动端保留的编辑能力是移动端独有能力。

## 3. 页面与路由

| 页面 | 路由 | 职责 |
|---|---|---|
| 媒体库首页 | `pages/system/attachments/index`（原地重写） | 搜索、筛选、列表、上传、多选删除 |
| 素材详情 | `pages/system/attachments/detail/index`（新增） | 预览、信息分组、编辑/复制/删除入口 |
| 素材编辑 | `pages/system/attachments/form/index`（新增） | 名称、分组、状态 |
| 分组管理 | `pages/system/attachments/folders/index`（新增） | 分组树列表、新建入口 |
| 分组表单 | `pages/system/attachments/folder-form/index`（新增） | 新建/编辑/删除分组 |
| 链接导入 | `pages/system/attachments/import/index`（新增） | 粘贴图片链接导入 |

新页面注册到 `src/constants/page-config.ts`、`src/constants/routes.ts`（`SYSTEM_PAGES`）、
`src/modules/registry.ts`（`moduleId: 'system-attachments'`，权限与对应操作一致：
详情 list，编辑/分组表单 update 或 create，导入 create）。每页带 `index.config.ts`（`navigationStyle: 'custom'`，H5 下渲染 `PageHeader`）。

迁移完成后删除 `AttachmentCard.tsx`、`FolderForm.tsx`；`FileUpload.tsx` / `FileUpload.h5.tsx`
保留文件选择能力，但不再渲染自带按钮（改为可由操作面板触发，见 4.3）。

## 4. 媒体库首页

### 4.1 顶部
- `ManagementSearchBar`，占位「搜索素材名称」。
- `ManagementFilterTriggers` 三个触发器：分组 / 类型 / 状态。
  - 分组：层级树，复用部门选择的树形下钻模式（`DepartmentTreeNavigator` 或同类组件），含「全部分组」；面板底部固定「管理分组 ›」入口。
  - 类型：`BottomSelectSheet` 单选（全部 / 图片 / 视频 / 音频 / 其他）。
  - 状态：`BottomSelectSheet` 单选（全部 / 启用 / 禁用）。
- 有筛选条件且结果为空时显示 `ManagementFilterClear`。
- 去掉「刷新」按钮，改为下拉刷新（沿用其他列表页的刷新方式）。

### 4.2 列表
- `ManagementList` / `ManagementCell`，整宽白底、行间分割线，`margin: var(--space-4) 0`。
- 行首 48px 圆角缩略图：图片用 `aspectFill` 显示 `attachmentUrl(item, cloud?.domain)`，加载失败回退为图标；
  视频 / 音频 / 其他用对应 `LineIcon`。若 `ManagementCell` 现有 `avatar` 不支持方形缩略图，
  在 `ManagementCell` 增加一个最小的缩略图选项，不另造列表组件。
- 标题 = `name || originalName`；描述一行 = 文件大小（KB/MB 自适应格式）。
- 右侧状态标签仅在禁用时显示「禁用」。
- 点击行进入详情；`ManagementListFooter` 显示「共 N 个素材」并负责加载更多。

### 4.3 右上角操作
- 「上传」（有 `system:attachment:create`）：`ActionSheet` 选项
  图片 / 视频 / 文件 / 链接导入 /（配置七牛且有 `system:option:list` + `system:storage:upload-token` 时）上传到七牛云。
  - 上传目标为当前筛选的分组（未选为不指定）。
  - H5 下「文件」必须在点击回调内同步触发 `<input type=file>` 的 `click()`，否则浏览器会拦截。
  - 进度与结果用 toast：成功「已上传 N 个文件」；部分失败给出成功数与错误；用户取消不提示。
  - 七牛子选项沿用现有 `uploadAttachment(file, meta, cloud)`。
- 「管理」（有 `system:attachment:delete`）：进入多选模式，按钮变为「完成」。
- 「管理分组」入口固定放在分组筛选面板底部（「管理分组 ›」），只要能查看媒体库即可到达，不依赖上传权限。

### 4.4 多选模式
- 每行最左侧 `components/management/Checkbox`，点整行切换选中，不进详情。
- 底部 `SelectionFooter`：「已选 N 项」+「删除」；删除前 `confirmAction` 确认，调用 `batchDeleteAttachments`，成功后退出多选并刷新。
- 切换筛选或关键词时清空选择（保持现有行为）。

## 5. 素材详情页

- 加载 `getAttachment(id)`；云配置用于拼链接（无权限或失败时退化为本地链接，不报错）。
- 预览区（白色整宽块，`margin: var(--space-4) 0`，规范允许的 hero 例外）：
  - 图片：完整显示，点击 `Taro.previewImage`。
  - 视频：`Video` 内嵌播放。
  - 音频：播放 / 停止按钮，离开页面时销毁音频实例。
  - 其他：文件图标 + 原始文件名。
  - 无链接：「暂无可预览链接」。
- 信息分组（`DetailSection` / `DetailRow`）：
  - 基本信息：名称、分组（无则「未分组」）、类型（中文标签）、状态、大小、尺寸（图片有宽高时）或时长（音视频有时）。
  - 文件信息：原始文件名、MIME、存储方式、文件链接（点击行复制，toast「已复制」；只读行不带箭头）。
  - 扩展信息：`metadata` 非空时只读多行展示（格式化 JSON）。
  - 账号记录：默认折叠，创建时间、更新时间（`formatDateTime`）。
- 底部 `BottomActionBar`：编辑（update 权限）、复制链接（有链接时）、更多 → 删除（delete 权限）。
  删除确认后 `deleteAttachment`，成功返回上一页；返回首页时首页刷新（沿用其他详情页的 `useDidShow` 刷新约定）。
- 从编辑页返回时刷新详情。

## 6. 素材编辑页

- 字段：名称（必填，maxlength 255）、分组（树形选择器行，可选「未分组」）、状态（`Picker mode="selector"` 行）。
- 遵循表单规范：标签左值右、必填星号在前、导航行带 `›`。
- 保存只提交 `{ name, folderId, status }`（`folderId` 未分组为 `null`），**不提交 `metadata`**；
  成功 toast 后返回，失败 toast 不返回、数据不变。
- 权限 `system:attachment:update`；无权限时不显示提交栏。

## 7. 分组管理与分组表单

- 分组管理：分组树列表，支持下钻子分组；每行分组名，右侧标签显示禁用状态；描述行显示类型限制（「全部类型」时不显示）。
  点行进入分组表单（编辑态）；右上角「新建」（create 权限）进入新建态，默认上级为当前层级。
- 分组表单字段：名称（必填）、上级分组（树形选择器，排除自身及后代）、素材类型限制（selector：全部/图片/音频/视频/其他）、
  状态（selector）、排序（数字）、备注（`FormField stacked` 文本域）。
- 编辑态「更多 → 删除」（delete 权限），确认文案保留「包含子分组或素材的分组不能删除」；删除成功返回并刷新。
- 保存使用现有 `createFolder` / `updateFolder`（`FolderInput` 为完整对象，编辑态以加载值为初值，不会清空未展示字段）。

## 8. 链接导入页

- `FormField stacked` 文本域，占位「每行一个 HTTP/HTTPS 图片链接，最多 20 个」，不再额外写提示。
- 校验沿用现有规则：1–20 个且都以 http(s):// 开头，否则就地报错。
- 导入到首页当前筛选的分组（通过路由参数 `folderId` 传入）；成功 toast 返回首页并刷新。

## 9. 通用约束

- 遵守 CLAUDE.md「Mobile form & list conventions」全部条目（两级间距、无白卡片表单组、只读行无箭头、Checkbox 唯一实现、不用「·」拼接等）。
- 复用 `components/management` 现有组件；同一模式出现 ≥2 处才抽共享原子，不做额外抽象。
- 每个写操作保留现有防重（lock ref）、session 版本与 `canWriteModuleNow` / `useCurrentModuleAccess` 校验。
- 不改 `src/api/admin/attachments.ts` 的接口签名；如需格式化工具（大小、类型标签）放在 `attachments/model.ts`。

## 10. 测试与验证

页面级测试沿用 `tests/*.test.cjs` + `loadTs` + 内存后端的写法：

- 首页：关键词/分组/类型/状态正确映射到 `listAttachments` 参数；筛选变化清空选择；多选删除调用 `batchDeleteAttachments` 并刷新；无 delete 权限不显示「管理」；无 create 权限不显示上传项；七牛选项仅在配置且有权限时出现。
- 详情：各类型预览分支；链接行复制；无权限隐藏编辑/删除；删除确认取消不发请求。
- 编辑：只提交 `name/folderId/status`，不含 `metadata`；名称为空就地报错不提交；失败不返回。
- 分组：新建/编辑 payload；上级分组排除自身及后代；删除确认。
- 导入：链接校验；携带 folderId；成功返回。
- 注册：新路由出现在 page-config、`SYSTEM_PAGES`、registry。

验证命令：`apps/demo/app` 下 `pnpm test`；根目录 `pnpm typecheck:mobile`、`pnpm check:boundaries`；改动文件 `npx biome lint`；H5 手动走查各页面。

## 11. 风险

- H5 文件选择需要同步用户手势，经 ActionSheet 触发时须验证不被浏览器拦截。
- `ManagementCell` 若需新增缩略图选项，会影响共享组件，须保证其他列表页渲染不变（补充组件测试）。
- 去掉 metadata 编辑后，需要编辑扩展信息的场景只能走接口，移动端与 PC 均不提供。
