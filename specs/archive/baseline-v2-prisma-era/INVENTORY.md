# 基线盘点（baseline-v2 重构入口）

> 时间：2026-07-19
> 分支：`refactor/baseline-v2`（基于 `main` @ `f3eb9ba`）
> 目的：在动代码前，定量记录 main 分支当前状态，作为后续阶段 ADR 与验收的对照基线。

## 1. 发行线 / 分支状态

| 分支 | HEAD | 角色 |
| --- | --- | --- |
| `main` | `f3eb9ba` | Core 发行线；唯一插件 `hello`；CI 已绿（run 29693007967） |
| `all`  | `eedb1e1` | 官方完整业务插件示例；含 `portal`、`shop`（main 未见） |

git 工作区干净（除 `specs/baseline-v2/PROPOSAL.md` 来自本次粘贴）。

## 2. 插件模块文件清单

### 2.1 API 侧

```
apps/yishan-api/src/plugins/
├── README.md
└── modules/
    └── hello/
        ├── manifest.ts              (89 行，5 节 §2.2 详)
        ├── routes/v1/admin/
        │   ├── autohooks.ts
        │   └── index.ts
```

文件计数：**4 个**（含 1 个 README）。

### 2.2 Admin 侧

```
apps/yishan-admin/src/plugins/modules/
├── hello.manifest.ts               (15 行，仅 name/version/coreCompatibility/routes)
└── system.manifest.ts              (29 行，5 条 system/* 路由)
```

文件计数：**2 个**。

### 2.3 双 manifest 不对齐

| 字段 | API 侧 `hello/manifest.ts` | Admin 侧 `hello.manifest.ts` |
| --- | --- | --- |
| `pluginId` | `yishan/hello` | 缺失 |
| `dbNamespace` | `ys_hello` | 缺失 |
| `name` | `hello` | `hello` |
| `version` / `coreCompatibility` | 一致 | 一致 |
| `channels` / `routeBase` | API 侧 | 缺失 |
| `permissions` / `menus` | API 侧 | 缺失 |
| `routes`（admin） | 缺失 | `plugins/yishan/hello/health` |
| `menus`（含 `channel`） | API 侧 | 缺失 |

`system.manifest.ts` 命名具有误导性：它不是 plugin，而是 Core 系统管理页面的 admin 路由声明；阶段 B 需把 Core admin 路由从 `plugins/modules/*.manifest.ts` 拆出来，否则会被误归类。

## 3. `/api/modules/*` 调用面

| 类型 | 路径 / 文件 | 行 |
| --- | --- | --- |
| 路由前缀定义 | `apps/yishan-api/src/plugins/modules/hello/manifest.ts` | 16 |
| App 客户端 | `apps/yishan-app/src/config.ts` | 14 |
| CLI 生成器 | `apps/yishan-api/src/cli/resource-registry.ts` | 59 |
| CLI 生成产物 | `apps/yishan-api/src/cli/generated-resources.ts` | 11, 35, 103, 145-196 |
| 资源同步 | `apps/yishan-api/src/core/services/plugin-menu-sync.service.ts` | （间接）|
| 架构检查 | `scripts/arch/check-routes.mjs` | 141 |
| 测试 | `apps/yishan-api/test/plugin-platform/persistence.repository.test.ts` | 50 |
| OpenAPI 产物 | `apps/yishan-api/openapi.json` | 11186 |
| 文档 | `apps/yishan-docs/docs/modules/{plugin-module-template,posts}.md` | 21, 9 |

测试基线：`pnpm arch:check` → `[routes/manifest/boundaries] PASS 0 violation(s)`。

## 4. Prisma 文档残留

源码侧 **干净**：`rg "@prisma|PrismaClient" apps/` 零命中，仅 `apps/yishan-api/docs/Drizzle迁移现状与开发规范.md` 内有 "Prisma" 字样（作为迁移史说明，阶段 A 评估是否需标记为 Archived）。

文档侧残留：

| 文件 | 行 | 命中 |
| --- | --- | --- |
| `README.md` | 17, 59, 86, 118, 121, 199 | `Prisma 7` / `Prisma 客户端` / `src/core/models/` / `prisma/schema/` |
| `AGENTS.md` | 71 | 已写"legacy Prisma shim no longer exists"（半旧）|
| `docs/architecture/adr/ADR-0001-core-plugin-boundary.md` | 11, 27, 46, 72 | 整篇以 Prisma 为前提 |
| `docs/architecture/adr/ADR-0002-versioning-and-breaking-policy.md` | 81 | Prisma 迁移 down plan |
| `docs/architecture/adr/ADR-0003-plugin-lifecycle-and-hooks.md` | 9, 80 | 全文前提 |
| `specs/002-app-ui-upgrade/{plan.md,data-model.md,tasks.md}` | 多处 | 数据模型章节以 Prisma 为前提 |
| `HOSPITAL_ACCOUNT_ARCHITECTURE.md` | 115, 455, 472 | 业务示例用 Prisma |

阶段 A 验收命令（来自方案 §9.A.5）：`rg -i "prisma" README.md AGENTS.md ARCHITECTURE.md PLUGIN_CONTRACT.md RELEASE_CONTRACT.md` 必须无结果。

## 5. CI 工作流与 ancestry 检查

```
.github/workflows/
├── yishan-cert-rotate-fc.yml
├── yishan-fc-migrate.yml
├── yishan-fullstack-cd-fc.yml
└── yishan-fullstack-ci.yml
```

ancestry / 同步类步骤：

| 工作流 | 行 | 步骤 |
| --- | --- | --- |
| `yishan-fullstack-ci.yml` | 53-55 | `All branch includes main` → `pnpm branch:check:all-sync` |
| `yishan-fullstack-cd-fc.yml` | 48 | `Verify all includes main` |
| `yishan-fc-migrate.yml` | 41 | `Verify all includes main` |

底层脚本 `scripts/arch/check-all-sync.mjs` 用 `git merge-base --is-ancestor origin/main HEAD` 强制 all 包含 main。

## 6. Drizzle 当前状态（main）

```
apps/yishan-api/drizzle/0000_initial.sql     29 个 CREATE TABLE
```

表前缀分布：全部 `sys_*`。**main 上没有 portal_/shop_**——这些只在 `all` 分支存在，因此阶段 D 的"从 Core 移除业务表"在 main 上是 no-op。

## 7. 部署默认值（FC3 / Qiniu）

| 类别 | 路径 | 默认值 |
| --- | --- | --- |
| 地域 | `.github/workflows/yishan-fullstack-cd-fc.yml:238` | `cn-shanghai` |
| 层名 | `.github/workflows/yishan-fullstack-cd-fc.yml:239` | `yishan-api-runtime-layer` |
| Access alias | `.github/workflows/yishan-fullstack-cd-fc.yml:240` | `enterprise` |
| Qiniu 工具 | `.github/workflows/yishan-fullstack-cd-fc.yml:107` | `qiniu/qshell` 直链下载 |
| 部署脚本 | `apps/yishan-api/deploy/fc3/scripts/*.sh` | 5 个 |
| 模板 | `apps/yishan-api/deploy/fc3/templates/{function,domain,runner}.yaml` | 3 个 |
| 证书 | `apps/yishan-api/deploy/fc3/certs/{private.key,fullchain.cer}` | checked-in 私钥 ⚠️ |

根脚本 `package.json:13` 的 `build:admin:fc` 把 admin dist 强写 `apps/yishan-api/public/admin/`，耦合 API 与 Admin 发布。

## 8. 根 package.json 脚本（节选）

```text
build                            // tiptap + admin + docs
build:admin / build:api / build:app / build:app:h5 / build:docs / build:tiptap
build:admin:fc                   // 含 cp 到 public/admin（耦合发布）
verify                           // arch + db:gen:test + openapi:check + 5 项 ts/test/build
arch:check / arch:check:{routes,manifest,boundaries}
branch:check:all-sync
db:{generate,init,seed,reset}
openapi:check
lint / lint:{admin,docs}
```

engines：`node >=20.0.0`、`pnpm >=8.0.0`（**没有 .tool-versions / .nvmrc**，CI 与本地都可能漂移）。

## 9. 其他需要后续阶段处理的次要面

- `apps/yishan-api/scripts/generate-drizzle-schema.mjs` 当前从 `apps/yishan-api/drizzle/*.sql` 生成 schema；阶段 D 改为读 `drizzle/core/*.sql + plugins/<v>/<s>/migrations/*.sql`。
- `apps/yishan-api/src/cli/openapi-generator.ts` 当前按 `/api/v1/admin/<resource>` 与 `/api/modules/<m>/v1/admin/<r>` 两类拼 resource；阶段 E 改为读 `plugin-catalog.json`。
- Admin `gen:plugin-routes` 脚本（`apps/yishan-admin/scripts/generate-plugin-routes.mjs`）当前扫 `src/plugins/modules/*.manifest.ts`，阶段 B 改为读 catalog。
- App 当前仅硬编码 `/api/modules`（`apps/yishan-app/src/config.ts:14`），与新前缀模型不兼容；阶段 E 需要换源。
- `apps/yishan-api/deploy/fc3/certs/*` 提交了私钥证书，阶段 E 必须从仓库清出（即便本次不动部署逻辑）。

## 10. 现状评分（baseline）

| 项 | 评分 | 备注 |
| --- | --- | --- |
| arch:check | ✅ 全绿 | 0 violation（routes/manifest/boundaries）|
| 双 manifest 风险 | 🔴 高 | API/Admin 字段不对齐（§2.3）|
| `/api/modules` 耦合面 | 🟡 中 | 9 处（§3）；cli + openapi 是大头 |
| Prisma 文档残留 | 🟡 中 | 9 个文件 / 多处（§4）|
| ancestry 检查 | 🔴 高 | 3 个 workflow + 1 个脚本（§5）|
| 部署默认值硬编码 | 🔴 高 | 5 处 + checked-in 私钥（§7）|
| Node/pnpm 版本统一 | 🟡 中 | 无 .tool-versions，CI 用 22.22.1 与 engines `>=20` 不一致 |
| 测试对插件前缀的耦合 | 🟢 低 | 仅 1 个测试（§3）|

下一刀：7 份 ADR 落在 `decisions/`，决定插件 SDK、gate 模型、verify DB、OpenAPI 布局、hello 归属、provider secret 流转。