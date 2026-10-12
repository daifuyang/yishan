# 首页常用应用：用户固定 + 使用习惯推荐

日期：2026-10-12 · 状态：待审阅 · 子项目 B（子项目 A「页面对齐管理规范」另起 spec）

## 背景与目标

小程序首页「常用应用」目前不是由用户决定的：

- 后端没有任何「首页显示」字段；首页读取按账号 + 部署隔离的本地 storage（`stores/modules.ts`），
  未保存过时退化为**工作台菜单顺序的前 8 个**。种子数据里排第一的分组叫「常用」，因此看起来像在菜单里配置。
- 编辑器 `pages/apps/FavoritesEditor.tsx` 与 `setCommonModules` 已存在但无入口；没有任何使用记录。

目标：常用应用由**用户自己固定**，空位由**用户使用习惯自动推荐**补齐，数据存后端、跨设备一致；
与工作台菜单配置解耦（菜单只决定「有哪些应用、叫什么、能不能用」）。

已确认的决策：

| 决策 | 结论 |
|---|---|
| 存储 | 后端持久化（固定列表 + 使用计数都上云） |
| 组合 | 一个区块，最多 8 格：固定在前（用户顺序），剩余空位按推荐补位 |
| 入口 | 只做独立编辑页（首页「编辑 ›」进入），工作台不加长按 |
| 标识 | 以 `sys_workbench_menu.id`（入口节点）为键，推荐由后端排序 |

## 后端（packages/core/system-api）

### 数据表（新迁移，编号接在现有最大编号之后；已发布迁移不可改）

`sys_user_workbench_pin` — 用户固定的入口

| 列 | 类型 | 说明 |
|---|---|---|
| id | int PK AI | |
| user_id | int NOT NULL | |
| workbench_menu_id | int NOT NULL | 入口节点（type=1） |
| sort_order | int NOT NULL DEFAULT 0 | 用户排序，0 起 |
| created_at / updated_at | datetime | 与现有表一致 |

唯一 `uniq_user_workbench_pin(user_id, workbench_menu_id)`；索引 `idx_user_workbench_pin_user_id`。
整体覆盖写，不做软删除。

`sys_user_workbench_usage` — 使用计数

| 列 | 类型 | 说明 |
|---|---|---|
| id | int PK AI | |
| user_id | int NOT NULL | |
| workbench_menu_id | int NOT NULL | |
| open_count | int NOT NULL DEFAULT 0 | |
| last_opened_at | datetime NOT NULL | |
| created_at / updated_at | datetime | |

唯一 `uniq_user_workbench_usage(user_id, workbench_menu_id)`；索引 `idx_user_workbench_usage_user_id`。

项目不使用外键：菜单被删除、停用、取消授权或所属模块禁用后，相关行在**读取时**按授权树过滤掉，
在下次 `PUT /pins` 时被自然清除；usage 残留行无害（不参与排序）。

### 接口（`/api/v1/app/menus`，只作用于 `request.currentUser`）

所有授权判断复用 `AppMenuService.getAuthorizedTree(roleIds, moduleLoader)` 得到的入口集合（以下称「可用入口」）。
权限点按现有 `PERMS` + `registerPermissions` 方式登记，`group: 'app'`，并给默认角色授权（与 `app:menu:authorized-tree` 一致）。

**`GET /home`**（`appGetHomeApps`）→ `{ pinned: number[], ranked: number[] }`

- `pinned`：用户固定且仍在可用入口中的 id，按 `sort_order`。
- `ranked`：其余**全部**可用入口 id，按推荐分降序；同分（含零分）按工作台菜单树先序顺序。
- 后端不截断：只有前端 registry 知道某入口有没有已注册的移动端页面，截断交给前端。

推荐分：`score = open_count × 0.5^(Δdays / 14)`，Δdays 为 `now - last_opened_at` 的天数；
`last_opened_at` 早于 90 天的计 0 分。新用户无 usage 时所有分数为 0，自然退化为菜单顺序，首页不会空。

**`PUT /pins`**（`appSaveHomePins`）body `{ menuIds: number[] }` → 返回同 `GET /home`

- 去重、保序；丢弃不在可用入口中的 id（越权、分组节点、已删除）；超过 8 个返回 400。
- 事务内删除该用户全部 pin 后按数组下标写入 `sort_order`。

**`POST /usage`**（`appReportAppUsage`）body `{ menuId: number }` → 204

- 不在可用入口中则 204 且不写（不泄露存在性，也不报错打断前端）。
- `INSERT ... ON DUPLICATE KEY UPDATE open_count = open_count + 1, last_opened_at = NOW()`。

分层遵循 routes → service → repository；SQL 只在 repository。TypeBox schema 注册到现有 schema 集合，
`pnpm --filter @yishan/demo-api openapi:dump` 后按仓库惯例格式化 `openapi.json`。

### 种子

删除 `src/scripts/seed/config/app-menus.json` 中名为「常用」的分组（其中「通讯录」入口移到合适分组）。
已部署环境的「常用」分组不自动删除，PR 中注明由运维在 `/system/app-menu` 手动处理。

## 前端（apps/demo/app）

### 数据层

- `api/menu.ts` 新增 `getHome()`、`savePins(menuIds)`、`reportUsage(menuId)`，类型放 `api/types`。
- `stores/modules.ts`：
  - 删除 `commonModuleIds` / `commonConfigured` / `setCommonModules` / `commonKey` / `commonFor` / `MAX_COMMON_APPS` 及本地 storage 读写；
    旧本地 key 不迁移，直接作废。
  - 新增 `home: { pinned: number[]; ranked: number[] } | null`，与 `menus` 在同一 `load()` 中并发获取，
    沿用现有的 generation / ownerId / inFlight 防串号机制；`home` 获取失败不影响 `menus`（首页退化为菜单顺序）。
  - 新增 `savePins(menuIds)`：调接口，用返回值更新 `home`；失败抛出带中文信息的 Error。
- `modules/registry.ts` 新增纯函数
  `getHomeApps(groups: WorkbenchAppGroup[], home, max = 8): { apps: WorkbenchApp[]; pinnedCount: number }`：
  以 `getWorkbenchGroups` 结果（已过滤未注册页面与无权限入口）为准，按 `menuId` 先取 pinned 再取 ranked，
  跳过不可用 id，截到 `max`。`home` 为 null 时按 groups 顺序取前 `max`。

### 使用记录上报

- 打开应用统一走 `pages/apps/navigation.ts` 的 `openWorkbenchApp`；首页 `openModule` 改为调用它（顺带获得授权复查与连点保护）。
- `navigateTo` 成功后 `void menuApi.reportUsage(app.menuId).catch(() => {})`，不 await、不提示。
- 首页指标卡跳转（`getMetricDetail`）不计入。

### 首页（pages/index）

- 「常用应用」区块标题右侧 `SectionLink` 文案由「全部」改为「编辑」，跳转编辑页；宫格最多 8 个，不加「全部」格（工作台本身是 Tab）。
- 无可用应用时沿用现有空态文案。

### 编辑页 `pages/apps/pinned/index`（新增）

路由常量、`page-config.ts`、`modules/registry.ts` 页面登记按现有约定补齐；`navigationStyle: 'custom'`；
默认导出包 `withAccountScope`。全部使用现成组件：

```
ManagementPage withActions
├─ ManagementPageHeader title="编辑常用应用"
├─ ManagementFilterBar > ManagementSearchBar        （仅过滤「全部应用」）
├─ DetailSection title="已固定 (n/8)"
│   └─ ManagementList > ManagementCell(icon, title, showArrow=false)
│        点击 → ActionSheet：上移 / 下移 / 取消固定（首行无上移、末行无下移）
├─ DetailSection title=<工作台分组名>   × 每个分组
│   └─ ManagementList > ManagementCell(icon, title) + 右侧 Checkbox（不传 onClick，整行切换）
│        已满 8 个时未勾选行整行置灰、不可点
└─ FormSubmitBar text="保存"  → store.savePins → toast → navigateBack
```

- 图标：若 `ManagementCell` 不能承载 `ApplicationIcon`，给它增加通用的 `icon?: ReactNode` 插槽，而不是在页面里手写行。
- 空固定列表时「已固定」区块显示一行说明「未固定的位置会按你的使用习惯自动推荐」。
- 草稿只在本页 state，未保存离开不提示（与现有表单页一致）。

### 清理

- 删除 `pages/apps/FavoritesEditor.tsx`。
- 删除工作台对「常用 / 常用应用」分组名的特殊过滤（`pages/apps/index.tsx`）。
- 更新 `apps/demo/app/README.md` 中关于常用应用的描述。

## 测试

后端（Vitest，`packages/core/system-api/test/`）：

- 推荐分：衰减、90 天截断、同分按菜单顺序、排除已固定。
- 授权：取消角色授权 / 禁用模块 / 删除入口后，`GET /home` 不再返回；`PUT /pins` 丢弃越权与分组 id、去重保序、>8 返回 400。
- `POST /usage`：累加与 last_opened_at 更新；不可用入口不写入。

App（`node --test`）：

- `getHomeApps`：pinned 优先、ranked 补位、跳过未注册/无权限、截断、`home=null` 退化。
- store：`load` 同时拿到 `menus` 与 `home`；`home` 失败不影响 `menus`；切换账号不串数据；`savePins` 成功/失败。
- `openWorkbenchApp`：成功后上报一次、上报失败不影响跳转、被拒绝的应用不上报。
- 编辑页结构测试：使用 `ManagementPageHeader` / `Checkbox` / `FormSubmitBar`，路由三处登记齐全。
- 改写 `workbench.test.cjs`、`modules.test.cjs` 中断言本地 storage 常用应用行为的用例；
  `tests/browser/workbench.js` 的「常用」分组 fixture 与断言同步调整。

质量门：`pnpm typecheck:mobile`、`pnpm --filter @yishan/demo-app test`、`pnpm build:app`、
`pnpm --filter @yishan/demo-api test`、`pnpm check:boundaries`、`pnpm lint`；H5 下手动走一遍首页 → 编辑 → 保存 → 打开应用 → 首页推荐变化。

## 不做（YAGNI）

- 工作台长按固定、首页拖拽排序。
- 管理员为角色预设默认常用应用。
- 本地旧偏好迁移到后端。
- 推荐参数（半衰期、窗口）可配置化。
