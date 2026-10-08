# P0-1 环境与工程结构基线

执行日期：2026-10-08。全部命令在隔离 worktree 中执行；未修改共享 checkout。

## 1. Git 状态与保护措施

| 项 | 值 |
|---|---|
| 共享 checkout `yishan/` | 分支 `all`，HEAD `e4a08d3`。含**未跟踪**的 `docs/plans/*.md`、`docs/analysis/*.md`（本次只读取）；会话被限制在 worktree 内，未对共享 checkout 执行任何 git 命令，因此其完整未提交状态（含可能的移动端代码）**未盘点**，也未触碰 |
| 本 worktree | 原分支 `worktree-goofy-skipping-biscuit` @ `0dc03c7`（工作区干净，该提交已在 `main` 历史中）。为对齐 V2 评审基线，新建分支 **`p0/source-first-baseline` @ `all` `e4a08d3`**；原分支保持不动 |
| `main` | `6a5c62a`。通过 `git archive 6a5c62a` 导出到 `tmp/p0/main-src`（gitignored）后执行，不切换任何分支、不新增 worktree |
| `main...all` | `7 / 196`（`git rev-list --left-right --count`） |
| 其它 worktree | `.worktrees/core-main`（main）、`.worktrees/core-backport-safe`、`.worktrees/crm-customer-workspace`、`.claude/worktrees/{agent-a23a…, lively-leaping-nebula}`：均未触碰 |

未执行：`git reset --hard`、`git clean`、merge、push、commit。依赖安装使用 `--frozen-lockfile`，结束时 `git status --short` 仅显示本次新增文件，`pnpm-lock.yaml` 未变化。

## 2. 工具链

| 工具 | 要求 | 实际 |
|---|---|---|
| Node | `.tool-versions` 22.22.1；`engines >=20` | 22.22.1（fnm）。注意：本机 PATH 默认是 **24.20.0**，不显式切换会偏离锁定版本 |
| pnpm | `packageManager` 8.15.9 | 8.15.9 |
| Docker | — | 29.7.2；本机已有 `mysql-local`、`redis-local`、`postgres-local`（**未使用**） |
| OS | — | Windows 11 Pro 26200，Git Bash；CI 为 ubuntu-latest |

## 3. Workspace 与 Package

`pnpm-workspace.yaml`：`apps/**`、`packages/**`，排除 `**/example/**`、`**/dist/**`、`**/build/**`。

| 目录 | 包名（all） | 包名（main） | 框架 / 关键依赖 | 模块格式 / 构建 |
|---|---|---|---|---|
| `apps/yishan-api` | `yishan-api` | 同 | Fastify ^5、drizzle-orm 0.44.7、drizzle-kit 0.31.10、mysql2 3.15.3、@fastify/jwt ^10、TypeScript ~5.8、Vitest ^4 | `type: commonjs`；`tsc`（`module: commonjs`、`target: ES2020`）+ `tsc-alias`；`build:ts` 先执行 `scripts/gen-module-tsconfig.mjs`（排除 `meta.enabled=false` 的模块） |
| `apps/yishan-admin` | `yishan-admin` | 同 | @umijs/max ^4.6（mako 打包）、React ^19.2、antd ^6.4、pro-components ^3.1、Jest ^30、Biome ^2.5、TypeScript ^6.0 | `prebuild`/`prelint` = `max setup`（生成 `.umi/`，Jest 也依赖） |
| `apps/yishan-app` | `yishan-app` | 同 | Taro ^4、React ^18.3、TypeScript ~5.4、Biome ^2.4 | `taro build --type weapp`；**无测试脚本** |
| `apps/yishan-docs` | `yishan-docs` | 同 | Docusaurus 3.9.2、React ^19、TypeScript ~5.6 | `docusaurus build`；`typecheck` = `tsc` |
| `apps/yishan-components/yishan-tiptap` | **`@zerocmf/yishan-tiptap`** 0.0.1-dev.0 | **`yishan-tiptap`** | @tiptap/react ^3.8、Rollup ^4 | `type: module`；Rollup 输出 CJS + ESM + d.ts + css 到 `dist/` |
| `packages/shared-config` | `@yishan/shared-config`（private） | 同 | — | ESM，`main: ./src/index.ts`，source-only，无构建 |

Workspace 依赖：admin → `@yishan/shared-config`、tiptap（all：`@zerocmf/yishan-tiptap: workspace:^`；main：`yishan-tiptap: workspace:^`）；app → `@yishan/shared-config`；API 无 workspace 依赖（Admin/App 通过 HTTP 消费 API）。

## 4. 构建顺序与预生成要求（已实测）

1. **TipTap 必须先构建**：在 main 导出副本中临时移走 `dist/` 后 `pnpm --filter yishan-admin build` 失败：`Can't resolve 'yishan-tiptap/index.css'`（`src/global.tsx:4`），退出码 1。
2. **Admin 需要 `max setup`**：lint/build 通过 pre-hook 自动执行；`jest` 无 pre-hook，CI 显式先执行 setup。
3. **API 需要 `build:ts`** 才能启动（`fastify start dist/app.js`）、执行 `db:seed`、onboard 与 runner。
4. `pnpm --filter yishan-tiptap` 在 all 上可匹配 scoped 包 `@zerocmf/yishan-tiptap`（实测构建成功）。

## 5. 脚本与 CI 的现状差异（已实测）

| 项 | 结果 |
|---|---|
| 根 `pnpm build` | 只含 tiptap → admin → docs，**不含 API**（两分支相同）；API 需显式 `pnpm build:api` |
| CI `pnpm --filter yishan-admin gen:plugin-routes` | 两分支都没有该脚本；pnpm 输出 `None of the selected packages has a "gen:plugin-routes" script` 且**退出码 0**——步骤恒绿、无作用 |
| CI 安装 `--no-frozen-lockfile --force` | 本地 `--frozen-lockfile` 在两分支均成功 → 锁文件当前一致；CI 参数只会掩盖未来的漂移 |
| CI paths | 不含 `packages/**`、`scripts/**`、`.tool-versions`、`apps/yishan-app/**`、`apps/yishan-docs/**` |
| CI 数据库 | all：独立 MySQL/Redis service，执行 Core `db:generate` + `db:migrate`，**无模块迁移**；main：从 **仓库 secrets**（`YISHAN_API_DATABASE_*`）写 `.env`，只执行 `db:generate`，无 migrate、无启动检查 |
| `check-main-baseline.mjs` | 按分支名决定是否执行（`GITHUB_BASE_REF`/`GITHUB_REF_NAME`/git）；非 main 直接跳过。以 `GITHUB_REF_NAME=main` 在 all 上执行会报 `发现非法模块目录: crm, portal, shop` |
| `check:openapi` | 仅 all 有；它比较 HEAD 与工作区文件，**单独运行时恒为 in sync**，必须先 `openapi:dump` 才有意义 |
| CD | 两分支的 `yishan-fullstack-cd-fc.yml` 都只在 push 到 **`all`** 时部署；`yishan-fc-migrate.yml` 仅 `workflow_dispatch` |

## 6. 分支间模块范围

| | API 模块（`meta.enabled`） | Admin 模块页面 | 运行时挂载 |
|---|---|---|---|
| all | crm（false）、demo、portal、shop | crm、demo、portal、shop | demo、portal、shop |
| main | demo | demo | demo |

运行时 crm 被跳过的实际路径：`dist/` 不含 crm（`gen-module-tsconfig` 排除）→ 回退 `import('src/modules/crm/module.ts')` 在 CJS 运行时失败 → 日志 `failed to import src module.ts` + `module skipped: meta.id missing`。结果正确，但依赖导入失败而非读取 `meta.enabled`。
