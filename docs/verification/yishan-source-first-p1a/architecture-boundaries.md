# P1-A5 最小架构边界守卫

只建立检测能力；P1-A 未移动、修改任何 Core/Module/System 源码。

## 1. 实现

`scripts/check-architecture-boundaries.mjs`（纯 Node，无新依赖），接入 `pnpm lint` 与 CI 的 “Lint and guards” 步骤；测试 `scripts/check-architecture-boundaries.test.mjs`。

| 规则 | 检测内容 | 范围 |
|---|---|---|
| `core-imports-module` | `src/modules/` 之外的源码 import 解析到 `src/modules/**`（相对路径与 `@/`、`@modules/` 别名都解析） | `apps/yishan-api/src`、`apps/yishan-admin/src` |
| `cross-module-import` | `src/modules/<a>` import 了 `src/modules/<b>` | 同上 |
| `package-imports-app` | `packages/**`、`apps/yishan-components/**` import 了 `apps/<app>/` 内文件，或以包名引用 `yishan-api/admin/app/docs` | 共享包 |
| `business-literal` | 公共代码的字符串字面量中以独立 token 出现业务模块 id（权限码前缀、URL、Swagger tag、i18n key、import 路径、联合类型字面量） | API 与 Admin 的 `src/modules/` 之外 |

- 业务模块 id = 两个 App 的 `src/modules/*` 目录 + 已知业务模块 `crm`、`portal`、`shop`（main 上已移除，但不得回流到公共代码）。
- 先去注释再匹配，注释中的模块名不计；`shopping`、`ShoppingBag` 等不构成独立 token，不误报。
- 跳过：`node_modules`、`dist`、`.umi*`、`generated`、`test(s)`、`__tests__`、`mocks`、`*.test.*`、`*.d.ts`（生成客户端由 OpenAPI 门禁覆盖）。
- 违规 key 不含行号：`<rule>|<file>|<detail>`。

## 2. 基线（现有问题，不放宽规则）

`scripts/baselines/architecture-boundaries.json`，每项必须带 `reason`（含预计处理阶段）：

- 新违规 → `[boundaries] NEW violation` 退出码 1；
- 基线中已消失的违规 → `violation no longer present, remove from baseline` 退出码 1（防止修复后悄悄回归且基线腐化）；
- `reason` 缺失或为 TODO → 退出码 1；
- 不存在全局关闭开关；有意变更需 `--update` 后在 PR 中审阅 diff。

当前 main 的 24 项（全部为 `business-literal`；import 类规则 0 违规）：

| 文件 | 数量 | 内容 | 处理阶段 |
|---|---|---|---|
| `apps/yishan-api/src/core/schemas/api-token.ts` | 2 | `Type.Literal("shop")`、`Type.Literal("portal")` — PAT 分组 | P1-B（R-04，同时修复 available-scopes 500） |
| `apps/yishan-api/src/core/services/api-token.service.ts` | 2 | `ScopeSystem = "system" \| "shop" \| "portal" \| "special"` | P1-B |
| `apps/yishan-api/src/core/routes/api/v1/me/api-tokens/index.ts` | 2 | OpenAPI 描述“按 system/shop/portal/special 分组” | P1-B |
| `apps/yishan-api/src/core/plugins/external/swagger.ts` | 2 | 全局 tag `demo` 及其描述 | P1-B（tag 由已挂载模块生成） |
| `apps/yishan-api/src/scripts/seed/config.ts` | 4 | 导入 `./config/portal-*.json`（Core seed 中无消费者的门户数据） | P1-B |
| `apps/yishan-admin/src/locales/{zh-CN,en-US}/menu.ts` | 12 | `menu.portal.*`、`menu.system.demo-documents`（main 上未发现静态引用） | P1-B |

与 P0/V2 的对照：V2 列出的 `BYPASS_CODES` 中的 `crm:public-quote:view` 与 Swagger `crm` tag 只存在于 all，main 上不存在（守卫已在 main 上确认 0 项）。

## 3. 验证证据

| 命令 | 结果 |
|---|---|
| `node scripts/check-architecture-boundaries.mjs --json`（建立基线前） | 24 项，与只读子代理独立盘点结果一致（import 类 0 项） |
| `node scripts/check-architecture-boundaries.mjs` | `ok (24 known violation(s) tracked …)`，退出码 0 |
| `node --test scripts/check-architecture-boundaries.test.mjs` | 2/2 通过：夹具中四条规则各触发一次；注释、测试文件、`ShoppingBag/shopping` 不触发 |

## 4. 已知局限

- 基于正则的 import 提取与字符串匹配，不是完整 AST；能覆盖本仓库的写法（静态/动态 import、`require`、`export … from`），模板字符串拼接的动态路径无法解析（目前只有 Admin `plugin.ts` 在构建期生成模块组件映射，不在扫描范围）。
- 不检查“模块只能经由 `core/module-api.ts` 访问 Core”这类正向约束——该入口尚不存在，属于 P2。
- API 与 vitest 配置里的 `@modules → src/plugins/modules` 别名指向不存在的目录（无人使用），守卫不解析该别名；记录于 known-issues.md。
