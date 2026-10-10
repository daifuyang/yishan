# CRM Customer Workspace Design

## Goal

将现有 CRM 客户 CRUD 页面升级为销售人员的客户工作台：用户在客户列表中保持当前视图、筛选、分页和滚动位置，通过 Customer Drawer 快速查看和完成跟进；复杂浏览仍使用完整详情页。

## Confirmed scope

- 重构 `/crm/customers` 为客户工作台，保留现有 CRM 模块、菜单数据源、请求方式和 Ant Design Pro 基座。
- 客户公海收敛为客户工作台的 `pool` 视图；保留后端公海业务规则和接口，不新建平行实现。
- 新增宽 Customer Drawer，URL 使用 `customerId` 搜索参数恢复打开状态。
- 高频 Drawer 一级页签为概览、跟进、联系人、商机、更多；联系人和跟进接入真实 API，商机在没有实体/API 时提供可扩展空状态。
- 完整详情页保留，逐步复用 Drawer 的领域组件与数据查询。旧 `/crm/customer-detail?id=:id` 链接保持兼容；是否新增 `/crm/customers/:id` 由动态菜单路由能力验证后决定。
- 不新增数据库 DSL、低代码引擎或大范围全局样式覆盖；不为 AI、商机、阶段或保存视图伪造持久化数据。

## Existing architecture to preserve

- Admin: React 19、Umi Max、Ant Design 6、Ant Design Pro。业务页面位于 `apps/yishan-admin/src/modules/crm/pages/`，请求集中于 `apps/yishan-admin/src/services/crm.ts`。
- API: Fastify + TypeBox + Drizzle。CRM 领域位于 `apps/yishan-api/src/modules/crm/`，路由只编排 service，service 只通过 repository 访问数据。
- Menu: `apps/yishan-api/src/modules/crm/config/system-menu.json` 是动态菜单来源。
- RBAC: 后端 `CrmPermissions` 是权限真相源。前端只展示当前用户获授操作；不能用 disabled 代替隐藏。
- Current uncommitted CRM backend work is user-owned baseline. This work must not overwrite, reset, or stage it.

## Information architecture

```text
CRM
├── 工作台              /crm/dashboard
├── 客户                /crm/customers?view=mine
│   ├── 全部 / 我的 / 待跟进 / 重点 / 公海 / 自定义视图
│   └── customerId=<id> 打开 Customer Drawer
├── 联系人              /crm/contacts
├── 商机                仅在真实模块存在时显示；否则不新增假路由
├── 跟进                /crm/activities
└── CRM 设置
```

“重点客户”在第一版映射为已有 `level` 筛选，而不是另造状态；保存的自定义视图只声明前端模型和 service 接口，不调用不存在的后端 API。

## Data and request design

### Customer list

列表继续调用 `GET /api/crm/v1/customers`。查询参数来自 URL，包含 `view`、分页、排序和可序列化筛选项。请求仅刷新列表，不因 Drawer 打开而重新获取。

现有 API 已支持：关键词（含联系人姓名/手机号）、状态、来源、等级、类型、行业、负责人、协同人、标签、创建/最近跟进/下次跟进时间、排序与 `all|mine|collaborating|pending|stale7d|pool` 视图。地区、是否有商机、明确逾期布尔值等尚无 API；第一版高级筛选仅展示已可真实执行的条件，未实现条件以清晰的 capability 边界隔离。

### Drawer

Drawer 打开后请求 `GET /api/crm/v1/customers/:id`。概览可读取已有的客户、主要联系人和跟进时间。跟进页按需请求 `GET /api/crm/v1/customers/:id/activities`，联系人页按需请求 `GET /api/crm/v1/customers/:id/contacts`。保存跟进使用 `POST /api/crm/v1/customers/:id/activities`；后端已有事务性跟进时间重算，前端仅刷新客户详情和活动数据，不自行推导业务时间。

联系人使用既有嵌套路由创建。商机、阶段、AI 摘要、附件、地址与操作日志在没有真实实体/API 时显示空状态与接入点，不能内嵌假数据。

### Stats

客户页使用独立 `CustomerWorkspaceStats` 查询接口。实现时优先适配真实统计 API；若暂时缺少精确口径，使用加载/不可用状态而非 JSX 中硬编码数字。现有 dashboard 统计不可直接冒充“逾期未跟进”和“本周新增”。

## UI design

- 页面沿用 `PageContainer`，自动 breadcrumb，不传空 `header.breadcrumb`。
- 页面边距 24px、模块间距 16px/24px，浅灰背景和白色内容区；不新增全局视觉覆盖、渐变或玻璃效果。
- 页面头只呈现标题、说明和“新建客户 / 导入 / 更多”。低频动作进入 Dropdown。
- 视图 tabs 在页头下方，紧凑筛选栏取代传统多行搜索表单；高级筛选使用右侧 Drawer。
- 统计为四张紧凑摘要单元，具备 loading、error、unavailable 状态。
- 表格行与客户名默认打开 Drawer；操作列只显示核心“跟进”和更多菜单，删除置于菜单末尾并二次确认。
- Drawer 宽度使用响应式范围：大屏约 55%–62%（900–1180px），平板 80%–90vw，小屏全屏。Header、摘要栏和 Pipeline 不使用大卡片堆叠。
- 一级页签最多五项。概览采用 65/35 双栏；低频内容放入“更多”的二级导航。

## Components and boundaries

在现有 `apps/yishan-admin/src/modules/crm/` 下新增客户工作台组件目录，不移动其它模块。页面容器负责 URL 状态、权限和刷新编排；展示组件不直接请求 API。

```text
pages/customers/
  index.tsx                     URL state and page orchestration
  components/
    CustomerPageHeader.tsx
    CustomerViewTabs.tsx
    CustomerFilterBar.tsx
    CustomerAdvancedFilterDrawer.tsx
    CustomerWorkspaceStats.tsx
    CustomerTable.tsx
    CustomerDrawer/
      CustomerDrawer.tsx
      CustomerDrawerHeader.tsx
      CustomerSummaryBar.tsx
      CustomerStagePipeline.tsx
      tabs/{Overview,FollowUp,Contacts,Opportunities,More}Tab.tsx
```

领域类型和 query 编解码集中在 CRM service/types 层。阶段以 `CustomerStage` 前端契约表示，只有后端模型确认后才持久化。`CustomerView` 支持系统视图与未来保存视图，但第一版不扩展数据库。

## Permissions and errors

- 按当前用户的有效权限隐藏创建、编辑、删除、转交、释放、认领、跟进和新建联系人入口；后端仍是最终授权者。
- Drawer detail、活动、联系人均单独处理 loading、empty、error 与 not-found，不能留下空白容器。
- 公海客户只显示允许的认领动作；不得在 Drawer 中暴露无权限的编辑和跟进。

## Performance and state

- 列表、详情和每个 tab 独立请求；不预取低频数据。
- 关闭 Drawer 仅移除 `customerId`，保留 view、filter、page、排序和当前列表内存状态。
- 保存客户/跟进/联系人后使用最小范围刷新：刷新 detail 和相关 tab，必要时刷新当前表格页，不重置筛选或分页。

## Verification

每个可交付阶段均运行与变更范围匹配的 admin typecheck、Biome lint、Jest 和 production build；触及 API 时额外运行 CRM Vitest。验收覆盖：我的客户视图、关键词与组合筛选、Drawer 恢复与切换、保存跟进后时间线与跟进时间更新、关闭 Drawer 保持列表状态，以及完整详情页的兼容访问。
