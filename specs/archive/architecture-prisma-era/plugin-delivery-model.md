# 插件交付与剥离模型

## 决策

Yishan 采用**发布期插件化**，而非生产环境代码热插拔。

- `main`：可独立构建、验证和运行的 Core 基线，不包含具体业务插件。
- `all`：包含全部官方业务插件的完整发行分支，也是唯一触发 CD 的分支。
- `feature/*`：短期开发分支；插件功能完成后进入 `all`，核心能力先进入 `main` 再同步到 `all`。

`main` 与 `all` 是有意不同的发行物，禁止将 `all` 整体反向合并回 `main`。

## 分支同步契约

`main` 是 Core 主干，不是“只放插件的分支”：它可以拥有插件 runtime、manifest 契约、迁移/构建组合器与控制面，但不得包含任何具体业务插件实现或其生成业务 schema。`all` 是官方插件集合的发行组装分支，不是第二个主干。

| 变更类型 | 首个目标分支 | 后续动作 |
| --- | --- | --- |
| Core 与插件平台契约 | `main` | 单向合并 `main → all` |
| 业务插件代码、DDL、菜单、seed、插件 E2E | `all` | 不反向合并到 `main` |
| 影响插件契约的变更 | `main` | 同步到 `all` 后，插件才可采用新契约 |

在发布或合入 `all` 前，`all` 必须包含最新 `main` 提交；CI 通过祖先关系检查该条件。两个发行物都必须独立验证：`main` 验证无业务插件的 Core，`all` 验证完整官方插件集合。不得创建额外的长期“plugins”分支；它只会增加同步链和漂移风险。

## 运行时边界

API 启动时会扫描部署包内的插件 manifest，并依据数据库中的状态启用或禁用已交付的插件；运行时可同步菜单和权限目录。

以下操作不是运行时能力，必须经过构建和部署：

- 新增、删除或升级插件代码；
- 加载任意 TypeScript/JavaScript；
- 执行插件 DDL migration；
- 增减 Admin 插件页面、生成路由或前端资源。

原因是 Node/TypeScript 的模块与依赖必须经过编译，且在线变更会引入多实例版本不一致、模块缓存、迁移回滚、审计和安全风险。生产变更必须走“代码审查 → 构建 → 测试 → 部署 → 重启/滚动发布”的流程。

## 插件单元

每个业务插件必须拥有并维护以下资产：

```text
manifest
API implementation and routes
Admin implementation and generated-route input
migrations and generated schema input
permissions and menus
seed data
unit / integration / E2E tests
compatibility declaration
```

插件 manifest 必须声明不可变的 `dbNamespace`（例如 `ys_portal`）。表名必须以 `<dbNamespace>_` 开头，索引和唯一约束也必须带该命名空间前缀。Core 迁移仅位于 `apps/yishan-api/drizzle/`；插件迁移位于 `apps/yishan-api/src/plugins/modules/<plugin>/migrations/`。迁移记录使用 `core/<file>` 或 `plugin/<plugin>/<file>` 逻辑 ID，避免跨插件同名冲突。

Core 只拥有插件 runtime、稳定的公开契约、`sys_plugin*` 持久化、权限/菜单同步机制，以及 `/system/plugins` 控制面。Core 禁止 import 具体插件实现。

## 集成与剥离

集成插件时，将其完整单元纳入目标发行物并运行迁移、生成代码、构建与测试。剥离插件时，必须在发布前从目标发行物同时排除其实现、迁移、生成 schema、权限、菜单、seed、Admin 路由和测试。

禁用插件或将它从后续发行物中剥离，默认只停止交付和运行，不删除既有业务数据。删除插件数据只能通过显式、可审计、可备份的迁移流程执行。

## 验证要求

- Core：验证没有业务插件目录时可启动、迁移、构建并通过核心测试。
- `all`：验证全部官方插件共同存在时的迁移、路由生成、Admin E2E 与 API 集成。
- 每个新插件：验证其加入 `all` 后可用，且从 stripped 发行物移除后不会留下 Core import、静态路由、权限或 DDL 依赖。
