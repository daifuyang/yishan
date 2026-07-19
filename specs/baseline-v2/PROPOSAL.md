# 基座项目破坏性重构方案

## 1. 目标与边界

本方案将 Yishan 从“带有官方业务模块的单体仓库”调整为可复制、可扩展、可独立发布的管理系统基座。

本次允许破坏性修改：不保留旧分支策略、旧插件目录、旧 API 前缀、旧生成文件格式、旧部署脚本或旧文档链接的兼容层。升级采用一次性切换；业务项目在新结构上重新接入。

完成后的基座应满足：

1. Core 不包含任何特定业务领域代码、表、权限、文档或发布默认值。
2. 一个插件只有一份声明，前后端路由、菜单、权限、迁移和 OpenAPI 均从该声明或其同目录文件派生。
3. 禁用插件等于不加载该插件的 API、页面、任务、事件订阅和菜单。
4. Core、官方集成版和客户项目使用同一构建机制，只是选择不同的插件 profile。
5. `pnpm verify` 可在干净环境独立重现，覆盖 API、Admin、App、Docs 和插件契约。
6. AI 或新开发者只需读取根目录的少量规范，就能基于当前真实架构开发；历史方案不会被当作现行事实。

## 2. 一次性架构决策

### 2.1 保留 `main` / `all` 两条发行线，但取消祖先同步模型

保留 `main` 作为 Core 发行线，保留 `all` 作为官方完整业务插件示例与集成发行线。`all` 的价值是提供 portal、shop 等官方业务模块的可运行参考、端到端测试组合和官方演示，而不是一个应被删除的临时分支。

要取消的是“要求 `all` 必须包含 `main` 的 Git 祖先提交”这一同步模型：两条线已经分叉，Core 变更应以显式的 backport/cherry-pick 清单同步，而不是通过 merge-base 证明正确性。

产品差异由 profile 表达：

```text
profiles/
├── core.yaml             # 仅 core + hello 示例插件
├── official.yaml         # core + 官方 portal、shop 等插件
└── <project>.yaml        # 客户项目或业务线的插件组合
```

规则：

- `main` 只保留 Core 与 hello 示例插件；`all` 保留 Core 加 portal、shop 等官方业务插件。
- `hello` 是 SDK/样例，不参与生产默认 profile。
- 两条线都使用相同的 profile、plugin catalog、构建与质量门禁；`main` 默认使用 `core`，`all` 默认使用 `official`。
- 删除 `all` 必须包含 `main` 的 ancestry 检查；跨线同步改为显式 `sync-manifest`（记录来源 commit、目标分支、冲突结论、是否影响插件边界）。
- 每个 release 必须显式传入 profile，例如 `pnpm release:build -- --profile official`；`all` 的 CD 只发布 `official` profile。

### 2.2 统一插件为仓库级包

删除两套目录：

```text
apps/yishan-api/src/plugins/modules/*
apps/yishan-admin/src/plugins/modules/*.manifest.ts
```

替换为：

```text
plugins/
└── yishan/
    ├── hello/
    │   ├── plugin.ts
    │   ├── api/
    │   │   ├── routes/
    │   │   ├── services/
    │   │   ├── repositories/
    │   │   └── schemas/
    │   ├── admin/
    │   │   ├── pages/
    │   │   └── routes.ts
    │   ├── app/                  # 可选，小程序功能
    │   ├── migrations/
    │   ├── seed/
    │   ├── tests/
    │   └── README.md
    ├── portal/
    └── shop/
```

`plugins/*/*/plugin.ts` 是插件唯一 manifest。禁止在 API、Admin 或脚本目录另建 manifest。

### 2.3 插件身份与命名

插件使用不可变的 `id = <vendor>/<slug>`，例如 `yishan/shop`；目录、包名、迁移前缀和 UI 路径均由它派生。

```ts
export default definePlugin({
  id: 'yishan/shop',
  version: '1.0.0',
  coreVersion: '^2.0.0',
  api: { prefix: '/api/plugins/yishan/shop/v1' },
  database: { namespace: 'ys_shop' },
  permissions: [/* structured permissions */],
  menus: [/* declarative menu definitions */],
  admin: { routes: () => import('./admin/routes') },
  migrations: './migrations',
  seed: './seed',
});
```

约束：

- 不再用目录短名拼接 `/api/modules/<name>`。
- 不再在任意位置硬编码 `portal`、`shop`、`hello` 作为系统分类或权限分组。
- `coreVersion` 必须使用 semver，加载 profile 时验证，不满足即构建失败；运行时不允许带着不兼容插件启动。
- `database.namespace` 只能用于该插件自己的表、迁移和 seed 名称；Core 不得引用插件表。

## 3. 插件加载与生命周期

### 3.1 构建期选择，运行期只装载已选择插件

profile 解析器是唯一的插件选择来源。它在构建开始时读取 `profiles/<name>.yaml`，输出不可手改的 `build/plugin-catalog.json`。

```text
profile.yaml
    ↓
validate-profile
    ↓
plugin-catalog.json
    ├── API route/autoload registration
    ├── Admin route generation
    ├── OpenAPI export
    ├── migration plan
    ├── seed plan
    └── release metadata
```

API 只能遍历 catalog 中的插件注册 routes、Fastify plugins、worker、cron、event handler。目录存在但未被 profile 选中时，不得被扫描或加载。

### 3.2 运行期启停语义

数据库中的插件状态仅用于已构建且已安装的插件；它不能让未包含在 release 中的插件出现。

状态机只保留：`installed`、`enabled`、`disabled`、`failed`。

- `disabled`：插件的 HTTP 路由在注册入口统一返回 404 / `PLUGIN_DISABLED`；后台和小程序菜单不返回；任务、订阅和异步消费者不启动。
- `enabled`：执行该插件的安装后检查、菜单同步和所有运行能力注册。
- `failed`：启动失败并记录诊断；不得降级成“菜单隐藏但 API 仍可用”。

实现方式：API 只注册 profile 内插件；每个插件由 Core 的统一 `pluginGate(pluginId)` 包裹。启停变化无需重新部署也可以生效，但 gate 必须覆盖整个插件路由树及后台任务入口。

必须新增测试：

1. 不在 profile 的插件：OpenAPI、路由表、菜单和迁移计划中均不存在。
2. profile 内但 disabled 的插件：所有 API 返回禁用响应，菜单/权限目录不暴露，任务不执行。
3. enabled 插件：路由、OpenAPI、权限、菜单和前端页面一致出现。
4. Core 不能 import 任意插件；插件不能跨插件 import。

## 4. 数据库与业务边界

### 4.1 数据库目录

保留 Drizzle，删除全部 Prisma 运行时、构建时、部署时与规范性文档引用。

```text
apps/yishan-api/
├── drizzle/core/                   # Core DDL
├── src/db/                         # Drizzle client、生成 schema、migration runner
└── ...
plugins/<vendor>/<slug>/migrations/ # 插件 DDL，按插件独立管理
```

迁移计划由 profile 生成，排序规则为：Core migration → profile 中插件声明顺序 → 插件内版本顺序。迁移记录保存 `scope`（`core` 或 plugin id）、`version`、`checksum`、`appliedAt`。

不允许：

- Core migration 创建 `portal_*`、`shop_*` 等业务表。
- Core repository 查询插件表。
- 插件直接修改 Core DDL 或借用其他插件表。
- 根据文件名硬编码 `0001_portal.sql`、`0002_shop.sql`。

### 4.2 API 分层

继续采用 Route → Service → Repository，但将边界写入可自动检查的规则：

```text
core/routes      → core/services      → core/repositories
plugin/api/routes → plugin/api/services → plugin/api/repositories
```

- Route 只负责 schema、认证、权限、DTO 和 HTTP 响应。
- Service 只负责业务编排和事务边界。
- Repository 是唯一允许访问 `@/db`、表定义和 SQL 的层。
- Core 只能暴露经过明确接口定义的 extension point；插件通过 extension point 使用 Core 能力，不得反向 import Core 内部实现。

## 5. Admin、App 与 OpenAPI

### 5.1 Admin 路由和菜单

Admin 的 Umi route 由 plugin catalog + plugin `admin/routes.ts` 生成。生成器必须失败，而非静默去重，以下任一情况都失败：

- route path 重复；
- 组件文件不存在；
- 页面未声明对应插件；
- manifest 菜单 path 没有可挂载前端页面；
- 未授权页面没有明确 access strategy。

菜单仍以服务端返回为准，但 menu item 必须携带 `pluginId` 和 permission codes。Admin 对 disabled 插件显示统一“功能未启用”页，而不是残留旧页面。

### 5.2 OpenAPI

每个 profile 单独生成 spec：

```text
artifacts/openapi/<profile>.json
apps/yishan-admin/src/services/generated/<profile>/
```

Admin 仅引用当前构建 profile 的 client。禁止把官方插件 client 留在 Core 生成目录中。

`openapi:check --profile <name>` 必须重新生成并要求工作区无 diff；Core profile 的 spec 不得出现官方插件 tag、path 或 schema。

### 5.3 App

App 不作为 Admin 的附属产物。它必须拥有独立的插件接入点：插件可选择提供 `app/` 页面、Tab、接口封装及能力声明；未提供时不生成任何 App 入口。

每个 release profile 明确列出目标端：`admin`、`app-weapp`、`app-h5`、`docs`、`api`。App API 类型直接消费 profile OpenAPI 或共享生成类型，禁止手工复制 Admin 类型。

## 6. 发布与部署重构

### 6.1 抽象发布产物

发布不是“部署到 FC3”。先统一生成 provider-neutral artifact：

```text
artifacts/release/<profile>/<version>/
├── api/                 # 编译 API + selected plugin server code
├── admin/               # Admin 静态站点
├── app-weapp/           # 可选
├── app-h5/              # 可选
├── openapi.json
├── plugin-catalog.json
├── migration-plan.json
├── sbom.json
└── release-manifest.json
```

`release-manifest.json` 至少记录 git SHA、Node/pnpm 版本、profile、插件 id/version/checksum、OpenAPI checksum、迁移计划 checksum 和构建时间。

### 6.2 Provider adapter

将现有 FC3/Qiniu 部署移至 `deploy/providers/fc3/`，成为可选 adapter；删除 Core 代码、根 package script 和默认文档中的阿里云账户、地域、层名、Qiniu bucket 等环境专属默认值。

提供统一接口：

```bash
pnpm release:build -- --profile core
pnpm release:validate -- --artifact artifacts/release/core/<version>
pnpm deploy:fc3 -- --artifact artifacts/release/official/<version>
```

FC3 adapter 只接收 artifact 和显式环境变量，不再在部署中重新生成代码、OpenAPI、Admin 路由或迁移计划。

### 6.3 数据迁移发布流程

迁移和应用发布分开，但都使用同一 release artifact 中的 `migration-plan.json`：

1. `release:build` 产出并校验 migration plan。
2. `migrate:dry-run` 验证数据库版本、checksum、插件集合与目标 artifact 一致。
3. 人工确认后 `migrate:apply`。
4. 仅在迁移成功且健康检查通过后部署应用 artifact。
5. 回滚代码不自动回滚 DDL；每项 migration 必须明确 forward-only 或可回滚策略。

## 7. 命令、CI 和质量门禁

### 7.1 根命令

删除含义重叠的 `build`、`verify`、部署复制脚本。使用以下命令集合：

```bash
pnpm profile:validate -- --profile core
pnpm plugins:catalog -- --profile core
pnpm db:generate -- --profile core
pnpm openapi:generate -- --profile core
pnpm admin:generate-routes -- --profile core

pnpm verify:core -- --profile core
pnpm verify:admin -- --profile core
pnpm verify:app -- --profile core --target weapp
pnpm verify:docs
pnpm verify:integration -- --profile official
pnpm verify -- --profile core

pnpm release:build -- --profile core
pnpm release:validate -- --artifact <path>
```

顶层 `pnpm verify -- --profile <name>` 必须在干净 checkout 中完成：安装、catalog、TipTap 构建、Drizzle 生成、OpenAPI 生成、Admin route 生成、API build/test、Admin lint/test/build、App lint/build、Docs build、架构检查和生成物 diff 检查。

不得依赖已存在的 `dist/`、`.umi/`、手工 `.env`、本地生成 client 或已构建的 workspace dependency。

### 7.2 CI 矩阵

每个 pull request 至少运行：

| 改动范围 | 必跑任务 |
| --- | --- |
| Core API / plugin contract | core profile `verify` |
| 某插件 | 包含该插件的最小 profile `verify` + plugin integration test |
| Admin | admin build/test + affected profile OpenAPI/route check |
| App | WeApp lint/build；H5 lint/build |
| Docs / 根规范 | docs build + docs check |
| deploy provider | release build/validate + provider adapter dry-run |

`main` 的 tag/release 必须运行 `core` profile；`all` 的 tag/release 必须运行 `official` profile。官方集成发布也应额外执行 Core 契约测试，但不再以 Git branch ancestry 作为发布正确性证明。

## 8. 文档与 AI 协作体系

### 8.1 根目录文档结构

根目录只保留入口和规范，业务说明进入 `docs/`：

```text
AGENTS.md                         # AI/开发者强制规则，短且稳定
README.md                          # 项目介绍、五分钟启动、profile 选择
ARCHITECTURE.md                    # 当前架构事实与目录边界
PLUGIN_CONTRACT.md                 # 插件开发、manifest、生命周期、迁移契约
RELEASE_CONTRACT.md                # artifact、迁移、provider adapter、回滚契约
CONTRIBUTING.md                    # 提交流程与质量门禁
MIGRATION_GUIDE.md                 # 本次破坏性重构的业务迁移指南
docs/                              # 面向使用者的长文档
specs/archive/                     # 历史 feature 方案，只读归档
```

### 8.2 新 AGENTS.md 内容

AGENTS.md 只包含：

1. 当前技术栈与固定版本来源；
2. 开始开发时必须读取的根文档；
3. Core/插件边界；
4. Route → Service → Repository 规则；
5. profile、生成物和 verify 命令；
6. 禁止项（Prisma、双 manifest、硬编码业务插件、跳过生成检查）；
7. 变更类型到测试命令的映射。

禁止在 AGENTS.md 中放：历史项目计划、具体业务插件清单、部署账户/地域、会频繁变动的 implementation detail、与真实脚本不一致的命令说明。

删除“read the current plan”。替换为：`specs/archive/** 是历史资料，不得作为当前架构依据；当前事实以 ARCHITECTURE.md、PLUGIN_CONTRACT.md、RELEASE_CONTRACT.md 和 package.json 为准。`

### 8.3 文档校验

新增 `pnpm docs:check`，检查：

- 根规范文件中不存在 Prisma、`core/models`、`prisma/schema`、`plugins/modules` 等已废弃实现描述；
- Node/pnpm 版本只从 `.tool-versions` 或 `package.json#engines` 引用；
- 每个根规范文档中出现的命令都存在于 package scripts；
- 每个内部 Markdown 链接可解析；
- 历史文档有明确 `Archived` 标记，不被侧边栏或 AI 入口引用。

## 9. 实施阶段

### 阶段 A：冻结与事实清理

1. 明确 `main`（Core）与 `all`（官方完整示例）的维护职责、允许包含的插件和各自默认 profile；为两条线建立 release tag 规则。
2. 新建 `profiles/core.yaml`、`profiles/official.yaml`，列出现有模块。
3. 写入根目录六份规范文档，标明旧目录与旧命令已废弃。
4. 删除或归档所有把 Prisma 说成当前实现的 README、Docusaurus 页面和 specs；历史材料移动到 `specs/archive/`。
5. 统一 Node/pnpm 版本，并使 CI、本地工具、release manifest 从同一来源读取。

验收：`rg -i "prisma" README.md AGENTS.md ARCHITECTURE.md PLUGIN_CONTRACT.md RELEASE_CONTRACT.md` 无结果；没有任何工作流使用 ancestry check；`main` 和 `all` 均有明确且可运行的 profile 门禁。

### 阶段 B：插件 SDK 与目录迁移

1. 创建 `packages/plugin-sdk`，提供 `definePlugin`、类型、manifest validator、profile parser 和 catalog generator。
2. 将 hello、portal、shop 移入 `plugins/yishan/*`；删除 API/Admin 的旧插件目录。
3. 合并双 manifest，改写 API/Admin import 和生成脚本。
4. 实施 profile 校验：唯一 id、唯一 API prefix、唯一 UI path、semver 兼容、依赖无环、组件存在、权限唯一。
5. 让架构检查基于新目录运行，并增加 Core→plugin、plugin→plugin 的 import 禁止规则。

验收：任意插件只存在一个 `plugin.ts`；`core` catalog 仅含 hello；`official` catalog 含官方模块；重复路由或不兼容插件必然失败。

### 阶段 C：运行时正确性

1. 用 catalog 替代目录扫描。
2. 将所有插件 API、后台任务和 hook 纳入统一 gate。
3. 删除“同步 manifest 后默认继续加载模块”的旧路径。
4. 为安装、启用、禁用、失败状态写集成测试。
5. 让权限目录、菜单同步、OpenAPI exporter 只使用 enabled + selected 的插件集合。

验收：disabled 插件不存在可访问业务 API；不在 profile 的插件不会出现在已编译服务的路由表中。

### 阶段 D：数据库与生成链路

1. 将 portal/shop DDL 从 Core drizzle 目录移入各自插件 migration 目录。
2. 改造 migration runner 和 generator，使其基于 catalog/migration plan 工作。
3. 删除 Prisma lock、依赖、忽略项和历史兼容层。
4. 按 profile 输出 Drizzle schema、OpenAPI、Admin client 和 routes。
5. 为 Core 和 official profile 建立快照测试。

验收：Core release 不含业务表、业务 OpenAPI path、业务 client 或业务页面；任何 migration checksum 漂移都会阻断发布。

### 阶段 E：发布与 CI

1. 实现 release artifact 和 `release-manifest.json`。
2. 将 FC3/Qiniu 移至 provider adapter，移除默认账户/ARN/名称。
3. 重写 GitHub Actions：`main` 执行 Core profile，`all` 执行 official profile；删除 all/main ancestry workflow，改为跨线同步记录校验。
4. 让 `pnpm verify` 自准备全部前置产物，并在临时干净目录测试。
5. 增加 provider dry-run 与 migration dry-run。

验收：Core 和 official artifact 都可独立构建与验证；部署只消费 artifact，不重新构建源代码。

### 阶段 F：业务迁移和切换

1. 为 portal、shop 和未来客户插件提供迁移 checklist。
2. 对每个业务插件执行：manifest 合并、DDL 迁移、API route 更新、Admin 页面更新、权限/菜单校验、profile 测试。
3. 选择一个非生产环境按新 artifact 做全流程验证。
4. 停止旧发布链路，删除旧目录、旧工作流、旧 branch protection 和旧文档入口。
5. 创建 `v2.0.0` 基座 release。

## 10. 完成定义

只有同时满足以下条件，才算本次重构完成：

- `main` 只包含 Core/hello，`all` 包含官方完整插件示例；两条发行线均不依赖 Git ancestry 判断同步正确性；仓库中没有双插件 manifest、`plugins/modules`、Prisma 当前实现描述或业务插件硬编码分类；
- `core` profile 的源码、数据库迁移、OpenAPI、Admin routes/client、release artifact 均不包含 portal/shop；
- 插件 disabled 后其 API、任务、菜单、权限和前端入口全部不可用；
- profile 是 API、Admin、App、OpenAPI、迁移、seed 和 release 的共同唯一输入；
- `pnpm verify -- --profile core` 及 `pnpm verify -- --profile official` 在干净环境通过；
- 根目录规范和 package scripts、CI、实际部署 artifact 一致，并由 docs check 自动守护。

## 11. 明确不做的事项

- 不为旧 `/api/modules/*`、旧 Admin manifest、旧 Prisma schema 或旧部署命令保留兼容入口；保留 `main` / `all` 两条发行线及其既定插件边界。
- 不允许通过“隐藏菜单”实现插件禁用。
- 不允许把环境专属云账号、地域、bucket、ARN 或 secret 名称作为基座默认值。
- 不允许以人工检查代替 profile、OpenAPI、迁移、路由和文档的自动一致性校验。
