# Yishan v1 → v2 Migration Guide

## 1. 读者与目标

本文面向已经部署 v1 baseline 的维护者。
它描述如何把一个在跑的 v1 实例升到 v2 baseline。
它不重复 v1 业务插件历史，也不讨论方案原理。
迁移完成后，新基座应满足：

- 发行线不再要求 ancestry 包含。
- 插件仅存在于 `plugins/<vendor>/<slug>/`。
- API 路径使用 `/api/plugins/<vendor>/<slug>/v1/...`。
- 部署只消费 release artifact 与显式 env。
- 仓库已清理 Prisma 等已废弃实现描述。
- `pnpm verify --profile <your-profile>` 在干净环境通过。
- 部署前 `pnpm release:validate` 通过。

不要在迁移过程中修改不在本文清单里的目录。
任何 v1 兼容层或别名路径都应按方案要求直接删除。

## 2. 迁移总览

完整迁移流程是：

1. 同步 refactor/baseline-v2 分支到本地。
2. 把 v1 业务插件按新目录结构重组。
3. 合并双 manifest 为单一 `plugin.ts`。
4. 改写 API 路径、Admin 入口和 App 入口。
5. 迁移部署脚本到 provider adapter。
6. 把 secret 移出 `.env`、把证书移出仓库。
7. 删除过时文档、归档历史 spec。
8. 在干净环境完成 verify。
9. 对生成的 artifact 完成 validate。
10. 切流到新发布流程。

每一步都必须先在小范围、测试或非生产环境演练。
不得把 v1 与 v2 同时运行同一份业务数据。
迁移期间的数据库变更必须以 migration plan 为准。

## 3. 发行线对齐

v1 维护者通常已熟悉 `main` 与 `all` 之间的关系。
v2 不再要求 `all` 通过 ancestry 证明包含 `main`。
`main` 与 `all` 之间的关系变为：

- 两条线分叉后继续独立演进。
- 共享 profile、plugin SDK、catalog 和 verify 机制。
- 跨线同步通过显式记录而不是 merge-base。

迁移操作：

- 在 refactor/baseline-v2 上完成所有破坏性重构。
- stage F 末尾打 `v2.0.0` tag。
- v1 部署若仍在旧发布链路上，保留其专属分支和 tag。
- 新发布必须以 `--profile <name>` 显式指定。

跨线同步必须有：

- 来源 commit。
- 目标分支。
- 冲突结论。
- 是否影响插件边界的结论。

不要在 PR 描述里口头说明，请以文件形式登记。
缺登记项时合并流程会拒绝跨线 PR。

## 4. Profile 系统迁移

v1 的“选择要打的业务模块”通常以目录或文件清单形式存在。
v2 改为以 `profiles/<name>.yaml` 为唯一输入。
迁移动作：

- 阅读 `profiles/core.yaml` 与 `profiles/official.yaml`。
- 为当前项目复制 `profiles/template.yaml` 为 `profiles/<your-profile>.yaml`。
- 把 `samples` 与 `plugins` 列表替换为新插件 id。
- 调整 `targets` 列表，描述 release 目标端。
- 配置 `verify.db` 描述 ephemeral MySQL 策略。

如果你的 v1 业务组合没有 hello，需要显式写 `samples: []`。
如果你的 v1 业务组合包含 hello，必须显式保留。
生产组合不应让 hello 默认进入 catalog。

## 5. 插件目录迁移

v1 旧位置是 API 业务插件目录与 Admin 双 manifest（具体路径请在 `git log` 中检索历史）。
v2 新位置是：

```text
plugins/<vendor>/<slug>/
└── plugin.ts
```

迁移步骤：

1. 决定插件的 vendor 与 slug。
2. 在 `plugins/<vendor>/<slug>/` 建立标准目录。
3. 把 API 业务代码迁入 `api/{routes,services,repositories,schemas}/`。
4. 把 Admin 页面迁入 `admin/pages/`，路由声明迁入 `admin/routes.ts`。
5. 把 DDL 迁入 `migrations/`，seed 迁入 `seed/`。
6. 合并并删除 `*.manifest.ts` 旧文件。
7. 把测试迁入 `tests/`。
8. 更新所有指向旧路径的 import 与生成脚本。

v1 的双 manifest 字段必须合并到 `plugin.ts`。
合并过程中请对照 `PLUGIN_CONTRACT.md` 第 4–8 节。
新 manifest 必须明确声明 `id`、`version`、`coreVersion`、`kind`。
`kind` 默认为 `production`，仅 hello 可保持 `sample`。

## 6. API 路径迁移

v1 旧路径是：

```text
/api/modules/<name>/v1/...
```

v2 新路径是：

```text
/api/plugins/<vendor>/<slug>/v1/...
```

迁移动作：

- 替换 manifest 中 `api.prefix`。
- 修改 API 代码中所有以 `/api/modules/<name>/v1` 开头的常量。
- 修改 App 客户端中指向旧 prefix 的配置。
- 修改 CLI 资源生成器的 prefix 拼接逻辑。
- 修改 OpenAPI tag、path 与 schema 中的引用。
- 修改文档中所有 path 示例。
- 修改权限、菜单中可能携带的 path 字段。

不要保留 `/api/modules/...` 的转发层。
不要在 API 内保留路径重写或别名映射。
下游消费者必须在迁移窗口内完成同步切换。

## 7. 业务代码改写

迁移过程中需要修改的代码包括：

- import 路径由 `src/plugins/modules/...` 改为 `plugins/<vendor>/<slug>/...`。
- 任何 `manifest.ts` 引用替换为新 manifest。
- 双 manifest 字段合并为单 manifest 字段。
- 路由注册由 autoload 改为 `plugin.register(app)` 显式调用。
- 资源管理代码以 catalog 为唯一来源。
- 跨插件 helper 改为通过 Core extension point 调用。
- 测试 import 路径同步更新。
- 任何按目录枚举插件的工具改为消费 plugin catalog。

请对照 `PLUGIN_CONTRACT.md` 检查 API 分层、id 绑定、PluginGate。
禁止把旧业务逻辑直接复制到新 manifest 然后继续依赖目录扫描。

## 8. Drizzle 与 DDL 迁移

v1 可能存在一些 DDL 位于 Core 但实际属于业务插件。
v2 的所有权边界是：

- Core DDL 在 `apps/yishan-api/drizzle/core/`。
- 插件 DDL 在 `plugins/<vendor>/<slug>/migrations/`。

迁移动作：

- 识别 Core 目录中实际属于插件的表和索引。
- 把这些 DDL 迁入对应插件的 `migrations/` 目录。
- 把历史 `0001_xxx.sql` 拆分为插件版本序列。
- 为每项历史 DDL 分配 checksum 并记录。
- 在 `plugin.ts` 中显式引用 `migrations: './migrations'`。

迁移期间不删除 Core 中旧 SQL 文件，直到新的 apply 验证成功。
历史 DDL 拆出后，旧 SQL 文件与对应新插件 migration 内容必须等价。
不能把同一变更拆分到 Core 与插件两边。

## 9. OpenAPI 与客户端迁移

v1 通常有一个共享的 OpenAPI 和 Admin client 树。
v2 改为 per-profile 生成。
迁移动作：

- 删除 v1 单 OpenAPI 路径的硬编码引用。
- 改为按 `pnpm openapi:generate -- --profile <your-profile>` 生成。
- Admin client 改为按 profile 输出。
- dev 与 build 命令在 profile 切换时不要跨 profile 互相覆盖。
- 校验 `artifacts/openapi/<your-profile>.json` 不含 Core 不存在的插件路径。
- 校验 Admin 中不出现 catalog 外插件的入口。

如果 v1 有手工维护的 spec 副本，请删除。
OpenAPI 必须由 schema 与 route 派生，不接受手写平行 spec。

## 10. 部署脚本迁移

v1 旧路径是：

```text
apps/yishan-api/deploy/fc3/
```

v2 新位置是：

```text
deploy/providers/fc3/
```

迁移动作：

- 把部署脚本迁到 `deploy/providers/fc3/scripts/`。
- 删除 `apps/yishan-api/deploy/` 整目录。
- 删除任何旧的 `build:admin:fc` 之类的耦合发布脚本。
- 删除仓库中遗留的 cert 私钥。
- 把 cert 私钥从 `git` 历史中清出。
- 调整 CI workflow 不再写硬编码地域、层名或 access alias。

部署脚本不再生成源码构建产物。
任何在部署中触发 `pnpm build` 的写法应改为消费已有 artifact。

## 11. Secret 迁移

v1 的 secret 通常位于仓库内 `.env` 或写在 workflow 默认值中。
v2 改为部署边界显式注入。
迁移动作：

- 仓库中所有 `.env` 不再包含真实凭据。
- 把 runtime secret 移到项目专属 secret 后端。
- 准备部署时使用的 `--env-file <path>`。
- adapter 内部不写任何 region、layer、alias 或 bucket 默认值。
- adapter 缺值时 fail-fast，而不是用占位默认。
- 发布日志不打印 env 内容。
- 部署完成后清理解密后的临时文件。

Qiniu、FC3 与其他 provider 的 secret 都在同一原则下。
secret 后端由项目选择；基座只约定注入点。

## 12. 文档与 Spec 清理

v1 仓库中可能仍保留 Prisma、core/models、plugins/modules 等表述。
v2 要求根规范与所有现行文档清空这些已废弃描述。
迁移动作：

- 移除根规范与 `README.md` 中的 Prisma 字样。
- 把 `docs/architecture/adr/ADR-0001...0003` 中以 Prisma 为前提的 ADR 标记为 Archived。
- 把 `specs/002-app-ui-upgrade` 整目录移到 `specs/archive/`。
- 把 `HOSPITAL_ACCOUNT_ARCHITECTURE.md` 移到 `specs/archive/`。
- 旧 FC3/Qiniu 默认值（地域、层名、bucket、access alias、secret 名）从文档清除。
- 历史 spec 文件以 `Archived` 标记，不被侧边栏引用。

清理后，根规范只描述当前架构。
docs/ 描述长篇使用说明，不复述架构契约。

## 13. AGENTS.md 同步

v1 的 `AGENTS.md` 中可能仍写有“读 current plan”之类的指引。
v2 改为：

- 必读根目录六份规范。
- 旧目录、旧命令、旧模式禁止保留。
- profile、catalog、verify、PluginGate 是硬约束。

如果根规范已经更新而 AGENTS.md 没跟上，请同步更新。
任何 v1 兼容提示都不应留在 AGENTS.md。

## 14. 验证与验收

完成迁移后必须完成两项检查：

1. 干净环境通过：

   ```bash
   pnpm verify --profile <your-profile>
   ```

2. 对最终 artifact 通过：

   ```bash
   pnpm release:validate -- --artifact artifacts/release/<your-profile>/<version>
   ```

verify 必须完成：

- profile 验证。
- catalog 生成。
- Drizzle schema 与 migration plan。
- profile OpenAPI 生成。
- Admin route 与 client 生成。
- API、Admin、App、Docs 构建。
- 架构检查与生成物 diff。
- integration 测试和 migration dry-run。

release:validate 必须确认：

- artifact 结构完整。
- release manifest 必需字段齐全。
- OpenAPI、migration plan 与 catalog checksum 一致。
- plugin 集合与 catalog 一致。
- SBOM 可解析。

未通过任一项时不进入 deploy。
deploy 之前必须对同一 artifact 完成 dry-run。

## 15. 切换与回滚

切换顺序建议：

1. 完成 v2 迁移并通过 verify。
2. 在非生产环境对新 artifact 完成 migration apply 与 deploy。
3. 健康检查通过后做一轮完整业务演练。
4. 再切流到生产 artifact。
5. 保留 v1 旧 artifact 至少一个回滚窗口。

回滚时：

- 应用回滚仅切换到旧 artifact。
- 不得自动回滚 DDL。
- 每项 migration 的回滚策略按发布时声明执行。

切换期间同时在线 v1 与 v2 是不支持的。
迁移窗口必须保证数据库版本与运行应用版本一致。

## 16. 迁移验收清单

迁移可声明完成之前，确认：

- 所有业务插件已位于 `plugins/<vendor>/<slug>/`。
- 没有 v1 插件目录或双 manifest 残留。
- 没有 `*.manifest.ts` 旧 manifest 残留。
- 没有 `/api/modules/...` 旧路径。
- 没有 Prisma、`core/models`、`prisma/schema` 描述。
- 没有历史 FC3/Qiniu 默认值。
- 没有 cert 私钥提交。
- provider adapter 不内置任何 region 或 secret 默认。
- 你的 profile 通过 `pnpm verify --profile <your-profile>`。
- 你的 artifact 通过 `pnpm release:validate -- --artifact <path>`。
- 跨线同步有显式记录。
- 团队对 PluginGate 三态契约达成一致。

<!-- baseline-v2 ADR ref: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-007 -->
