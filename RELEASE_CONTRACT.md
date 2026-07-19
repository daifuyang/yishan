# Yishan Release Contract

## 1. 文档定位

本文定义 baseline-v2 的构建产物、验证、迁移和部署契约。
它面向 release engineer、CI 维护者、provider adapter 作者和发布操作者。
它只描述 provider-neutral artifact 及其消费方式。
插件本身的字段与运行语义见 `PLUGIN_CONTRACT.md`。
系统边界与生成链路见 `ARCHITECTURE.md`。
从基座 v1 切换到 v2 的步骤见 `MIGRATION_GUIDE.md`。

## 2. 发布原则

- 发布先构建 artifact，再部署 artifact。
- profile 是 release build 的必需输入。
- artifact 在验证后不可修改。
- 部署不得重新构建源代码。
- 部署不得重新生成 catalog、route、OpenAPI 或 migration plan。
- migration 与应用部署是独立阶段。
- provider adapter 只处理平台适配。
- 环境值只在部署边界显式注入。
- release manifest 是产物完整性与来源的索引。
- rollback 应用代码时不自动回滚 DDL。

## 3. 标准命令接口

构建指定 profile 的 release：

```bash
pnpm release:build -- --profile <name>
```

验证已经生成的 artifact：

```bash
pnpm release:validate -- --artifact <path>
```

通过指定 provider 部署：

```bash
pnpm deploy:<provider> -- --artifact <path> --env-file <path>
```

三个命令的参数分隔符 `--` 是契约的一部分。
`release:build` 不能根据当前分支隐式省略 profile。
`release:validate` 只读取 artifact，不从源码补齐文件。
`deploy:<provider>` 必须同时接收 artifact 与 env file。
命令实现可以拆分内部步骤，但不能改变外部语义。

## 4. Artifact 根路径

标准 release artifact 路径是：

```text
artifacts/release/<profile>/<version>/
```

`<profile>` 必须等于构建时解析的 profile 名。
`<version>` 必须等于该 release 的版本标识。
目录位置不是环境配置。
相同 profile 与 version 不得悄悄覆盖已验证产物。
重新构建应写入新的受控目录或证明字节一致。

## 5. 必需 Artifact 结构

每个 release 必须至少包含：

```text
artifacts/release/<profile>/<version>/
├── api/
├── admin/
├── openapi.json
├── plugin-catalog.json
├── migration-plan.json
├── release-manifest.json
└── sbom.json
```

`api/` 是编译后的 API 与当前 catalog 选择的服务端插件代码。
`admin/` 是当前 profile 的 Admin 静态站点。
`openapi.json` 是当前 profile 的完整 API spec。
`plugin-catalog.json` 是本次构建解析后的不可变插件索引。
`migration-plan.json` 是与本次代码版本配套的迁移计划。
`release-manifest.json` 记录来源、工具链、组成与 checksum。
`sbom.json` 记录交付软件的依赖物料清单。
profile 声明其他 target 时，artifact 可以增加对应目标目录。
可选目标不能替代上述必需文件。

## 6. Artifact 内容边界

API 目录只能包含运行目标需要的编译产物和资源。
API 目录不能依赖部署时回到源码树读取插件代码。
Admin 目录只能包含当前 profile 生成的 route 与 client。
Admin 目录不能夹带其他 profile 的插件入口。
OpenAPI 必须与 catalog 中的 API 集合一致。
Migration plan 必须与 catalog 中的 DDL 集合一致。
SBOM 必须描述 artifact 实际包含的软件组件。
release manifest 的 checksum 必须针对 artifact 中对应文件计算。
临时日志、缓存、本地配置和开发证书不能进入 artifact。
环境文件不能复制到 artifact。
provider 登录状态不能写入 artifact。

## 7. `release-manifest.json`

`release-manifest.json` 是每个 artifact 的必需元数据文件。
它至少必须包含以下字段：

- git SHA
- Node 版本
- pnpm 版本
- profile
- plugins 数组
- OpenAPI checksum
- migration plan checksum
- build timestamp

规范结构示例：

```json
{
  "gitSha": "<git-sha>",
  "nodeVersion": "<node-version>",
  "pnpmVersion": "<pnpm-version>",
  "profile": "<profile>",
  "plugins": [
    {
      "id": "<vendor>/<slug>",
      "version": "<plugin-version>",
      "checksum": "<plugin-checksum>"
    }
  ],
  "openapiChecksum": "<openapi-checksum>",
  "migrationPlanChecksum": "<migration-plan-checksum>",
  "buildTimestamp": "<timestamp>"
}
```

字段名可以由实现 schema 固化，但不能遗漏上述语义。
validator 必须按同一 schema 读取，而不是猜测别名。
扩展字段不得改变必需字段含义。

## 8. 来源字段

`gitSha` 必须是构建输入源码的完整、可追溯 Git SHA。
它不能写分支名代替 commit。
工作区存在未纳入构建来源的修改时，release build 必须拒绝或明确标记非正式产物。
`nodeVersion` 必须来自实际执行构建的 Node runtime。
`pnpmVersion` 必须来自实际执行构建的 pnpm runtime。
版本来源必须与仓库固定工具链规则一致。
不能手工传入一个与实际工具不同的显示值。
`buildTimestamp` 必须由 release builder 在构建时写入。
timestamp 必须使用机器可解析、带时区的格式。

## 9. Profile 字段

`profile` 必须与命令的 `--profile <name>` 一致。
它必须与 artifact 路径中的 `<profile>` 一致。
它必须与 `plugin-catalog.json` 的 profile 一致。
它必须与 `migration-plan.json` 的 profile 一致。
它必须与 `openapi.json` 的生成输入一致。
任意一处不一致都必须使 validation 失败。
分支默认值不能覆盖 manifest 中记录的 profile。

## 10. Plugins 字段

`plugins` 必须按 catalog 的确定性顺序记录。
每一项至少包含：

- `id`
- `version`
- `checksum`

`id` 必须与 plugin catalog 的不可变 id 一致。
`version` 必须与插件 manifest 一致。
`checksum` 必须覆盖足以证明该插件交付内容的规范输入。
checksum 的归一化和算法由 release tooling 统一实现。
插件不能自行选择不同算法导致 validator 无法复算。
同一 plugin id 不能在数组中重复。
catalog 外插件不能出现在 manifest。
catalog 内插件不能从 manifest 遗漏。
`kind` 等插件契约字段可以作为扩展元数据保留。
扩展字段不能替代 id、version 或 checksum。

## 11. OpenAPI Checksum

`openapiChecksum` 对 artifact 根目录的 `openapi.json` 计算。
checksum 必须在文件最终序列化后计算。
部署 adapter 不能重新格式化该文件。
validator 必须复算并比较。
不匹配时 artifact 无效。
OpenAPI checksum 不能指向源码树中的另一个 spec。
当前 profile 的 Admin client 应能追溯到同一 spec。

## 12. Migration Plan Checksum

`migrationPlanChecksum` 对 `migration-plan.json` 计算。
checksum 必须覆盖计划顺序、scope、version 和 migration checksum。
validator 必须复算并比较。
计划文件被重排、增删或修改时 checksum 必须变化。
部署 adapter 不能重写 plan 以适配环境。
执行 migration 的工具必须读取 artifact 内这份 plan。

## 13. Plugin Catalog

`plugin-catalog.json` 是 profile 解析结果。
它由 release build 生成，不能手工维护。
它必须包含所有被选插件的 id、version、kind、入口和 checksum。
API、Admin、OpenAPI、migration plan 与 release manifest 必须引用同一 catalog 事实。
validator 必须检查 catalog 与 manifest 的插件集合相等。
validator 必须检查 API prefix 与插件 id 的契约。
validator 必须拒绝重复 id、重复 prefix 和不兼容 Core 版本。
目录存在但 catalog 未选中的插件不得进入 artifact。

## 14. Migration Plan 内容

`migration-plan.json` 必须由当前 profile 生成。
计划顺序固定为：

1. Core migrations。
2. profile 声明顺序中的插件。
3. 每个插件内部的版本顺序。

每个计划项至少应能识别 scope、version、checksum 和来源文件。
Core 项的 scope 是 `core`。
插件项的 scope 是不可变 plugin id。
plan 不能通过文件名推断跨插件全局顺序。
plan 不能包含 catalog 外插件的 migration。
plan 必须能被 dry-run 与 apply 读取。
相同源码和 profile 必须生成确定性的计划。

## 15. SBOM

`sbom.json` 是必需 artifact 文件。
它描述实际交付的 API、Admin 和被选择插件依赖。
SBOM 不能以整个开发仓库依赖替代实际交付集合。
SBOM 的格式版本必须可由 release validator 识别。
无法解析或缺失时 validation 失败。
provider adapter 不生成或修补 SBOM。
部署完成后应保留 artifact 与 SBOM 的关联。

## 16. `release:build` 行为

`release:build` 必须从显式 profile 开始。
其逻辑顺序至少是：

1. 验证工具链与工作区状态。
2. 解析并验证 profile。
3. 生成唯一 plugin catalog。
4. 生成数据库 schema 与 migration plan。
5. 生成 profile OpenAPI。
6. 生成当前 profile 的 Admin route 与 client。
7. 构建 API 与被选择插件代码。
8. 构建 Admin 与 profile 声明的其他 target。
9. 生成 SBOM。
10. 计算 plugin、OpenAPI 和 migration plan checksum。
11. 写入 release manifest。
12. 对完成的 artifact 执行完整性验证。

任一步失败都不能留下可部署标记。
后续步骤不能重新解析 profile 得到不同 catalog。
构建不能依赖已有 `dist/`、缓存 client 或手工环境文件。

## 17. `release:validate` 行为

`release:validate` 必须可在没有源码构建步骤的环境执行。
它至少检查：

- artifact 路径存在且结构完整。
- 必需目录和 JSON 文件存在。
- 所有 JSON 可解析且符合 schema。
- release manifest 必需字段完整。
- profile 在路径、catalog、plan 与 manifest 中一致。
- plugin 集合、版本和 checksum 与 catalog 一致。
- OpenAPI checksum 可复算且一致。
- migration plan checksum 可复算且一致。
- plan scope 与 catalog 集合一致。
- API 与 Admin 必需入口存在。
- SBOM 存在且格式可识别。
- artifact 不依赖源码树补文件。

任何失败都必须退出非零。
validator 不能以 warning 放过完整性错误。
validator 不修改 artifact 来让检查通过。

## 18. 干净环境验证

每个待发布 profile 必须通过：

```bash
pnpm verify --profile <name>
```

verify 必须在干净 checkout 或等价隔离环境中可重现。
它不能依赖预存 `dist/`、生成 client、本地缓存或手工 `.env`。
它必须自行完成 catalog、schema、OpenAPI 与 Admin route 生成。
它必须完成 API、Admin、App、Docs 和架构检查中适用的部分。
它必须使用临时 MySQL 验证 DDL 与集成测试。
它必须执行 migration dry-run 并检查 checksum 漂移。
verify 成功不替代 artifact validation。
正式部署前仍必须对目标 artifact 运行 `release:validate`。

## 19. Provider Adapter 布局

每个 provider adapter 位于：

```text
deploy/providers/<provider>/
└── scripts/
    └── *.sh
```

adapter 可以包含 provider 所需模板和验证器。
可执行部署逻辑必须收敛到 `scripts/*.sh`。
adapter 不能位于 API 应用内部。
adapter 不能读取插件源码实现部署决策。
adapter 不能修改 Core、Admin 或 App 构建结果。
新增 provider 只增加 adapter，不改变 artifact 契约。

## 20. Provider Adapter 接口

adapter 的唯一产品输入是：

- `--artifact <path>` 指向已验证 artifact。
- `--env-file <path>` 指向本次环境注入文件。

adapter 可以把 artifact 上传、发布或映射到目标平台。
adapter 可以对 provider 必需配置做 fail-fast 校验。
adapter 不能执行 `release:build`。
adapter 不能运行源码代码生成器。
adapter 不能根据分支重新选择 profile。
adapter 不能替换 artifact 内 OpenAPI 或 migration plan。
adapter 不能从工作区拼接额外业务文件。
adapter 必须保留可追溯的 release manifest 关联。

## 21. FC3 Adapter 的配置与 Secret 注入

FC3 adapter 遵守与其他 provider 相同的 artifact 接口。
它只能通过 `--env-file <path>` 接收部署环境值和 secret。
adapter 内部不保存任何环境相关默认值。
adapter 脚本不为缺失项提供 fallback。
必需值缺失时必须在产生平台变更前 fail-fast。
env file 由调用方或 CI 的 secret 管理机制准备。
基座只约定注入点，不约定 secret 后端。
env file 不得复制进 artifact。
env file 不得写入 release manifest、日志或 SBOM。
adapter 完成后不得把解密后的内容留在仓库目录。

## 22. Migration 发布流程

migration 与 deploy 使用同一 release artifact。
标准顺序固定为：

```text
dry-run → apply → health-check → deploy
```

`dry-run` 读取 artifact 中的 migration plan。
`dry-run` 比较目标数据库版本和已应用 migration。
`dry-run` 验证 scope、version、checksum 和插件集合。
`dry-run` 不改变目标数据库。
任何漂移、未知版本或 checksum 不一致都必须停止发布。

`apply` 只在 dry-run 成功并获得发布确认后执行。
`apply` 按 plan 串行执行 Core 和插件 migration。
`apply` 记录 scope、version、checksum 与应用时间。
中途失败时不能继续部署应用。

`health-check` 在 migration 成功后执行。
它验证数据库与目标应用版本的前置条件。
health-check 失败时不进入 deploy。

`deploy` 只发布已验证的应用 artifact。
它不再次运行 build 或改写 plan。
迁移和 deploy 可以由不同作业执行，但必须引用同一 artifact。

## 23. Rollback 契约

应用 rollback 只切换回先前验证过的应用 artifact。
应用 rollback 不自动回滚 DDL。
自动执行逆向 SQL 可能破坏新版本已经写入的数据，因此被禁止。
每项 migration 必须声明 forward-only 或明确的人工回滚策略。
forward-only migration 通过后续修复 migration 恢复兼容。
需要数据库恢复时由操作者按该 migration 的策略执行。
失败的 deploy 不能假定 apply 从未发生。
回滚决策必须同时检查数据库版本与旧应用兼容性。
旧 artifact 的 release manifest 与 migration plan 必须可追溯。

## 24. 发布线与 Profile

`main` 发布必须显式使用 Core 发行 profile。
`all` 发布必须显式使用官方集成 profile。
两条发行线不以 Git ancestry 关系证明发布正确性。
每条 release 由 git SHA、profile、catalog、checksums 和验证结果证明。
跨线同步记录不能替代各自的 verify 与 release validation。
tag pipeline 必须重新确认命令传入的 profile。

<!-- baseline-v2 ADR ref: ADR-001, ADR-004, ADR-005, ADR-007 -->
