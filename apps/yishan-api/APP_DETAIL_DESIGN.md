# 应用详情页（App Detail）设计规划

本文档用于规划“应用管理”中的应用详情页信息架构与后端 API 形态，支撑应用内资源的创建、配置、发布与权限管理。资源类型包含：普通表单、流程表单（后续实现）、报表（后续实现）、可播报门户（后续实现）、数字化大屏、自定义页面、外部链接等。

## 1. 目标与边界

### 1.1 目标

- 统一“应用”作为资源容器的模型与操作（创建、配置、发布、权限、审计）。
- 以“资源（Resource）”为核心抽象承载不同类型能力，减少为每种类型单独设计一套管理流程的成本。
- API 设计对齐服务端开放 API 的调用方式：服务端通过 `access_token` 鉴权、按权限调用（参考宜搭服务端开放 API 的思路：服务端持 token 调用数据/流程/任务/附件等接口）。

### 1.2 非目标（本期不做）

- 流程表单/报表/可播报门户的完整运行与渲染。
- 应用运行态（前台应用门户）完整落地；本规划聚焦“管理端详情页”和“后端管理 API”。

## 2. 核心概念模型

### 2.1 应用（App）

应用是一个“可发布的业务容器”，只负责：

- 基本信息：名称、图标、颜色、描述、状态、排序。
- 版本/发布：草稿、已发布版本、回滚（可选）。
- 权限：谁能管理/配置/发布/访问应用与应用内资源。

### 2.2 资源（Resource）

资源是应用内的“功能单元”，用统一模型描述不同类型：

- `type`：资源类型（表单/流程表单/报表/门户/大屏/自定义页/外链……）。
- `name`、`description`、`icon`（可选）：展示信息。
- `route`：管理端/运行端的路由信息（由类型决定规则）。
- `config`：资源配置（JSON），由类型决定结构与校验。
- `status`：启用/禁用、草稿/已发布（建议将“运行态发布”与“资源启用”分离）。
- `sort_order`：应用内排序。

> 资源的统一抽象使“应用详情页”可以以一套 UI/接口管理所有类型资源，仅在创建/配置/预览/发布时按类型差异化处理。

### 2.3 连接器（Connector，可选）

当资源需要对接第三方平台（例如宜搭、钉钉）时，引入“连接器”概念：

- 连接器持有必要的凭证/配置（例如企业内部应用的 `access_token` 获取配置、应用类型、权限范围）。
- 资源引用连接器（`connectorId`），实现“一应用多连接器”或“多应用共享连接器”。

## 3. 应用详情页信息架构（建议）

路由：`/system/apps/:id`

建议以 Tabs/分段导航组织：

1) 概览（Overview）
- 应用基础信息卡：名称、图标、颜色、状态、描述、创建/更新人、创建/更新时间。
- 统计：资源总数、启用数、草稿数、最近发布版本（可选）。
- 快捷入口：新建资源、发布、权限、审计日志（可选）。

2) 资源（Resources）
- 资源列表支持“分组 + 搜索 + 排序”：按资源类型分组或按状态分组。
- 资源操作：新建、编辑信息、配置、预览、发布/下线、复制、删除。
- 资源类型入口：普通表单 / 流程表单（灰置）/ 报表（灰置）/ 可播报门户（灰置）/ 数字化大屏 / 自定义页面 / 外部链接。

3) 权限（Permissions）
- 应用管理员：可配置、可发布、可管理资源。
- 应用访问者：可访问运行端（后续实现）。
- 资源级权限（可选）：覆盖应用默认权限（适用于报表/表单的细粒度授权）。

4) 发布（Publish）
- 当前草稿与线上版本信息（可选）。
- 发布记录：时间、版本号、发布人、变更摘要。
- 回滚：选历史版本回滚（可选）。

5) 设置（Settings）
- 连接器配置（如宜搭/钉钉）：绑定连接器、授权状态、权限范围检查（后续）。
- 应用级参数：主题、布局、导航（后续）。

## 4. 资源类型规划（字段、配置、运行方式）

统一字段（建议）：

- `id`、`appId`、`type`、`name`、`description`
- `status`（启用/禁用）与 `publishStatus`（草稿/已发布，可选）
- `sort_order`
- `config`（JSON）
- `createdAt/updatedAt` 与创建/更新人

### 4.1 普通表单（FORM）

用途：应用内的“数据录入/数据管理”能力。

配置建议（`config`）：

- `engine`: `"native"` | `"yida"`（native 为本系统自建表单引擎；yida 为宜搭表单代理）
- `schema`: 表单结构（native 时）
- `yida`: { `appType`, `formUuid`, `corpId` ... }（yida 时）
- `dataPermissions`: 数据权限策略（后续）

管理端操作：

- 表单结构设计（native）或绑定宜搭表单（yida）。
- 数据列表/详情（后续：结合统一的表单数据 API）。

服务端开放 API 参考要点：

- 以 `access_token` 作为服务端调用凭证。
- 能力覆盖：查询表单实例数据、保存/更新/删除表单数据、批量操作、高级查询等。

### 4.2 流程表单（PROCESS_FORM，后续实现）

用途：带审批流程的表单。

配置建议：

- `engine`: `"yida"`（优先）或 `"native"`（后续）
- `process`: { `processCode`/`processId`, `formUuid`, ... }

服务端开放 API 参考要点：

- 发起审批流程、终止流程实例。
- 获取审批记录、同意/拒绝任务、转交任务、评论等（任务/流程相关 API）。

### 4.3 报表（REPORT，后续实现）

用途：指标聚合与可视化报表。

配置建议：

- `dataset`: 数据集定义（SQL/接口/表单数据源）
- `charts`: 图表配置
- `filters`: 筛选器配置

### 4.4 可播报门户（PORTAL_BROADCAST，后续实现）

用途：门户内容可定时播报/轮播（面向大屏/会议室）。

配置建议：

- `pages`: 门户页面列表
- `schedule`: 播报计划（cron/间隔）
- `player`: 播放配置（循环、切换动画）

### 4.5 数字化大屏（DASHBOARD）

用途：大屏可视化/运营看板。

配置建议：

- `layout`: 栅格/自由布局
- `widgets`: 组件列表（图表/表格/指标卡/地图/富文本等）
- `theme`: 主题色、背景、字号等

### 4.6 自定义页面（CUSTOM_PAGE）

用途：低代码/可配置页面（更贴近门户页面或业务页面）。

配置建议：

- `schema`: 页面结构（组件树 + 数据源 + 交互动作）
- `route`: { `path`, `layout`, `menu` }（管理端/运行端分别维护）

### 4.7 外部链接（EXTERNAL_LINK）

用途：跳转到外部系统或第三方页面。

配置建议：

- `url`: 目标地址
- `openMode`: `"new_tab"` | `"iframe"`（iframe 需白名单/安全策略）
- `paramsMapping`: 参数映射（如携带用户信息/租户信息的安全令牌，后续）

## 5. 后端 API 规划（管理端）

### 5.1 应用详情

- `GET /api/v1/admin/apps/:id`：获取应用详情
- `PATCH /api/v1/admin/apps/:id`：更新应用基本信息（名称/图标/颜色/描述/排序/状态）

### 5.2 应用资源（统一模型）

- `GET /api/v1/admin/apps/:appId/resources`：资源分页列表（支持 `type/status/keyword/sortBy/sortOrder`）
- `POST /api/v1/admin/apps/:appId/resources`：创建资源（仅创建“壳”，配置可后置）
- `GET /api/v1/admin/apps/:appId/resources/:id`：资源详情
- `PATCH /api/v1/admin/apps/:appId/resources/:id`：更新资源（名称/描述/排序/状态）
- `DELETE /api/v1/admin/apps/:appId/resources/:id`：删除资源

资源配置建议拆分为独立接口，便于按类型校验与权限控制：

- `PUT /api/v1/admin/apps/:appId/resources/:id/config`：保存资源配置（按 type 校验）
- `POST /api/v1/admin/apps/:appId/resources/:id/publish`：发布资源（可选）
- `POST /api/v1/admin/apps/:appId/resources/:id/unpublish`：下线资源（可选）

### 5.3 权限与审计（建议）

- `GET /api/v1/admin/apps/:appId/permissions`：获取应用权限配置
- `PUT /api/v1/admin/apps/:appId/permissions`：保存应用权限配置
- `GET /api/v1/admin/apps/:appId/audit-logs`：操作审计（可选）

## 6. 服务端开放 API（宜搭）对齐方式（后续实现）

参考服务端开放 API 的调用思路，建议在本系统后端实现“代理层（Proxy Service）”：

### 6.1 连接器与 token 管理

- 连接器保存：应用类型（企业内部/第三方）、凭证配置、权限范围。
- 服务端获取 `access_token` 并缓存（按过期时间刷新）。
- 所有对宜搭的调用在后端完成，前端仅调用本系统的管理 API。

### 6.2 代理 API（建议形态）

以“资源”为入口，屏蔽第三方差异：

- `GET /api/v1/admin/apps/:appId/resources/:resourceId/form-data`：查询表单数据（映射为宜搭“查询表单实例数据/高级查询”等）
- `POST /api/v1/admin/apps/:appId/resources/:resourceId/form-data`：保存表单数据（映射为宜搭“保存表单数据/新增或更新表单实例”等）
- `PATCH /api/v1/admin/apps/:appId/resources/:resourceId/form-data/:instanceId`：更新
- `DELETE /api/v1/admin/apps/:appId/resources/:resourceId/form-data/:instanceId`：删除

流程/任务同理：

- `POST /api/v1/admin/apps/:appId/resources/:resourceId/process/start`
- `POST /api/v1/admin/apps/:appId/resources/:resourceId/tasks/:taskId/approve`
- `POST /api/v1/admin/apps/:appId/resources/:resourceId/tasks/:taskId/reject`

## 7. 数据库/Prisma 模型规划（建议）

现有 `sys_app` 已承载应用基础信息。建议新增：

### 7.1 sys_app_resource（应用资源表）

- `id`、`appId`
- `type`（枚举：FORM/PROCESS_FORM/REPORT/PORTAL_BROADCAST/DASHBOARD/CUSTOM_PAGE/EXTERNAL_LINK）
- `name`、`description`
- `status`、`sort_order`
- `config`（JSON）
- `deletedAt`（软删，推荐）
- 审计字段（creator/updater/createdAt/updatedAt）

### 7.2 sys_connector（可选）

- `id`、`type`（yida/dingtalk/…）
- `config`（JSON，含凭证配置，但需加密/脱敏）
- `status`、审计字段

## 8. 前端实现规划（详情页）

### 8.1 路由与页面结构

- `应用列表`: `/system/apps`
- `应用详情`: `/system/apps/:id`

应用详情页建议按 Tabs 分拆组件，避免一个文件过大：

- `OverviewTab`：基础信息 + 统计
- `ResourcesTab`：资源列表 + 新建资源
- `PermissionsTab`：权限配置（后续）
- `PublishTab`：发布与记录（后续）
- `SettingsTab`：连接器与参数（后续）

### 8.2 资源创建流程（MVP）

- “新建资源”弹窗：选择类型 → 输入名称/描述/排序 → 创建成功后进入资源配置页（按类型路由）。
- 资源列表：卡片/列表切换、分组展示、搜索/筛选。

## 9. 迭代路线（建议）

### Phase 1（当前可落地）

- 应用详情页框架（概览/资源两大模块）。
- 资源模型与管理 API（创建/列表/更新/删除）。
- 资源类型先落地：外部链接、自定义页面、数字化大屏（先做壳与配置存储）。

### Phase 2（对接宜搭：普通表单）

- 连接器 + token 管理。
- 绑定宜搭表单资源、代理查询/保存/更新/删除表单数据接口。

### Phase 3（流程表单/任务）

- 对接流程与任务相关 API（发起、审批、记录）。

### Phase 4（报表/可播报门户/发布体系完善）

- 报表引擎/数据集。
- 门户播报调度。
- 应用/资源级发布、版本与回滚。

## 10. 渐进式技术实现文档（先菜单 → 普通表单 → 字段定义 → 数据CRUD）

本章节给出“可逐步落地”的实现顺序与每一步的后端/前端改动范围，尽量保证每个里程碑都能独立上线、可回归、可扩展。

### 10.1 里程碑总览

#### M0：应用详情页左侧菜单（框架先行）

- 目标：先把“应用详情”的页面壳搭起来，形成固定的左侧导航与右侧内容区，为后续资源接入做承载。
- 交付：
  - `/system/apps/:id` 页面布局：左侧菜单 + 右侧内容。
  - 菜单项：概览、资源、权限（占位）、发布（占位）、设置（占位）。
  - 资源区先展示“资源列表占位”或空态（不阻塞上线）。

#### M1：支持新建普通表单（FORM）

- 目标：在“资源”中支持创建普通表单，并让表单在左侧菜单出现（可进入表单管理页面）。
- 交付：
  - 后端：表单资源的创建/列表/详情 API。
  - 前端：资源列表页 + “新建表单”弹窗；创建成功自动刷新菜单与列表。

#### M2：支持表单字段定义（Schema/Fields）

- 目标：为表单提供字段定义能力（字段增删改查、排序、基础校验），形成最小可用的表单设计器（非拖拽版）。
- 交付：
  - 后端：字段 CRUD API + 基础校验（字段 key 唯一、类型合法）。
  - 前端：字段管理页（字段表格 + 新增/编辑字段弹窗）。

#### M3：支持表单数据增删改查（Records CRUD）

- 目标：基于字段定义生成表单录入与数据列表页面，实现数据的新增/编辑/删除/分页查询。
- 交付：
  - 后端：表单数据 CRUD API + 运行时校验（必填、基础类型校验）。
  - 前端：数据列表页（表格列由字段定义生成）+ 新增/编辑数据表单（由字段定义生成）。

### 10.2 统一路由规划（管理端）

以“应用详情”作为容器页面，左侧菜单驱动右侧内容：

- 应用详情容器：`/system/apps/:appId`
- 概览：`/system/apps/:appId/overview`
- 资源列表：`/system/apps/:appId/resources`
- 表单（管理入口）：`/system/apps/:appId/forms/:formId`
  - 字段定义：`/system/apps/:appId/forms/:formId/fields`
  - 数据管理：`/system/apps/:appId/forms/:formId/data`

> 说明：当前项目已有 `/system/apps/:id` 路由占位。建议后续将其扩展为“容器路由”，并在容器内用嵌套路由承载上面的子路由，避免每次进入详情页都重建左侧菜单。

### 10.3 数据模型规划（Prisma，M1～M3）

#### 10.3.1 应用资源表（sys_app_resource）

用于把“表单/大屏/外链/自定义页面”等都统一成资源，以便左侧菜单与资源列表复用同一套能力。

建议字段（示意）：

- `id`（自增）
- `appId`（外键到 `sys_app`）
- `type`（字符串枚举：`FORM`/`DASHBOARD`/`CUSTOM_PAGE`/`EXTERNAL_LINK`…）
- `name`、`description`
- `status`（`"0"|"1"`）
- `sort_order`
- `config`（Json，存放不同类型配置）
- 软删：`deletedAt`
- 审计：`creatorId/updaterId/createdAt/updatedAt`

#### 10.3.2 应用菜单表（sys_app_menu）

为后续 SaaS 化（租户级应用、租户级菜单隔离/复制/发布）更清晰，建议将“应用内菜单”单独落库，与系统菜单（`sys_menu`）解耦。

建议字段（示意）：

- `id`
- `appId`（外键到 `sys_app`）
- `parentId`（自关联）
- `name`、`path`、`icon`、`component`
- `type`、`status`、`sort_order`
- `resourceId`（可选：指向 `sys_app_resource`，用于菜单直达资源）
- 软删：`deletedAt`
- 审计：`creatorId/updaterId/createdAt/updatedAt`

#### 10.3.3 表单字段定义（sys_form_field）

建议字段（示意）：

- `id`
- `resourceId`（外键到 `sys_app_resource`，且 `type=FORM`）
- `key`（字段英文 key，唯一约束：`(resourceId, key)`）
- `label`（中文名）
- `type`（枚举：`text`/`textarea`/`number`/`date`/`datetime`/`select`/`switch`/`user`…先支持少量）
- `required`（bool）
- `config`（Json，可选：默认值/选项/校验规则/展示等）
- `sort_order`
- `status`（`"0"|"1"`，可选）
- 审计字段

#### 10.3.4 表单数据表（sys_form_data）

M3 为尽快落地，建议先用 JSON 存储一行数据：

- `id`
- `resourceId`（外键到 `sys_app_resource`，且 `type=FORM`）
- `data`（Json：key-value）
- `status`（可选）
- 软删：`deletedAt`
- 审计字段

> 后续扩展：如需复杂查询/索引，可增加“投影列”或将高频字段拆到独立列，或引入 EAV/列式存储，但不建议在 M3 之前复杂化。

### 10.4 后端 API 规划（M0～M3）

本项目后端已有 Fastify + TypeBox + Prisma 的标准模式（schemas/models/services/routes）。下面按里程碑给出接口集合。

#### 10.4.1 M0（仅详情页框架）所需接口

复用现有应用接口即可：

- `GET /api/v1/admin/apps/:id`（应用详情）

#### 10.4.2 M1（新建普通表单）接口

资源层（建议先落地）：

- `GET /api/v1/admin/apps/:appId/resources?type=FORM`：查询表单资源列表（用于左侧菜单与资源页）
- `POST /api/v1/admin/apps/:appId/resources`：创建资源（`type=FORM`）
- `GET /api/v1/admin/apps/:appId/resources/:resourceId`：资源详情

表单层（便于表单场景直接调用）：

- `POST /api/v1/admin/apps/:appId/forms`：创建普通表单
  - 后端内部可做事务：创建 `sys_app_resource(type=FORM)` + 创建 `sys_form(resourceId=...)`
- `GET /api/v1/admin/apps/:appId/forms`：表单列表（可直接返回资源信息 + formId）
- `GET /api/v1/admin/apps/:appId/forms/:formId`：表单详情（含资源信息）

#### 10.4.3 M2（字段定义）接口

- `GET /api/v1/admin/apps/:appId/forms/:formId/fields`：字段列表
- `POST /api/v1/admin/apps/:appId/forms/:formId/fields`：新增字段
- `PATCH /api/v1/admin/apps/:appId/forms/:formId/fields/:fieldId`：更新字段
- `DELETE /api/v1/admin/apps/:appId/forms/:formId/fields/:fieldId`：删除字段
- `PUT /api/v1/admin/apps/:appId/forms/:formId/fields:sort`：字段排序（可选，批量更新 sort_order）

字段校验建议（M2 即可做）：

- `key` 只能包含字母数字下划线，且以字母开头（避免前端/查询问题）。
- `(formId, key)` 唯一。
- `type` 必须在受支持枚举内。

#### 10.4.4 M3（数据CRUD）接口

- `GET /api/v1/admin/apps/:appId/forms/:formId/records`：分页查询数据
  - 参数：`page/pageSize/keyword/sortBy/sortOrder`
- `POST /api/v1/admin/apps/:appId/forms/:formId/records`：新增数据
- `GET /api/v1/admin/apps/:appId/forms/:formId/records/:recordId`：数据详情（可选）
- `PATCH /api/v1/admin/apps/:appId/forms/:formId/records/:recordId`：更新数据
- `DELETE /api/v1/admin/apps/:appId/forms/:formId/records/:recordId`：删除数据

数据校验建议（M3 即可做）：

- 读取当前字段定义列表，对 `required` 字段做必填校验。
- 按字段类型做基础校验：
  - `text/textarea`: string
  - `number`: number
  - `date/datetime`: ISO 字符串（或时间戳，建议统一 ISO）
  - `select`: 值在 options 范围内（如 options 已定义）

### 10.5 后端实现落地指南（按项目结构）

建议按现有模块组织方式增加目录（示意）：

- `prisma/schema/system.prisma`：新增模型
- `src/models/sys-app-resource.model.ts`：资源模型（Prisma 封装）
- `src/models/sys-form.model.ts`、`sys-form-field.model.ts`、`sys-form-record.model.ts`
- `src/schemas/form.ts`：TypeBox schemas（表单/字段/数据）
- `src/services/form.service.ts`：表单领域逻辑（事务、校验）
- `src/routes/api/v1/admin/apps/resources/index.ts`：资源路由（可选）
- `src/routes/api/v1/admin/apps/forms/index.ts`：表单路由

事务边界建议：

- 创建表单：资源 + 表单元数据必须同事务。
- 删除表单：优先软删资源，表单/字段/数据可按策略级联软删（避免数据误删）。

### 10.6 前端实现落地指南（按里程碑）

#### 10.6.1 M0：左侧菜单（应用详情容器）

页面结构建议：

- 使用 `Layout`（或 ProLayout）实现：`Sider + Content`。
- `Sider` 菜单包含两类：
  - 固定项：概览、资源、权限、发布、设置
  - 动态项：资源列表（M1 后加入），按类型分组（表单/大屏/外链…）

数据流（M0）：

- 进入 `/system/apps/:appId`：
  - 请求应用详情
  - 菜单先渲染固定项

#### 10.6.2 M1：新建普通表单（资源）

交互建议：

- “资源”页提供 “新建” 按钮，点击后弹窗选择类型（先只开放普通表单，其它类型灰置）。
- 创建成功后：
  - 刷新资源列表
  - 左侧菜单出现新表单项
  - 自动跳转到 `/system/apps/:appId/forms/:formId/fields`（引导用户先定义字段）

#### 10.6.3 M2：字段定义 UI

字段管理页建议（简单可用）：

- 表格列：label、key、type、required、sort_order、状态、操作（编辑/删除）
- 新增/编辑字段弹窗：
  - label（必填）
  - key（必填、校验）
  - type（下拉）
  - required（开关）
  - options（当 type=select 时显示，简单用多行输入/标签输入）

#### 10.6.4 M3：数据 CRUD UI

数据列表页建议：

- 页面进入时请求：
  - 字段定义列表（生成列与录入表单）
  - 数据分页列表
- 列生成规则：
  - 按 sort_order 排序
  - 只展示启用字段
  - 对长文本字段做 ellipsis
- 新增/编辑：
  - 根据字段定义生成表单控件（先覆盖常见类型）
  - 提交前做基础校验（必填/类型）

### 10.7 权限与安全（MVP 约束）

M0～M3 建议先复用“后台管理鉴权”（JWT/管理员权限）：

- 应用级权限与资源级权限可以先不细分，先满足“管理员可用”的基本闭环。
- 为后续对齐服务端开放 API 的 `access_token` 模式预留连接器与代理层，但不在 M3 之前引入。

### 10.8 测试与验收清单（每个里程碑都可回归）

#### M0 验收

- 应用详情页可进入、左侧菜单正常切换、刷新不丢失当前菜单态。

#### M1 验收

- 可新建普通表单，创建后菜单与列表同时出现。
- 表单资源可删除（至少支持软删/禁用）。

#### M2 验收

- 字段可新增/编辑/删除，key 唯一校验生效。
- 字段排序生效（如支持排序）。

#### M3 验收

- 数据列表分页正常、可新增/编辑/删除。
- 必填与基础类型校验生效（后端必须校验，前端可做辅助校验）。
