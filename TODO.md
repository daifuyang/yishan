# TODO

当前待办。已完成或失去目标的 TODO 统一归档到 [`docs/engineering/archive/todos/`](./docs/engineering/archive/todos/)。

## 抽取「作用域详情」的生命周期守卫

- **涉及**：9 个详情页 —— `apps/demo/app/src/pages/profile/login-log/detail/index.tsx`、
  `apps/demo/app/src/pages/system/login-log/detail/index.tsx`、`apps/demo/app/src/pages/system/attachments/detail/index.tsx`、
  `apps/demo/app/src/pages/demo/todos/detail/index.tsx`、`apps/demo/app/src/pages/system/position/detail/index.tsx`、
  `apps/demo/app/src/pages/system/user/detail/index.tsx`、`apps/demo/app/src/pages/system/role/detail/index.tsx`、
  `apps/demo/app/src/pages/system/dept/detail/index.tsx`；另有一份在
  `apps/demo/app/src/pages/system/_shared/MenuDetailScaffold.tsx`（业务命名的策略，已被两个页面消费，与上面九份不同层）。
- **问题**：`load() + active() + sequence + session + useDidHide/useDidShow` 这段守卫被逐页复制，改一处要改十处。
- **下一步**：从真正相同的只读三件套（两个 login-log detail + attachments detail）开始，再回答那个未决的设计问题：
  抽一个 `useScopedDetail` hook 垫在 scaffold 之下，还是把全部页面迁到 scaffold 上？带写操作的页面（todos / position /
  attachments）入口守卫要多判 `|| locked.current`，并且各自带 `active()` 供提交时复用；`system/module-management/detail`
  的形状确实不同，不适合并入。

## 用户列表的 summary 也要按状态收口

- **涉及**：`apps/demo/app/src/pages/system/user/index.tsx:241`。
- **问题**：`summary={list.length ? `共 ${total} 位成员` : undefined}` 与刚在个人登录日志列表修掉的是同一个模式：
  错误态已经把行藏起来了，底部还在报一个总数。
- **下一步**：改用 `kind === 'ready'` 守卫，与 profile 登录日志列表保持一致。

## 把登录日志的浏览器场景收进 `apps/demo/app/tests/browser/`

- **涉及**：`apps/demo/app/tests/browser/`。
- **问题**：登录日志列表 / 详情没有提交过的浏览器脚本；质量门当时写通的那份放在 gitignore 的 `tmp/` 里，用完就删了，
  下一个人得从零再写一遍。该 harness 没有统一端口，每个脚本各自硬编码来源（`21003` / `21803` / `21813` / `21823` /
  `21824`），而 `apps/demo/app/README.md:103` 只写 `21803`，已经过时。
- **下一步**：把登录日志列表（含客户端筛选）与详情的场景补成提交过的脚本，并顺带修正 README 的端口说明。

## 架构基线 OpenAPI 缺少漂移检查

- **涉及**：`docs/architecture/api-v1-runtime-openapi.json`、`scripts/check-openapi-drift.mjs`。
- **问题**：CI 的 dump 只重写 `apps/demo/api/openapi.json`，架构基线这份没有任何检查。
- **下一步**：给基线加同一条 canonical 漂移检查。

## `packages/core-contracts` 的 minimatch 类型错误（TS2688）

- **涉及**：`packages/core-contracts` 及其它声明了 tsconfig 却没写 `"types"` 数组的包。
- **问题**：无 index 的 `@types/minimatch@6.0.0` stub 被隐式包含，报 `TS2688: Cannot find type definition file for
  'minimatch'`，连带 `pnpm build:api`、`pnpm test:api`、`pnpm test:integration`、`pnpm typecheck:api`、
  `pnpm typecheck:mobile` 和两个 docs typecheck 一起失败。
- **下一步**：按已裁定的绕过办法在包内跑 `pnpm --filter <pkg> exec tsc --noEmit --types node`（必须在包内跑：
  根 `node_modules/.bin/tsc` 是 TypeScript 6.0.3）；根治要补 `"types"` 声明或换掉这个 stub。

## 新登录日志路由没有 403 覆盖

- **涉及**：`packages/core/system-api/test/my-login-log.routes.test.ts:37`。
- **问题**：`requirePermission` 被 stub 成 no-op，因此没有任何用例断言「缺少 `app:user:my-logins` 的调用方拿 403」。
- **下一步**：补一个 403 用例。风险低（`access` 对象与列表路由逐字相同），但这是新路由唯一留给推断的安全面。
