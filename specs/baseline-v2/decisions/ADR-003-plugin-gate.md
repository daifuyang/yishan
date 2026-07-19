# ADR-003：插件装载与 gate 模型

- 状态：Proposed（阶段 C 起生效）
- 日期：2026-07-19
- 取代：`apps/yishan-api/src/server.ts` 中 `@fastify/autoload` 对 `apps/yishan-api/src/plugins/modules/*` 的目录扫描
- 影响：API server 启动顺序、Core boot 流程、disabled 插件的语义、生成物校验

## Context

main 当前通过 `@fastify/autoload` 扫描 `apps/yishan-api/src/plugins/modules/<name>`，把每个目录注册成一个 Fastify 子插件（INVENTORY §2.1）。问题：

1. 目录存在即被装载，无法表达"该插件不在此 profile 中"。
2. 没有"运行时启停"模型——数据库把 `sys_plugin.lifecycle_state` 改成 `disabled`，但已注册的 routes 仍然可访问，需要 route 内手写 `if (state !== 'enabled') return 404` 才能挡掉。
3. 任务、cron、event handler 与 HTTP routes 是独立注册路径，没有统一 gate。

## Decision

1. **取消对 plugins 目录的 AutoLoad**：`server.ts` 只 AutoLoad `core/routes/**`；插件 routes 由 `plugin.register(app)` 显式调用。
2. **profile → catalog → register 链**：

   ```text
   profiles/<name>.yaml
       ↓ (build-time)
   plugin-catalog.json        // 不可手改、gitignored 或 committed as artifact
       ↓ (boot-time)
   Promise.all(profile.plugins.map(p => p.register(app)))
   ```

3. **每个插件暴露 `register(app)`**：`api/routes/**` 内部以 Fastify sub-app 形式注册；Core 在调用 `register` 前先包一层 `pluginGate(pluginId)` Fastify preHandler：

   ```ts
   fastify.addHook('preHandler', async (req) => {
     const state = await loadPluginState(req.pluginId)
     if (state !== 'enabled') throw new PluginDisabledError(req.pluginId)
   })
   ```

4. **gate 覆盖面**：API routes、cron worker、event subscriber、admin 后台任务入口；菜单与权限目录仅枚举 `enabled && selected` 的插件（与 OpenAPI exporter 共享同一过滤函数）。
5. **不允许目录存在但 profile 未选**：catalog 生成阶段扫描 `plugins/<v>/<s>/plugin.ts`，profile 未引用的插件直接不进 catalog；目录存在与否对运行时不可见。
6. **gate 在 boot 期完成 setup**：测试 `admin.system.plugins.routes.test.ts` 的 buildApp 模式仍然适用——单测里直接调 register，但需自己 stub `pluginGate` 或使用默认 enable。

## Consequences

正向：

- profile 是 API 路由表的唯一来源；CI 可在不启动 server 的情况下 grep catalog 校验路由集合。
- "禁用 = API 404 + 任务不跑 + 菜单不返"语义统一，不再依赖手写 route 内分支。
- 单元测试可以直接验证"catalog 外的插件不会被装载"。

负向 / 风险：

- 取消 AutoLoad 后，Fastify encapsulation 默认行为改变：每个 `register` 创建独立上下文，跨插件共享 decorator 需要在 catalog boot 阶段显式 `app.decorate`；阶段 C 需要重新审视 `fastify.pluginRuntime` / `fastify.authenticate` 这类 decorator 的注册时机。
- `pluginGate` preHandler 必须快（不能每个请求都查 DB）；用 in-memory `Map<pluginId, state>` + 启动时预热 + 状态变更时 invalidate。
- 与现有"plugin menu sync service"（`apps/yishan-api/src/core/services/plugin-menu-sync.service.ts`）的"DB state 是真理"语义要协调：gate 的缓存必须由 DB state 变更事件驱动，不能独立漂移。

## 验收

- `rg "autoload.*plugins" apps/yishan-api/src/server.ts` 零命中；
- 集成测试：把 hello 设 disabled 后，`GET /api/plugins/yishan/hello/v1/admin/...` 返回 404；
- 单元测试：catalog 不含 hello 时，`pnpm plugins:catalog --profile core` 生成的 JSON 不含 hello，server.ts 装载它也不会出现任何 hello 路由；
- 没有在 profile 里的插件，OpenAPI spec 不出现它的 tag/path/schema（与 ADR-005 共同验收）。