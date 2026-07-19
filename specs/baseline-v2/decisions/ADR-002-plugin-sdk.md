# ADR-002：插件 SDK 包结构与 manifest 形态

- 状态：Proposed（阶段 B 起生效）
- 日期：2026-07-19
- 取代：`apps/yishan-api/src/plugins/modules/<name>/manifest.ts` + `apps/yishan-admin/src/plugins/modules/<name>.manifest.ts` 双 manifest
- 影响：`packages/plugin-sdk`（新）、`plugins/<vendor>/<slug>/plugin.ts`（新目录）、schema/CLI/arch 检查

## Context

main 分支现状（INVENTORY §2）：hello 插件在 API 与 Admin 两端各有一份 manifest，字段不对齐（API 侧有 `pluginId / dbNamespace / permissions / menus / channels / routeBase`，Admin 侧只有 `name / version / coreCompatibility / routes`）。`system.manifest.ts` 名实不符，实际是 Core 系统管理页面的 admin 路由声明。任何对 hello/pluginId/dbNamespace 的字段调整都需要双端同步，且容易漏字段。

## Decision

1. **新增 `packages/plugin-sdk`**：monorepo 私有包，导出 `definePlugin()`、`PluginManifest` 类型、`validateManifest()`、`profileParser()`、`catalogGenerator()`。**不发到 npm**——保持单仓单源；下游客户项目通过 pnpm workspace / path alias 引用。
2. **唯一 manifest 路径**：`plugins/<vendor>/<slug>/plugin.ts`，例如 `plugins/yishan/hello/plugin.ts`。
3. **id 不可变**：`id = <vendor>/<slug>`，与目录、包名、migration 命名空间、API 前缀绑定，禁止拆分。
4. **manifest 形态**（TypeScript-first，由 SDK 提供类型校验）：

   ```ts
   import { definePlugin } from '@yishan/plugin-sdk'

   export default definePlugin({
     id: 'yishan/hello',
     version: '1.0.0',
     coreVersion: '^2.0.0',
     api: { prefix: '/api/plugins/yishan/hello/v1' },
     database: { namespace: 'ys_hello' },
     permissions: [/* structured perms */],
     menus: [/* declarative menu defs with channel */],
     admin: { routes: () => import('./admin/routes') },
     migrations: './migrations',
     seed: './seed',
   })
   ```

5. **目录硬性约定**（由 SDK 的 `validateManifest()` 强制）：

   ```text
   plugins/<vendor>/<slug>/
   ├── plugin.ts
   ├── api/{routes,services,repositories,schemas}/
   ├── admin/{pages,routes.ts}
   ├── app/                      (可选)
   ├── migrations/
   ├── seed/
   └── tests/
   ```

6. **Core admin 路由从 plugins/modules 拆出**：新建 `apps/yishan-admin/src/core/routes.ts`，包含现有 `system.manifest.ts` 内的 5 条 system/* 路由；不再以"插件 manifest"形式存在。
7. **`@yishan/plugin-sdk` 的发布方式**：先在 monorepo 内通过 workspace protocol 引用；阶段 F 末尾如果客户项目有跨仓需求，再考虑发 npm。**v2.0.0 之前不外发**。

## Consequences

正向：

- 单 manifest 即驱动 API route、Admin route、OpenAPI、DDL、permission catalog、菜单生成；arch 检查可在 CI 上一次跑过。
- 字段不对齐、双 manifest 漂移这类回归被 manifest 类型签名堵死。
- `coreVersion` semver 校验可以在构建期拒绝不兼容插件装载。

负向 / 风险：

- 阶段 B 需要在 SDK 还不稳定时推进 hello 迁移；缓解：阶段 A 先建 SDK 空壳与 hello 旧 manifest 共存，阶段 B 一次性替换。
- 把 `system.manifest.ts` 改为 `core/routes.ts` 是一个语义切换，可能影响 admin `gen:plugin-routes` 的产物；需要在迁移前后各跑一次 verify 截图对比。
- 客户项目若想自定义 SDK 行为（如新增字段），目前没有扩展点；先不解决，等 v2.1 反馈。

## 验收

- `rg "\.manifest\.ts" apps/yishan-api/src apps/yishan-admin/src` 零命中；
- `find plugins -maxdepth 3 -name plugin.ts | wc -l` 等于 `cat profiles/*.yaml | grep -c id:`；
- `pnpm arch:check` 在 baseline-v2 与 baseline 输出一致（routes/manifest/boundaries 均 0 violation）；
- 任一 `plugin.ts` 缺失字段或字段类型错误，`pnpm plugins:catalog --profile core` 失败且指出文件与行号。