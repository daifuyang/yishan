# Yishan Architecture

## 1. 文档定位

本文描述 baseline-v2 生效后的当前架构事实。
它面向首次进入仓库的开发者、AI agent 和架构评审者。
它定义目录职责、依赖方向、生成链路和运行边界。
它不记录重构历史，也不充当部署环境配置手册。
插件字段与运行契约详见 `PLUGIN_CONTRACT.md`。
发布产物与部署契约详见 `RELEASE_CONTRACT.md`。
从旧基座升级时只使用 `MIGRATION_GUIDE.md`。
根 `package.json#scripts` 是可执行命令名称的事实来源。
`specs/archive/**` 仅保存历史资料，不定义当前架构。

## 2. 系统总览

Yishan 是一个以 Core 为基座、以 profile 选择插件的 monorepo。
Core 提供身份、授权、插件平台、配置、存储抽象和公共运行能力。
业务能力必须位于仓库级插件包中。
API 使用 Fastify、TypeBox、Drizzle 和 MySQL。
Admin 使用 Umi、React 与 Ant Design Pro。
App 使用 Taro，并独立支持小程序和 H5 目标。
Docs 使用 Docusaurus。
共享编辑器组件作为 workspace package 被 Admin 消费。
构建期决定一个 release 包含哪些插件和目标端。
运行期只能启停已经被构建进 catalog 的插件。
目录存在本身不代表插件会被加载。
数据库状态不能让 catalog 外的插件出现在运行时。

## 3. 不可破坏的架构不变量

- profile 是插件选择与目标端选择的唯一输入。
- 一个插件只有一份 `plugin.ts` manifest。
- Core 不依赖任何插件实现。
- 插件不依赖其他插件实现。
- API 业务调用遵守 Route → Service → Repository。
- Repository 是访问数据库实现的唯一业务层。
- 所有插件入口都受统一 PluginGate 约束。
- Admin 路由由 catalog 与插件路由声明共同生成。
- OpenAPI、Admin client、迁移计划均按 profile 生成。
- 部署只消费已经验证的 release artifact。
- migration plan 与应用部署是两个独立操作。
- 环境配置必须在部署边界显式注入。
- Core DDL 与插件 DDL 分目录维护。
- 生成物不得通过手工编辑改变架构事实。

## 4. 发行线

仓库维护 `main` 与 `all` 两条发行线。
`main` 是 Core 发行线。
`main` 的源码组成是 Core 加 hello SDK 示例。
hello 的 manifest 永远声明 `kind: 'sample'`。
`all` 是官方集成发行线。
`all` 的源码组成是 Core、hello 示例以及 portal、shop 集成能力。
这里的“源码组成”不等同于任何插件自动进入产物。
每条发行线仍由所选 profile 决定实际 catalog 和 artifact。
`main` 默认选择 `core` profile。
`all` 默认选择 `official` profile。
两条发行线共享插件 SDK、catalog、verify 和 release 机制。
两条发行线不要求存在 Git ancestry 包含关系。
跨线同步通过显式来源提交与冲突结论记录完成。
发布正确性由 profile 验证、测试和 artifact 校验证明。
分支名称不能替代显式的 `--profile` 输入。

## 5. Profile 系统

profile 文件位于 `profiles/`。
基座提供两个标准入口：

```text
profiles/
├── core.yaml
└── official.yaml
```

`profiles/core.yaml` 描述 Core 发行线的构建组合。
`profiles/official.yaml` 描述官方集成发行线的构建组合。
项目可以增加 `profiles/<name>.yaml` 表达自己的组合。
profile 名必须与文件名以及命令参数一致。
profile 明确列出插件、sample 插件和 release targets。
插件排列顺序参与 migration plan 的稳定排序。
profile 解析必须在任何代码生成或编译前完成。
解析器必须验证 schema、插件 id、kind 与引用存在性。
解析器必须验证 API prefix、权限、菜单和路由冲突。
解析器必须验证插件的 `coreVersion` 兼容范围。
验证失败时构建立即退出，不能跳过不兼容插件继续构建。
验证成功后生成不可手改的 plugin catalog。
下游步骤只能消费解析结果，不能重新扫描目录自行选插件。
同一 profile 驱动 API、Admin、App、OpenAPI、迁移、seed 和 release 元数据。
开发构建、CI 构建和发布构建必须得到等价的 catalog。

## 6. 根目录结构

```text
.
├── apps/
│   ├── yishan-api/
│   ├── yishan-admin/
│   ├── yishan-app/
│   ├── yishan-docs/
│   └── yishan-components/
├── packages/
│   └── plugin-sdk/
├── plugins/
│   └── <vendor>/<slug>/
├── profiles/
├── deploy/
│   └── providers/<provider>/
├── artifacts/
├── scripts/
├── docs/
├── specs/archive/
└── package.json
```

`apps/` 保存可独立构建的交付端。
`packages/` 保存被多个 workspace 消费的基础包。
`plugins/` 保存所有非 Core 能力的仓库级插件。
`profiles/` 保存构建和发布组合声明。
`deploy/` 保存 provider adapter，不保存业务源码。
`artifacts/` 保存按 profile 生成的中间或发布产物。
`scripts/` 保存跨 workspace 的生成、验证和架构检查。
`docs/` 保存面向使用者的长文档。
`specs/archive/` 不参与代码生成、构建或 AI 架构判断。

## 7. API 应用边界

`apps/yishan-api/` 是 Core API 宿主。
其关键布局如下：

```text
apps/yishan-api/
├── drizzle/
│   └── core/
├── src/
│   ├── core/
│   │   ├── routes/
│   │   ├── services/
│   │   └── repositories/
│   ├── db/
│   ├── infrastructure/
│   ├── config/
│   └── server.ts
└── test/
```

`src/core/` 只包含基座能力。
`src/core/routes/` 定义 Core HTTP 边界。
`src/core/services/` 编排 Core 用例和事务。
`src/core/repositories/` 封装 Core 持久化。
`src/db/` 提供 Drizzle client、生成 schema 与 migration runner 接入。
`src/infrastructure/` 实现对外部系统的基础适配。
`src/config/` 解析运行配置，但不决定插件集合。
`server.ts` 负责 Core boot 与 catalog 驱动的插件注册。
Core route 可以由宿主自动装载。
插件 route 不能通过目录扫描自动装载。
API 宿主只认识插件 SDK 暴露的类型和 extension point。

## 8. API 分层

Core 与每个插件内部都采用同一调用方向：

```text
Route → Service → Repository → Drizzle / SQL
```

Route 负责请求 schema。
Route 负责认证与权限声明。
Route 负责 DTO 映射和 HTTP 状态。
Route 不包含事务编排。
Route 不直接读取表定义或执行 SQL。
Service 负责业务规则和用例编排。
Service 负责事务边界。
Service 可以调用本边界内的 Repository。
Service 不生成 HTTP 响应对象。
Repository 负责查询、写入和持久化映射。
Repository 是业务层中唯一可访问 Drizzle 表定义和 SQL 的位置。
Repository 不处理 HTTP 身份或页面菜单。
依赖不能从 Repository 反向指向 Service 或 Route。
插件的三层只能处理该插件拥有的数据和能力。
Core 对插件开放能力时必须提供稳定 extension point。
插件通过 extension point 使用 Core，不能导入 Core 内部实现细节。

## 9. 插件包形态

每个插件位于 `plugins/<vendor>/<slug>/`。
`<vendor>/<slug>` 与插件不可变 id 一致。
标准目录如下：

```text
plugins/<vendor>/<slug>/
├── plugin.ts
├── api/
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   └── schemas/
├── admin/
│   ├── pages/
│   └── routes.ts
├── app/
├── migrations/
├── seed/
└── tests/
```

`plugin.ts` 是唯一 manifest。
`api/` 保存该插件的服务端实现。
`admin/` 保存该插件的后台页面和路由声明。
`app/` 是可选目标端入口；不存在时不生成 App 能力。
`migrations/` 保存该插件拥有的 DDL。
`seed/` 是可选的、与插件命名空间一致的数据初始化入口。
`tests/` 保存插件契约、集成和三态测试。
详细字段、状态机和验证规则由 `PLUGIN_CONTRACT.md` 定义。

## 10. 依赖方向

允许的顶层依赖方向是：

```text
apps → packages/plugin-sdk
plugins → packages/plugin-sdk
plugins → Core public extension points
Core → packages/plugin-sdk types
```

禁止的方向是：

```text
Core → plugin implementation
plugin A → plugin B implementation
Repository → Service
Service → Route
shared package → app-specific page
provider adapter → source-tree build internals
```

Core 不能导入插件 manifest、页面、route、migration 或 seed。
插件不能通过相对路径进入另一个插件目录。
插件不能借助 workspace alias 绕过跨插件限制。
若两个插件需要协作，双方依赖 Core 定义的接口或外部协议。
架构检查必须同时检查相对导入、alias 导入和动态导入。
类型导入同样受边界限制，除非类型位于公共 SDK 或 extension point。

## 11. Catalog 与启动流程

构建流程先读取选定 profile。
profile validator 解析被选择的 manifest。
validator 输出确定性的 plugin catalog。
catalog 至少包含 id、version、kind、入口和 checksum。
API 编译只打包 catalog 中的服务端插件代码。
Admin 生成器只处理 catalog 中的后台入口。
App 生成器只处理 catalog 中且声明 `app` 的入口。
OpenAPI exporter 只遍历 catalog 中的 API 定义。
migration planner 只遍历 catalog 中的 migration 声明。
seed planner 只遍历 catalog 中的 seed 声明。
release builder 把同一 catalog 写入 artifact。

API boot 顺序是：

1. 加载 Core 配置与基础设施。
2. 初始化数据库连接和 Core extension points。
3. 加载构建时生成的 plugin catalog。
4. 校验 catalog 与 release metadata 一致。
5. 读取 catalog 内插件的运行状态。
6. 为每个插件入口安装 Core 拥有的统一 PluginGate（`registerPlugin`）。
7. 按 catalog 调用插件 `api.register()`，并在 gate 内把其 default export 挂载到 `api.prefix` 之下。
8. 仅为 enabled 插件启动任务、订阅和异步消费者。
9. 完成健康检查后接受流量。

boot 不能扫描整个 `plugins/` 决定加载集合。
boot 不能因数据库中出现未知 id 而动态导入代码。
插件启动失败必须记录为 `failed`，不能部分开放入口。

## 12. Admin 架构

`apps/yishan-admin/` 是后台宿主。
Core 页面与 Core route 声明属于 Admin 自身。
插件页面随插件包放在 `plugins/<vendor>/<slug>/admin/`。
每个插件通过 `admin/routes.ts` 声明后台路由。
Umi route 由两类输入合并生成：

```text
plugin catalog + admin/routes.ts → generated Umi routes
```

生成器只读取当前 profile 的 catalog。
生成器必须验证 route path 唯一。
生成器必须验证组件文件存在。
生成器必须验证页面声明的 plugin id 与目录一致。
生成器必须验证菜单 path 有可挂载页面。
生成器必须验证受保护页面存在明确 access strategy。
冲突必须使生成失败，不能静默覆盖或去重。
菜单数据以服务端返回为准。
菜单项必须携带 `pluginId` 和 permission codes。
disabled 插件不提供可进入的菜单和页面入口。
Admin 不得把目录存在当作插件可用信号。

## 13. App 与 Docs

`apps/yishan-app/` 是独立交付端，不是 Admin 构建副产物。
插件只有声明 `app` 并被 profile 选中时才生成 App 入口。
App 页面、Tab、能力声明和接口封装属于插件自己的 `app/`。
未提供 `app/` 的插件不能留下空入口或占位路由。
App API 类型消费当前 profile 的 OpenAPI 生成类型。
App 不手工复制 Admin client 的类型定义。
profile 的 targets 决定是否构建小程序、H5 或其他已声明端。

`apps/yishan-docs/` 负责面向使用者的文档站点。
Docs 不承担运行时插件发现。
根规范定义稳定契约，长篇使用说明进入 Docs。
历史 spec 不得进入 Docs 导航或生成链路。

## 14. OpenAPI 与客户端

每个 profile 生成独立 OpenAPI spec。
标准中间产物路径为：

```text
artifacts/openapi/<profile>.json
```

release artifact 在自己的根目录携带 `openapi.json`。
Core profile 的 spec 只能含 Core 与该 profile 选择的插件。
未进入 catalog 的插件不能贡献 path、tag 或 schema。
插件 API path 必须遵守插件契约中的统一前缀。
同一 profile 的 Admin client 从该 profile spec 生成。
Admin 构建只解析当前 profile 的 client alias。
其他 profile 的 client 不得污染当前源码导入树。
OpenAPI 生成器不能通过运行目录猜测插件集合。
OpenAPI checksum 写入 release manifest。
生成结果漂移必须由检查阻断，不能手工修补 spec。

## 15. 数据库与迁移

Yishan 使用 Drizzle 管理 schema 与查询。
Core DDL 位于：

```text
apps/yishan-api/drizzle/core/
```

插件 DDL 位于：

```text
plugins/<vendor>/<slug>/migrations/
```

Core migration 只能创建或修改 Core 拥有的对象。
插件 migration 只能创建或修改自己的数据库命名空间。
Core Repository 不能查询插件表。
插件 Repository 不能查询其他插件表。
插件不能修改 Core DDL 来完成安装。
迁移计划由 profile 和 catalog 生成。
稳定排序为 Core migration、profile 插件顺序、插件内版本顺序。
迁移记录包含 scope、version、checksum 和 appliedAt。
scope 是 `core` 或不可变 plugin id。
checksum 漂移必须在 dry-run 或验证阶段失败。
文件名不能承担跨插件的全局排序职责。
seed 使用与 migration 相同的插件所有权边界。

## 16. 生成物边界

构建期间可以产生 catalog、route、schema、client 和 plan。
所有生成物必须能从 profile、manifest 和源码重建。
生成物不是手工扩展点。
生成目录不能作为遗漏源声明的补丁位置。
同一构建中的所有生成器必须消费同一个 catalog checksum。
如果 catalog 在中途变化，构建必须失败并重新开始。
CI 必须检查受版本控制的生成快照是否漂移。
release 中的生成物由 `release-manifest.json` 关联 checksum。
本地残留的 `dist/`、缓存或旧 client 不能影响结果。

## 17. Release artifact

发布先生成 provider-neutral artifact，再选择 provider 部署。
标准根路径是：

```text
artifacts/release/<profile>/<version>/
```

artifact 包含编译后的 API、Admin 静态资源和 profile metadata。
声明了 App target 时可以包含相应 App 产物。
artifact 固定携带 OpenAPI、plugin catalog、migration plan、SBOM 和 release manifest。
artifact 内容在验证后视为不可变。
部署不能从源码树补文件到 artifact。
部署不能重新生成路由、client、spec 或 migration plan。
详细目录和完整性规则由 `RELEASE_CONTRACT.md` 定义。

## 18. Provider adapter

provider adapter 位于：

```text
deploy/providers/<provider>/
```

adapter 是发布产物与目标平台之间的薄适配层。
adapter 只接收 artifact 路径和显式环境文件。
adapter 不负责安装源码依赖或执行产品构建。
adapter 不决定 profile。
adapter 不改写 migration plan。
adapter 不保存账户、地域、资源标识或凭据默认值。
adapter 在缺少必需环境输入时必须 fail-fast。
新增 provider 不得改变 Core 或插件代码边界。

## 19. Migration 与 Deploy 分离

migration plan 是 release artifact 的一部分。
迁移执行与应用部署是两个不同阶段。
标准顺序是 dry-run、apply、health-check、deploy。
dry-run 验证数据库版本、checksum、插件集合和目标 artifact。
apply 串行执行计划，不按目录临时扫描。
health-check 证明迁移后的数据库满足目标应用前置条件。
deploy 仅在前序步骤成功后发布应用 artifact。
代码 rollback 不自动执行 DDL rollback。
发布操作者必须依据每项 migration 的策略处理数据库恢复。

## 20. 请求与能力流

Core HTTP 请求流：

```text
request → Core Route → Core Service → Core Repository → database
```

插件 HTTP 请求流：

```text
request → PluginGate → plugin Route → plugin Service → plugin Repository → database
```

后台页面发现流：

```text
profile → catalog → generated routes → access check → page
```

菜单发现流：

```text
catalog + enabled state + permissions → server menu → Admin
```

发布流：

```text
profile → catalog → build → validate → migrate → health-check → deploy
```

这些流不能被独立目录扫描、隐藏菜单或部署时重建绕过。

## 21. 变更归属判断

修改身份、授权、插件平台或公共配置属于 Core 变更。
修改单一业务能力属于插件变更。
新增可复用插件字段属于 plugin SDK 变更。
新增目标平台部署逻辑属于 provider adapter 变更。
新增插件组合属于 profile 变更。
新增数据库对象必须先确定 Core 或单一插件所有者。
无法确定所有者时不能先把代码放进 Core 再补边界。
跨插件共享需求优先抽象为 Core extension point 或稳定协议。

## 22. 架构评审清单

- 变更是否由正确的 Core、插件或 adapter 所有？
- 是否出现 Core 到插件实现的依赖？
- 是否出现插件之间的直接依赖？
- Route 是否绕过 Service 或直接访问数据库？
- Repository 是否越过自己的数据所有权？
- 插件是否仍只有一个 manifest？
- catalog 是否仍由 profile 唯一生成？
- 所有插件入口是否经过 PluginGate？
- disabled 状态是否同时影响 API、任务、菜单、权限和页面？
- Admin route 是否从 catalog 与 `admin/routes.ts` 生成？
- OpenAPI 与 client 是否属于同一 profile？
- migration 是否位于正确所有者目录？
- migration plan 是否与 artifact 绑定 checksum？
- provider adapter 是否只消费 artifact 与显式环境？
- 构建是否能在无本地缓存和无手工配置时重现？

## 23. 事实优先级

发生描述冲突时按以下顺序判断：

1. 根目录契约文档定义架构边界。
2. `profiles/*.yaml` 定义具体构建组合。
3. `plugin.ts` 定义单个插件能力。
4. `package.json#scripts` 定义可执行命令名称。
5. 生成的 catalog 和 release manifest 证明一次构建的实际内容。
6. 归档 spec 和旧发布记录不定义当前行为。

任何实现如果偏离上述契约，应修改实现或先更新对应 ADR。
不得通过在业务代码中增加例外来绕过根契约。

<!-- baseline-v2 ADR ref: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-007 -->
