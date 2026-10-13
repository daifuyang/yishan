# App 全站页面对齐管理规范（子项目 A）

日期：2026-10-13 · 状态：待审阅 · 子项目 B（首页常用应用）已完成并上线

## 背景与目标

`apps/demo/app` 的「系统管理」系列页面（`pages/system/**`）已按 `management` 组件家族与
`docs/design/mobile-form-spec.md` 改造并验收，是事实上的基准。其余页面没有跟进，结果是同一个 App
里并存两套语言：两套页头、两套行高（48px vs 52px）、两套分组标题（13px tertiary vs 44px primary）、
两套图标渲染、同一个「选择行取值」样式抄了四份。

目标：

1. 非 `system` 页面与基准确立同一套语言，并**用现成组件**实现，而不是逐页手写。
2. 让重复真正消失——共享层收敛，后续页面没有第二套可选。
3. 修掉审计发现的结构性缺陷（这些不是样式问题）。

## 现状（2026-10-13 只读审计结论）

> 下列行号来自本次审计，实施时需重新核对（文件可能已位移）。

### 第一层 · 硬规则违反（对照 `docs/design/mobile-form-spec.md`）

| 位置 | 问题 |
|---|---|
| `pages/login/index.module.scss:168-183` | 自绘勾选框，选中态实心蓝底（§7.2 点名禁止） |
| `pages/apps/index.tsx:66-79` | 手写搜索框，重复 `ManagementSearchBar` |
| `pages/index/components/TodoPreview.tsx:43`、`DashboardMetrics.tsx:29`、`HomeSection.tsx:34` | 跳转箭头用裸 `›` 文本，非 `LineIcon`（§8） |
| `pages/profile/edit/index.tsx:125-132,167-170`、`pages/profile/password/index.tsx:103` | 校验/保存失败走 `Taro.showToast`，未用内联 `FormError`（§9） |
| `pages/profile/password/index.tsx:36-62` | 手写 `PasswordRow`，与共享 `SecretField` 功能完全重复 |
| `pages/profile/login-log/index.tsx:104` | footer 用 `·` 拼接（§7.1） |
| `components/management/ManagementList.tsx:33-34` | 共享组件的 JSDoc 仍以「`@账号 · 手机`」示范副标题，与 §7.1 冲突 |
| `pages/login`、`pages/apps`、`pages/index` 多处 | 写死 `#1677FF`/`#F5F7FA`/`#c9cdd4` 等（§10） |
| `pages/login/index.module.scss:103-105` | 禁用态用灰底块（§3）；错误文案 13px 左对齐（§9 要求 12px 右对齐） |

### 第二层 · 两套组件家族并存

`pages/mine`、`pages/security`、`pages/contacts/index`、`pages/contacts/dept` 整套使用遗留
`molecules`：`SettingCell`（写死 52px 行高）、`SettingGroup`、`DangerAction`、`ListItem`、
`SectionHeader`（44px primary 标题）、`AppText`、`PageContainer`。基准一律
`ManagementPage`/`ManagementHeader`/`ManagementList`/`ManagementCell`/`ManagementStates`。

`molecules/PageHeader` **不在此列**：它是全站 H5 既定页头（`pages/` 下 36 个文件使用，基准页
`pages/system/position/detail/index.tsx:149`、`form/index.tsx:113` 亦在用它）。

### 第三层 · 结构性缺陷

| 位置 | 问题 |
|---|---|
| `pages/profile/login-log/detail/index.tsx` + `handoff.ts` | 无按 ID 查询接口，靠内存交接；H5 刷新/深链/小程序冷启恒定「记录已失效」。后端 `packages/core/system-api/src/core/routes/api/v1/app/users/index.ts:110` 仅有分页列表 |
| `pages/contacts/index/index.tsx:23-36,93-107` | `flatten` 算出 `depth`/`hasChildren` 却完全不渲染，部门树被拍平、层级丢失；共享 `DepartmentTreeNavigator`/`flattenDepts`/`hasChildren` 未被使用 |
| `pages/contacts/index/index.tsx`、`pages/contacts/dept/index.tsx` | 完全没有账号切换保护（既无 `withAccountScope` 也无 `getSessionVersion()` 校验） |
| `pages/contacts/index/index.tsx:59-63` | `useEffect` 与 `useDidShow` 首次进入都会加载，`getDeptTree` 打两次 |
| `pages/contacts/dept/index.module.scss:20-22` | `.dept__initial{display:none}` 死代码 |

### 第四层 · 示例模块与重复

| 位置 | 问题 |
|---|---|
| demo 全部 6 页 | `from '../../system/_shared/AdminUI'`（深度有 `../../` 与 `../../../` 两种）反向依赖 system 模块私有目录 |
| `src/pages/system/_shared/AdminUI.tsx` | 被 30+ 个 system 页面 import；同一文件还含遗留 `AdminPage`/`AdminSelect`/`AdminNotice` |
| `pages/index`、`pages/apps`、`pages/login` | 自定义导航栏胶囊避让逻辑三份几乎逐行相同的副本 |
| `pages/demo/region`、`pages/demo/todos/form`、`FormLayout.module.scss` | 「选择行取值/占位」样式四份副本 |
| `pages/demo/quickstart`、`pages/demo/region`、`pages/security` | 「无 hero 页补 16px 顶距」的 scss 三份副本，且 quickstart 的注释与事实不符（它其实有白色页头） |
| `pages/apps/pinned/index.tsx:144-149` | 把「上移/下移」按钮塞进 `ManagementCell` 的 `tag` 槽，与 `ManagementList.tsx:51`「行内不放按钮」的契约冲突 |
| `pages/system/dict/items/index.tsx:15`、`role/RoleEditor.tsx:223`、`dept/DepartmentForm.tsx:215` | 基准域自身的遗留尾巴，仍在用 `AdminPage`/`AdminSelect`/`AdminNotice` |
| `pages/system/coming-soon/index.tsx` | 不可达死代码：未注册进 `constants/page-config.ts`、全仓零引用、无 `index.config.ts` |

审计另有一处**基准缺陷**：`pages/system/position/form/index.tsx:123,142,150` 给 `FormField` 传了
`disabled` 却未向下透传给控件，导致禁用行的 label 没有按 §3 变灰；`pages/demo/todos/form/index.tsx`
反而正确。故本 spec 不把「基准」无条件当标准，而是**双向修正**。

## 已确认决策

| 决策 | 结论 |
|---|---|
| 深度 | 三层全做，含后端接口 |
| 非列表品类 | 首页/工作台/登录保留卡片语言，但收敛到 token 并抽共享原子；spec 补一节说明两类页面的适用边界 |
| 共享层 | 彻底收敛：页头合一、工具提公共层、废止 `PageContainer` 当鉴权壳、补缺失原子 |
| 示例模块 | 重定样板（todos 列表/详情/表单 + position 同级对齐到最合规写法）；`health`/`quickstart`/`region` 定位为「组件演示」，不对外当页面样板 |
| 落地方式 | 按层分批：地基 → 页面对齐 → 结构性缺陷 + 后端 |

## 设计

### 一、共享层的最终形态

| 收敛项 | 现状 | 目标 |
|---|---|---|
| 页头 | `molecules/PageHeader`（36 文件）+ `ManagementPageHeader`（列表页），功能重合 | 只留 `ManagementPageHeader`；`right` → `action`（全仓仅 `pages/demo/health/index.tsx:80` 用 `right`）；删除 molecules 版 |
| 账号域工具 | `withAccountScope`/`errorMessage` 在 `pages/system/_shared` | 提到 `@/utils/account-scope`；`tests/account-scope.test.cjs` 的加载路径同步 |
| 导航避让 | 首页/工作台/登录三份副本 | 一个共享 hook，三处复用 |
| 选择行 | `PickerRow`/日期行样式四份副本 | 抽 `PickerRow` 与 `DateField` 原子（`DateField` 用于演示页手写 `Picker` 的替换） |
| 卡片造型 | 首页 3 模块 + 工作台各写半径 10/12/14/16px、阴影、20/24px 间距 | 抽 `SurfaceCard`（通用白块卡片）与 `MetricCard`（仪表盘指标卡），半径/间距/阴影走 token |
| 图标 | `management/LineIcon`（25 处）、`components/icons`（4 处，其中 2 处属待退休遗留组件）、页面私有 `HomeIcon`/`LoginIcon` | 统一到 `LineIcon`；品牌自绘图标若保留须在本 spec 例外清单里写明 |
| 组件文档 | `ManagementList.tsx:33-34` 教 `·` 拼接 | 改成与规范一致的示例 |

`ManagementCell` 需增补一个**可选**的尾部动作槽与选择槽（`apps/pinned` 现借 `tag` 槽放按钮）。
约束：新增 prop 必须是可选的、不改变现有调用方语义；`tag` 保持「状态独立成列」的含义。

`PageContainer` 保留其通用门禁与布局能力，但**不再作为规范页的鉴权壳**：规范页一律用
`ManagementPage` 作布局壳 + 页面自身的 `useRequireAuth({ moduleId })`，消除双重门禁调用。

在 `docs/design/mobile-form-spec.md` 增补两节：

- **卡片型页面**（仪表盘 / 网格工作台 / 鉴权页）：保留成组卡片，但圆角、间距、阴影一律走 token；
  卡片内行高与其他页一致；不得自绘勾选框、搜索框、箭头。
- **H5 页头**：二级页在 H5 下统一渲染 `ManagementPageHeader`（`showBack` 视平台），小程序走原生导航。

### 二、批次 1 · 地基（不改页面行为）

1. 页头合一：迁移 36 处 `PageHeader` 调用到 `ManagementPageHeader`，删除 `molecules/PageHeader`。
2. `withAccountScope` / `errorMessage` 迁至 `@/utils/account-scope`，更新 30+ 处 system 页 import
   与 `tests/account-scope.test.cjs`。
3. 抽自定义导航避让 hook，首页/工作台/登录三处复用。
4. 抽 `PickerRow`、`DateField`、`SurfaceCard`、`MetricCard`（含「无 hero 页顶距」容器，消灭三份 scss 副本）。
5. `ManagementCell` 增补可选尾部动作槽/选择槽。
6. 修 `ManagementList` 的 JSDoc。
7. 图标统一到 `LineIcon`；`components/icons` 随之退休。

### 三、批次 2 · 页面对齐

- **认证/首页域**：`login`（勾选框 → `Checkbox`、错误内联右对齐、禁用不再变灰底块、写死色 → token）、
  `index`（卡片 token 化、裸 `›` → `LineIcon`、写死色 → token）、`apps`（手写搜索框 →
  `ManagementSearchBar` + `ManagementFilterBar`、`ManagementStates` 统一 loading/error/empty）、
  `apps/pinned`（改用新的尾部动作槽）、`messages`/`about`（H5 补统一页头）、删除 `system/coming-soon`。
- **个人中心域**：`mine`、`security`（`SettingCell`/`SettingGroup`/`DangerAction` →
  `ManagementList`/`ManagementCell` + `ActionSheet`）、`profile/edit` 与 `profile/password`
  （toast → `FormError`；`PasswordRow` → `SecretField`）。
  注：`profile/login-log` 列表**整块留到批次 3**（去 `·`、补筛选区、改用 `useListPagination` 一起做），
  避免同一文件被两个批次各改一遍——与通讯录的处理同理。
- **示例模块**：`demo/*` 六页去掉反向依赖、统一页头、接入新原子；`health` 拆掉重复行
  （「内存使用」与「可用内存」信息重复）与一行多属性；`region` 修正 `FormSection`/`DetailRow` 混用；
  `quickstart`/`region` 去掉 `.content` 副本并修正错误注释；`quickstart`/`region` 文件头声明
  「组件演示，非页面样板」。
- **基准域尾巴**：`dict/items`、`role/RoleEditor`、`dept/DepartmentForm` 的
  `AdminPage`/`AdminSelect`/`AdminNotice` 下岗；补 `position/form` 漏传的 `disabled`。

登录页的 label 上下堆叠**保留**为显式例外：`index.module.scss:111` 必须 16px 字号防 iOS 缩放，
76px 标签列在窄屏会被压死。该例外须在 PR 描述与 spec 例外清单中写明。

### 四、批次 3 · 结构性缺陷 + 后端

**个人登录记录按 ID 查询**（`packages/core/system-api`，无新迁移）

- `LoginLogRepository` 新增按 `id + user_id` 查询（复用 `findById` 的 SQL 结构，加 `user_id` 条件）；
- `LoginLogService.getMyLoginLogById(userId, id)`，未命中抛既有错误码
  （`SystemManageErrorCode.LOGIN_LOG_NOT_FOUND`）——对「不属于我」与「不存在」返回同一结果，不泄露存在性；
- 路由 `GET /api/v1/app/users/me/login-logs/:id`（`operationId: appGetMyLoginLog`），
  复用权限点 `PERMS.LIST_MY_LOGINS`，响应 `sysLoginLogDetailResp#`；
- `pnpm --filter @yishan/demo-api openapi:dump` 后按仓库惯例格式化并提交 `apps/demo/api/openapi.json`；
- 追加新路径到 `docs/architecture/api-v1-runtime-openapi.json`（`apps/demo/api/test/integration/product.test.ts:188`
  以「不在 baseline 中的路径」做精确断言，沿用既有先例——`/api/v1/app/menus/home` 等三条正是这样加进去的）；
- 生成客户端按仓库命令同步并一并提交。

App 侧：`pages/profile/login-log/detail` 改为真实拉取，带 loading/error/retry 与账号切换保护；
删除 `handoff.ts` 及列表页的 `rememberLoginLog` 调用。

**通讯录整块**（不拆到批次 2，避免同一文件改两遍）：两页迁到 `management` 家族；用
`DepartmentTreeNavigator` + `flattenDepts`/`hasChildren` 恢复部门层级；补 `withAccountScope`；
去掉首次进入的重复请求；`profile/login-log` 列表补筛选区（对齐 `system/login-log` 的状态/排序/时间范围）。

## 测试

每批必须维护既有 67 个 App `.cjs` 测试与 8 个浏览器套件；其中 `home.test.cjs`、`login.test.cjs`、
`contacts-dept.test.cjs`、`demo-pages.test.cjs`、`profile-forms.test.cjs`、`profile-sections.test.cjs`
直接覆盖被改页面，断言需随实现同步更新（不是改测试凑绿，而是断言新契约）。

新增测试：

- 共享层：页头合一后的统一行为；导航避让 hook 的取值；`PickerRow`/`DateField` 的取值与占位。
- 登录页：勾选框走共享 `Checkbox`（无自绘、无实心块）；失败态用内联 `FormError`。
- `profile/login-log` 详情：按 ID 拉取的成功/失败/重试；不属于当前用户的记录不展示。
- 通讯录：部门树层级与展开；账号切换不串数据；首次进入只发一次请求。
- 后端（Vitest）：`getMyLoginLogById` 命中/未命中/越权（他人记录）三种情形。

## 质量门

每批：`pnpm typecheck:mobile`、`pnpm --filter @yishan/demo-app test`、`pnpm build:app`、
`pnpm check:taro`、`pnpm check:boundaries`；H5 浏览器套件与 320/390 窄屏检查。

批次 3 额外：`pnpm test:api`、`pnpm check:openapi`、生成客户端 `git diff` 干净、
隔离 MySQL 集成测试（`pnpm test:integration`）。

不做真机验收（沿用既有边界：浏览器以隔离接口数据验收，不操作线上数据）。

## 例外清单（须在 PR 描述中说明的偏离）

规范允许「有理由的偏离」，但必须显式登记，避免例外悄悄变成新标准：

| 例外 | 理由 |
|---|---|
| 登录页 label 上下堆叠 | `pages/login/index.module.scss:111` 必须 16px 字号防 iOS 缩放，76px 标签列在窄屏会被压死 |
| 品牌自绘图标（首页/登录若保留） | 品牌识别需要；须收敛到 token 颜色，且不得再用第二套通用图标系统 |
| 卡片型页面的圆角与阴影 | 品类差异（仪表盘/网格），见 `docs/design/mobile-form-spec.md` 新增的卡片型页面一节 |
| `apps/pinned` 行内不带 `›` | 行点击唤起 ActionSheet，右侧已被动作槽占满 |

## 不做（YAGNI）

- 不为仪表盘/网格页重新设计布局（只收敛 token 与抽原子）。
- 不改动 `system` 页面的交互能力，只做机械迁移与基准缺陷修补。
- 不引入新依赖，不改后端既有字段与业务语义。
- 不做「通用主题系统」或 token 体系重构，只把写死值换回既有 token。

## 风险

| 风险 | 处置 |
|---|---|
| 批次 1 触碰 30+ 个 system 页 import，面广 | 纯机械替换，单独一轮 CI 全绿才算过 |
| `ManagementCell` 加槽是共享契约变更 | 新 prop 可选、增量添加，不改现有调用方语义 |
| 通讯录从平铺变树是**交互变更** | 浏览器逐步验收，测试覆盖层级与展开 |
| 新后端路径会进 OpenAPI baseline 与生成客户端 | 同一次提交里一并更新，CI 会卡同步 |
| 36 文件页头迁移可能漏改 `right` 等属性 | 全仓仅一处使用 `right`，迁移后 grep 校验零残留 |
