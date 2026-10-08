# Yishan 源码分发与选择性升级（Source-First）

Yishan 的公共代码以**源码**交付：你复制它、拥有它、可以直接修改或删除，并且能选择性地合并上游后续的改动。没有在线 Registry，没有黑盒包；升级的基线就是上游的 Git commit。

本文分三部分：源码边界（复制什么、能改什么）、获取源码、选择性升级。可执行的工具只有一个约 150 行、只编排 Git 命令的脚本 `scripts/yishan-upstream.mjs`。

---

## 1. 源码边界

`apps/yishan-api/src` 按“谁依赖谁”分为五层。边界由 `pnpm check:boundaries`（`scripts/check-architecture-boundaries.mjs`）在 CI 中执行，当前**零已知违规**。

| 层 | 路径 | 职责 | 规则 |
|---|---|---|---|
| kernel | `core/module-loader/`、`core/permissions/`、`core/auth/`、`core/routes/route-registrar.ts`、`core/module-api.ts` | 模块生命周期、权限目录、身份/权限契约、路由注册 | 不依赖 system；只用相对导入（可整体搬成包） |
| platform | `core/plugins/external/`、`db/` | Fastify 官方插件装配（jwt、cors、swagger、redis…）、连接与 schema | 不依赖 system |
| system（默认实现） | `core/services/`、`core/repositories/`、`core/schemas/`、`core/mappers/`、`core/routes/api/`、`core/routes/_dev/`、`core/plugins/app/`、`scripts/` | 用户、角色、菜单、PAT、附件……以及默认 `AuthProvider` | 可替换；可以依赖 kernel / platform |
| module | `modules/<id>/` | 业务能力 | 只能导入 `core/module-api`、`core/system-api`；不得导入其他模块 |
| app | `app.ts`、`config/` | 组合根：选择 `AuthProvider`、装配顺序、环境变量 | — |

模块可用的稳定入口：

- `core/module-api.ts`（kernel 契约，纯重导出）：`registerPermissions`、`registerPermissionGroups`、`createRouteRegistrar`、`ResponseUtil`、`BusinessError`、`AppDb`/`AppTx`/`AppQueryDb`、`Principal`、`ModuleMeta`、`ModuleSeedContext`。
- `core/system-api.ts`（system 对模块开放的能力）：`seedModuleMenus`。
- 运行时依赖走 Fastify 原生：`app.drizzleDb`、`request.currentUser`、`request.log`。

### 替换身份与权限来源

jwt-auth 与 rbac 只依赖 `core/auth/identity.ts` 中的 `AuthProvider`（三个函数：`resolveSession`、可选的 `resolveApiToken`、`loadPermissions`）。在 `app.ts`（或 `fastify.register(app, { authProvider })`）传入你自己的实现即可接入 SSO / 外部用户中心，模块与 kernel 不需要改动。替换后删除 `core/services/auth-provider.ts` 中对 `CurrentUser` 的声明合并。契约测试：`apps/yishan-api/test/auth-provider.contract.test.ts`。

### 为什么不是独立 npm / workspace 包

经原型验证（`docs/verification/yishan-source-first-final.md` §3）：

- API 以 `tsc`（CommonJS，`rootDir: src`）构建；直接引用源码包会报 TS6059（文件不在 rootDir 内）。
- 预构建的包可行，但要增加包构建/监听步骤，且 FC 运行时层用 `npm install` 安装依赖，无法解析 `workspace:*`。
- Yishan 仓库内只有一个服务端消费者，包化不减少任何重复。

因此 kernel 保持在 App 内，但以“可包化约束”维护（零 `@/`、不依赖 system，由 `kernel-alias-import` / `kernel-imports-system` 规则保证）。满足任一条件时再提取为一个 source-only 包（候选名 `@yishan/server-kernel`）：同一仓库出现第二个服务端进程；某个下游（如在一个仓库里有两个 Yishan 派生服务端）确认要共享同一份 kernel；有项目要求以 npm 依赖方式使用 kernel。

---

## 2. 获取源码

在你的仓库中（干净工作区）：

```bash
# 1. 取得上游某个版本的服务端源码（示例：放到 server/）
git fetch https://github.com/daifuyang/yishan.git main
git archive --format=tar --prefix=server/ FETCH_HEAD:apps/yishan-api | tar -x
cp <yishan>/scripts/yishan-upstream.mjs scripts/

# 2. 删除不需要的业务模块（例如 demo），并在来源标记里排除它
rm -rf server/src/modules/demo
```

在仓库根目录写来源标记 `YISHAN_UPSTREAM.json`（与代码在同一个提交里）：

```json
{
  "repo": "https://github.com/daifuyang/yishan.git",
  "base": "<刚才 FETCH_HEAD 的完整 sha>",
  "pathMap": { "apps/yishan-api": "server" },
  "exclude": ["apps/yishan-api/src/modules/demo", "apps/yishan-api/openapi.json", "apps/yishan-api/deploy"]
}
```

- `pathMap`：上游路径 → 你的路径，可以有多条（例如再映射 `packages/yishan-tiptap`）。
- `exclude`：你删除的、或决定完全接管不再跟进的上游路径。
- 之后的构建、测试、运行与上游仓库无关（标记只是元数据）。

建议同时提交 `.gitattributes` 中的 `*.sql text eol=lf`：Drizzle 记录的迁移 hash 是 SQL 原始字节的 sha256，Windows 自动换行转换会让 hash 与其他环境不同。

---

## 3. 选择性升级

```bash
node scripts/yishan-upstream.mjs status --to main   # 预览：上游提交、变更文件；标出你本地也改过的文件
node scripts/yishan-upstream.mjs diff   --to v1.2.0 # 输出将应用的补丁（已按 pathMap / exclude 过滤）
node scripts/yishan-upstream.mjs apply  --to main   # 在新分支 yishan-upgrade/<sha> 上三方合并
```

`apply` 的保证：

| 情况 | 行为 |
|---|---|
| 工作区不干净 | 拒绝执行（退出码 1） |
| 你没改过的文件 | 直接更新；新增文件直接添加；上游删除的文件同步删除 |
| 你改过的文件 | `git apply --3way`：不同区域自动合并；同一处修改留下冲突标记（`ours` = 你的，`theirs` = 上游），**从不静默覆盖** |
| 你删除了但没排除、上游又修改的文件 | 整个补丁不应用，自动回到原分支并删除升级分支（退出码 1）；把该路径加入 `exclude` 或手工移植 |
| 无冲突 | 代码 + 新的 `base` 在一个提交里（退出码 0） |
| 有冲突 | 退出码 2；解决后 `git add` + `git commit`（标记文件已暂存） |

回滚：升级分支未合并时 `git reset --hard && git switch <原分支> && git branch -D yishan-upgrade/<sha>`；已合并时 `git revert <升级提交>`。

升级之后：

1. 阅读上游变更说明中的 `MIGRATION` / `CONTRACT` 条目（文本无冲突 ≠ 行为兼容）。
2. 运行你的 lint / test / build。
3. 迁移：`pnpm db:migrate:all`（每条迁移流独立历史表，执行后核对历史与真实表结构）。生产库先在副本上演练。

### 下游数据库约定

- 不要在上游模块（或 Core）的 journal 中追加你自己的迁移；在你自己的模块里写前向迁移（它有自己的 `<id>_drizzle_migrations`）。
- 已发布的 SQL 永远不改（`pnpm check:migrations` 会拦截）。
- 从旧版本（所有迁移共用 `__drizzle_migrations`）升级的已部署库：先 `db:migrations:bridge`（默认 dry-run，只读），人工核对报告与备份后再 `-- --apply`。详见 `docs/verification/yishan-source-first-final.md` §5。

### 已知限制

- Git 配方不识别下游的重命名/移动：移动过的文件请在 `pathMap` 增加映射，或排除后人工跟踪。
- 上游重命名在补丁中表现为“删除 + 新增”（`--no-renames`），你对旧文件的定制需要手工迁到新文件。
- 只有当这套流程被反复使用、且出现重复的手工错误时，才值得扩展工具；工具不做自动解冲突。
