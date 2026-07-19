# Yishan Plugin Contract

## 1. 适用范围

本文定义 baseline-v2 插件的强制开发契约。
它适用于仓库内置插件、官方插件和项目自有插件。
它定义 manifest、目录、身份、装载、生命周期、gate、DDL 和测试。
它不重复 Core 开发命令或完整发布流程。
系统目录与依赖总览见 `ARCHITECTURE.md`。
artifact 与部署行为见 `RELEASE_CONTRACT.md`。
任何偏离本文的插件都不能进入 plugin catalog。

## 2. 核心原则

- 一个插件是一个由不可变 id 标识的仓库级能力包。
- 一个插件只有一份 manifest。
- profile 决定插件是否进入一次构建。
- catalog 是构建后所有宿主发现插件的唯一索引。
- 数据库状态只能控制 catalog 内插件的运行时启停。
- 插件的所有入口必须受统一 PluginGate 管控。
- 插件只拥有自己的 API、页面、权限、菜单和数据。
- 插件不能直接依赖另一个插件。
- Core 不能直接依赖插件实现。
- disabled 不是“只隐藏菜单”，而是完整能力关闭。

## 3. 标准目录

插件根目录必须是：

```text
plugins/<vendor>/<slug>/
```

完整约定如下：

```text
plugins/<vendor>/<slug>/
├── plugin.ts
├── api/
│   ├── register.ts
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

`plugin.ts` 必须存在且是唯一 manifest。
`api/` 保存服务端入口和 Route → Service → Repository 实现。
`admin/` 保存后台页面和声明式路由。
`app/` 可选；未声明 App 能力时可以不存在。
`migrations/` 保存插件独占 DDL，并由 manifest 引用。
`seed/` 可选；存在时必须由 manifest 显式引用。
`tests/` 保存插件单元、集成、契约和三态测试。
插件不得在 API、Admin、App 或脚本目录再创建 manifest。
同一插件的前后端代码必须在此目录内共同演进。

## 4. 唯一 Manifest

manifest 由 `@yishan/plugin-sdk` 的 `definePlugin()` 定义。
默认导出必须是 `definePlugin()` 的返回值。
基本形态如下：

```ts
import { definePlugin } from '@yishan/plugin-sdk'

export default definePlugin({
  id: 'vendor/feature',
  version: '1.0.0',
  coreVersion: '^2.0.0',
  kind: 'production',
  api: {
    prefix: '/api/plugins/vendor/feature/v1',
    register: () => import('./api/register'),
  },
  database: {
    namespace: 'vendor_feature',
  },
  permissions: [],
  menus: [],
  admin: {
    routes: () => import('./admin/routes'),
  },
  app: undefined,
  migrations: './migrations',
  seed: './seed',
})
```

必需字段是：

- `id`
- `version`
- `coreVersion`
- `kind`
- `api`
- `database`
- `permissions`
- `menus`
- `admin`
- `migrations`

可选字段是：

- `app`
- `seed`

`definePlugin()` 提供 TypeScript 层的字段约束。
profile validator 提供构建期的语义与文件系统约束。
类型通过不代表 manifest 一定可进入 catalog。

## 5. `id` 契约

插件 id 的正则是：

```text
^[\w-]+/[\w-]+$
```

id 必须正好包含一个 `/`。
左侧是 vendor。
右侧是 slug。
vendor 与 slug 都不能是空字符串。
id 在仓库和单次 catalog 中必须唯一。
id 在插件首次发布后不可修改。
显示名称、菜单标题或品牌变化不能成为修改 id 的理由。
迁移插件所有权时也不能悄悄复用旧 id 指向新能力。

## 6. `id` 与其他标识的绑定

id 是以下标识的规范来源：

- 目录 `plugins/<vendor>/<slug>/`
- workspace 中的插件包身份
- API prefix 中的 `<vendor>/<slug>`
- 数据库 namespace 的所有权
- migration scope
- permission 与 menu 的 `pluginId`
- Admin route 的 `pluginId`
- App 能力声明的 `pluginId`
- plugin catalog 的索引 key
- release manifest 的插件记录 key

目录 vendor 和 slug 必须逐字匹配 id。
API prefix 必须逐字匹配 id。
package 身份必须由 SDK 的统一编码规则从 id 派生。
插件作者不能另设与 id 无关的 package alias。
`database.namespace` 必须唯一且稳定绑定该 id。
namespace 的具体编码由 SDK validator 统一校验。
插件作者不能用同一 namespace 服务多个 id。
manifest、catalog 和 migration plan 中的 id 必须完全一致。
大小写、下划线和连字符差异不能视为同一个别名。

## 7. `version` 与 `coreVersion`

`version` 必须是有效 semver 版本。
插件内容发生发布意义变更时必须更新 `version`。
`coreVersion` 必须是有效 semver range。
`coreVersion` 描述该插件可运行的 Core 版本范围。
profile validation 必须读取当前 Core 版本并验证满足关系。
不兼容时 `profile:validate` 必须失败。
不兼容时 catalog generation 必须失败。
不兼容时 release build 必须失败。
构建不能仅发出 warning 后继续。
运行时不能带着已知不兼容插件启动。
字符串相等不能替代 semver range 判定。
预发布版本是否匹配遵循统一 semver 库，不由插件自行解释。

## 8. `kind` 语义

`kind` 只允许：

```ts
type PluginKind = 'sample' | 'production'
```

`sample` 表示 SDK 示例、smoke fixture 或教学插件。
`production` 表示可进入业务发行组合的插件。
kind 不表示插件当前是否 enabled。
kind 不表示代码质量等级。
kind 不改变 PluginGate 行为。
kind 必须写入 plugin catalog。
kind 必须写入 release manifest 的插件记录。
profile validator 必须校验 profile 声明与 manifest kind 一致。
hello 永远声明 `kind: 'sample'`。
任何 profile 都不能把 hello 重标记为 `production`。
生产组合是否接纳 sample 是 profile 与 release policy 的显式选择。
复制 sample 创建新插件时必须分配新 id 并显式选择 kind。

## 9. `api` 契约

`api` 描述服务端路由边界和注册入口。
`api.prefix` 必须是：

```text
/api/plugins/<vendor>/<slug>/v1
```

prefix 中的 vendor 与 slug 必须与 id 一致。
prefix 必须以 `/api/plugins/` 开始。
prefix 必须包含显式 API major version。
当前契约的初始 major segment 是 `/v1`。
插件 route 必须挂载在该 prefix 之下。
插件不能注册 prefix 之外的旁路 endpoint。
插件不能占用 Core API path。
两个插件不能声明相同 prefix。
prefix 冲突必须在 catalog generation 时失败。

`api.register` 指向插件 API 注册模块。
注册模块必须暴露：

```ts
export async function register(app: FastifyInstance): Promise<void>
```

SDK 装载后的插件对象必须可由 Core 调用 `plugin.register(app)`。
`register(app)` 只注册该插件的路由与受控入口。
`register(app)` 不负责决定插件是否被 profile 选择。
`register(app)` 不绕过 Core 安装的 preHandler。
`register(app)` 不读取其他插件目录。
`register(app)` 应保持确定性，不能按目录临时发现额外 route。

## 10. API 分层要求

插件 API 的依赖方向固定为：

```text
api/routes → api/services → api/repositories
```

Route 负责 TypeBox schema、认证、权限、DTO 和 HTTP 响应，不能访问数据库或直接调用 Repository。
Service 负责业务编排与事务边界，并通过公开 extension point 使用 Core 能力。
Repository 是唯一数据库实现层，只访问本插件拥有的数据。
反向依赖、跳层依赖和跨插件查询必须被架构检查拒绝。

## 11. `database` 与 DDL 所有权

`database.namespace` 标识插件的数据所有权边界。
插件表、索引、约束、migration 和 seed 都必须属于该 namespace。
Core 不读取插件表。
插件不读取其他插件表。
插件不直接修改 Core DDL。
跨边界数据交互必须通过公开服务接口或事件协议。
不能以共享表为由让两个插件共用 namespace。
不能把插件 DDL 放入 Core migration 目录。

插件 migration 唯一路径是：

```text
plugins/<vendor>/<slug>/migrations/
```

`migrations` 字段必须指向该目录。
路径必须保持在插件根目录内。
路径逃逸或符号链接越界必须被 validator 拒绝。
每个 migration 必须有稳定版本和 checksum。
已应用 migration 的内容不能就地改写。
修正已发布 DDL 必须增加新的 migration。

## 12. Migration plan

migration plan 由 profile 与 catalog 生成。
它不是插件手写的全局 SQL 清单。
应用顺序固定为：

1. Core migrations。
2. profile 中第一个插件的 migrations。
3. profile 中后续插件的 migrations。
4. 每个插件内部按版本稳定排序。

migration runner 必须串行应用 plan。
runner 不能根据文件系统发现 catalog 外 migration。
plan 中每项记录 scope、version、checksum 和来源。
插件项的 scope 必须是该插件 id。
checksum 漂移必须在 dry-run 阶段失败。
插件 disabled 不自动撤销已应用 DDL。
插件不在新 catalog 时也不能由应用部署自动删除其表。
DDL rollback 由 release migration policy 处理，不由 PluginGate 处理。

## 14. Permissions 契约

`permissions` 是结构化权限声明数组。
每个 permission 必须携带 plugin id 所有权。
permission code 在 catalog 中必须唯一。
permission code 不能假冒 Core namespace。
Route 使用的 permission 必须在同一 manifest 声明。
Menu 引用的 permission 必须在同一 manifest 声明。
Admin access 引用的 permission 必须可解析。
未知 permission 必须使生成或校验失败。
运行时权限目录只枚举 selected 且 enabled 的插件权限。
disabled 插件的权限不能继续出现在可分配目录中。
权限从 catalog 移除不等于自动删除历史授权记录。
历史数据清理由明确 migration 或管理流程处理。

## 15. Menus 契约

`menus` 是声明式菜单数组。
每个 menu item 必须携带 `pluginId`。
每个受保护 menu item 必须引用有效 permission code。
Admin menu path 必须能解析到该插件的 Admin route。
App menu 或 Tab 必须能解析到该插件的 App 声明。
路径冲突必须在生成期失败。
菜单排序必须来自声明，不得依赖文件扫描顺序。
服务端根据 catalog、enabled state 与权限返回菜单。
Admin 不通过本地硬编码补充插件菜单。
disabled 插件不返回任何菜单项。
仅隐藏菜单不能满足 disabled 契约。

## 16. Admin 契约

`admin.routes` 必须指向 `./admin/routes`。
`admin/routes.ts` 声明该插件的 Umi route。
route 必须标注所属 plugin id。
route path 必须在当前 profile 中唯一。
route component 必须位于插件 `admin/pages/` 内或公共组件入口。
component 文件不存在时生成失败。
页面没有 access strategy 时生成失败。
menu path 没有匹配页面时生成失败。
Umi routes 只能由 plugin catalog 与 `admin/routes.ts` 共同生成。
插件不能直接修改全局生成 route 绕过 catalog。
disabled 插件不提供正常前端入口。
直接访问 disabled 插件 URL 时不能渲染其业务页面。
宿主可以返回统一“功能未启用”结果，但不能残留可操作页面。

## 17. App 契约

`app` 是可选字段。
未声明 `app` 时不得生成 App 页面、Tab 或 client 入口。
声明 `app` 时相关文件位于插件 `app/`。
App route 与能力声明必须携带 plugin id。
App 接口类型来自当前 profile 的 OpenAPI 或共享生成类型。
App 不复制 Admin client 类型。
disabled 插件不提供 App 菜单、Tab、任务或可进入页面。
App 入口同样必须由 catalog 与 enabled state 控制。

## 18. 生命周期状态

运行时状态词汇只允许：

```text
installed → enabled → disabled → failed
```

`installed` 表示插件已存在于 release catalog，安装记录已建立。
`installed` 不等于业务入口已开放。
`enabled` 表示插件通过启动检查并可注册运行能力。
`disabled` 表示插件仍被安装，但所有能力被关闭。
`failed` 表示安装、启动或运行准备失败并有诊断记录。
“catalog 外”不是生命周期状态。
数据库中存在未知插件 id 也不能把它变成 installed。
初次安装从 `installed` 开始。
正常启用从 `installed` 或 `disabled` 进入 `enabled`。
主动停用从 `enabled` 进入 `disabled`。
启动或关键准备失败进入 `failed`。
状态变化必须更新 PluginGate 使用的统一状态源。
不能让菜单状态、API 状态和任务状态各自漂移。

## 19. PluginGate

Core 统一提供 `pluginGate(pluginId)`。
Core 在插件 route tree 注册前安装 Fastify `preHandler`。
插件 route 不自行复制一套状态判断。
preHandler 对整个插件路由树生效。
状态不是 `enabled` 时，请求不能进入插件 Route。
disabled 请求返回 404 与稳定的 `PLUGIN_DISABLED` 语义。
failed 请求不能降级为仍可访问的业务 API。
PluginGate 的状态读取可以缓存，但必须支持状态变更失效。
缓存必须以 Core 运行状态源为准。
插件不能装饰或移除 Core 提供的 gate。

PluginGate 还必须覆盖：

- HTTP routes
- cron registration
- worker startup
- job dispatch 与 job execution
- event subscription
- event consumption
- webhook handling
- Admin 后台任务入口
- App 后台能力入口
- 菜单与权限目录枚举
- 前端入口可用性判断

任何新增入口类型都必须先接入 PluginGate 再对外开放。

## 20. 启停语义

插件 `enabled` 时：

- Core 调用其 `register(app)`。
- API route 可在认证与权限检查后处理请求。
- 已声明任务和订阅可以启动。
- 权限进入可分配目录。
- 菜单按权限进入服务端响应。
- Admin 与 App 入口可以生成并访问。
- profile OpenAPI 包含其规范路径。

插件 `disabled` 时：

- API 请求不能进入插件业务 handler。
- 定时任务不能注册或继续调度。
- worker 和异步消费者不能启动。
- event subscriber 不能消费事件。
- 菜单不返回。
- 权限不进入可分配目录。
- Admin 业务页面不能正常进入。
- App 页面、Tab 和后台能力不能正常进入。
- 不能仅依靠 CSS、菜单隐藏或客户端判断实现停用。

插件 `failed` 时：

- 所有对外能力保持关闭。
- Core 记录可定位的失败诊断。
- 健康检查反映插件启动失败。
- 不允许部分 route 可用、部分任务失败的静默降级。

## 21. OpenAPI 契约

插件所有 path 必须落在：

```text
/api/plugins/<vendor>/<slug>/v1/...
```

`...` 可以继续包含面向端、资源和动作路径。
插件不能使用 Core path 或其他插件 prefix。
每个 operation 的 tag 与 schema 必须能追溯到 plugin id。
OpenAPI exporter 只遍历当前 profile catalog。
catalog 外插件的 path、tag 和 schema 必须完全不存在。
同一路径与 HTTP method 冲突必须使生成失败。
插件 Route schema 是 OpenAPI 的实现来源，不能维护平行手写 spec。
每个 profile 生成独立 spec。
Admin client 只从当前 profile spec 生成。
插件删除或改变公开 path 时必须按版本策略处理。

## 22. 架构约束

Core 可以 import plugin SDK 类型和公共 extension point。
Core 不能 import 任意 `plugins/<vendor>/<slug>` 实现。
Core 不能 import 插件 manifest 来硬编码注册。
插件可以 import plugin SDK。
插件可以 import Core 明确公开的 extension point。
插件不能 import Core 的私有 Route、Service 或 Repository。
插件不能跨插件 import 源码、类型、migration、页面或测试 helper。
动态 import、type-only import 和 alias import 同样受约束。
通过生成文件间接夹带跨插件实现也属于违规。
测试代码默认遵守相同边界。
仅专用架构测试可以读取多个插件 metadata 做断言。

## 24. 必需的三态测试

每个插件都必须覆盖三种状态。
三态不能用单一 happy-path smoke test 替代。

### 24.1 Profile 内且 enabled

- catalog 包含插件 id、version、kind 和 checksum。
- Core 调用 `register(app)`。
- 规范 API path 可访问。
- Route、Service、Repository 分层测试通过。
- 任务和订阅按声明启动。
- 权限和菜单一致出现。
- Admin 路由与页面一致出现。
- 声明 App 时 App 入口一致出现。
- profile OpenAPI 含该插件 path、tag 和 schema。
- migration plan 含该插件 migration scope。

### 24.2 Profile 内但 disabled

- catalog 仍能证明插件存在于 release。
- API 返回 disabled 语义且 handler 未执行。
- 所有 route 都被同一 preHandler 覆盖。
- cron、worker、job 和 subscriber 不执行。
- 权限目录不暴露插件权限。
- 服务端菜单不暴露插件菜单。
- Admin 直接访问不能进入业务页面。
- App 直接访问不能进入业务页面。
- 不通过重建 artifact 才能完成状态切换。

### 24.3 Catalog 外不存在

- API bundle 不注册插件 route。
- server boot 不调用该插件 register。
- route table 不含插件 prefix。
- OpenAPI 不含插件 path、tag 或 schema。
- Admin route 与 client 不含插件入口。
- App 不含插件入口。
- 菜单和权限目录不含插件声明。
- migration plan 和 seed plan 不含插件 scope。
- 数据库中的同名状态记录不能改变上述结果。

<!-- baseline-v2 ADR ref: ADR-002, ADR-003, ADR-005, ADR-006 -->
