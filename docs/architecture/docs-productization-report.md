# Docs Productization Migration Report

## Status

**PASS WITH RESTRICTIONS**

Yishan 的文档站已成为独立的 `apps/docs` 产品，根 `docs/` 保留工程治理资产。现有 Docusaurus、React、主题、公开 URL、API/Admin/App/Core 架构均保持稳定，没有执行发布、推送、生产数据库操作或业务代码重构。

限制来自外部验收状态：本分支未推送，因此 GitHub Actions 没有针对本次改动重跑；本地根测试仍保留 14 个需要数据库条件的历史跳过项（`packages/core/database` 13 个、Demo API 1 个）。旧远端提交 `3a23494` 的 CI 失败发生在 Admin CRM `QuoteDetailModal` 测试，与本次 Docs 改动无关。

## Directory changes

迁移前的 `apps/yishan-docs` 已整体移动为 `apps/docs`，没有保留转发目录：

```text
apps/docs/
├── app/pages/              首页和产品页面
├── app/css/                原全局主题样式
├── components/             文档站 React 组件
├── config/                 Docusaurus 配置和侧栏
├── content/                产品文档 Markdown/MDX
├── public/                 原 static 资源
├── package.json            @yishan/docs
└── README.md
```

Docusaurus 通过 `docs.path=content`、`pages.path=app/pages`、`staticDirectories=[public]` 和 `config/docusaurus.config.ts` 工作。原 `/docs/...`、`/img/...`、`https://docs.zerocmf.com`、主题和 CSS 保持不变。站点保留原有 43 篇文档，并增加已分类的 15 篇 CRM 产品规格和 1 篇模块接入指南。

根目录现在按治理职责组织：

```text
docs/
├── architecture/           架构、边界、文档系统和迁移报告
├── adr/                    Product-First、Core、Taro 决策记录
├── engineering/            开发、测试、发布、编码、历史和验收记录
└── contributing.md         Contributor Guide 正文
```

原 `CONTRIBUTING.md` 保留为 GitHub 入口，指向 `docs/contributing.md`。产品内容从 `docs/products`、`docs/module-onboarding.md` 进入站点；治理规范从站点正文归档到根 `docs/engineering`，原公开 URL 保留为权威来源链接，避免维护两份正文。历史计划、设计、审计、截图和 PDF 进入 `docs/engineering/history|archive|verification`，不会被站点编译。

## Workspace and CI

- `apps/docs/package.json` 改名为 `@yishan/docs`，保留 Docusaurus 3.9.2、React 19 和既有生命周期；根命令和 CI 使用 `--filter @yishan/docs`。
- `pnpm-lock.yaml` 只修改了一个 importer 路径（`apps/yishan-docs` → `apps/docs`），依赖解析没有升级。
- `pnpm-workspace.yaml` 保留现有 workspace 范围，并显式排除 `apps/docs/content`、`app`、`components`、`config`、`public`，避免文档目录被误识别为包。
- Fullstack CI 的 push/PR path filter 增加 `apps/docs/**` 和治理 `docs/**`，并增加独立 Docs typecheck/build；其他 API、Admin、App、Package 步骤未改动。
- 没有修改部署工作流，不执行站点发布。产物仍为 `apps/docs/build`，可按既有站点托管流程人工发布。

## Boundary and ownership

`scripts/check-app-boundaries.mjs` 保留移动端规则，并增加 Docs 的产品隔离：Docs 可以使用公开 Package exports；共享包和其他产品不能依赖 Docs；Docs 不能导入其他产品；跨包相对路径、绝对路径和未公开 exports 会失败。测试新增后边界脚本测试为 **77/77**，脚本总测试为 **116/116**。

检查器覆盖 TS/TSX/JS/JSX、`import`、`export`、`import type`、字面量动态 `import()`、`require`、`require.resolve` 和 CSS/SCSS 字面量引用；它明确不解析 MDX 内嵌 import、计算表达式和任意自定义 alias，内容变更仍需真实构建与人工审查。

## Validation

| Check | Result | Evidence |
| --- | --- | --- |
| Frozen install | PASS | `pnpm install --frozen-lockfile`; 15 workspace packages discovered |
| Root typecheck | PASS | `pnpm typecheck` |
| Root lint | PASS WITH WARNINGS | `pnpm lint`; existing Admin files reported 21 Biome warnings, command exit 0 |
| Root tests | PASS WITH HISTORICAL SKIPS | `pnpm test`; 986 passed, 14 skipped database tests |
| Root build | PASS | `pnpm build`; mobile, WeApp, API, Admin and Docs completed |
| Docs typecheck | PASS | `pnpm --filter @yishan/docs typecheck` |
| Docs production build | PASS | `pnpm --filter @yishan/docs build`; static files generated in `apps/docs/build` |
| Boundary checks | PASS | `pnpm check:boundaries` |
| Script and boundary tests | PASS | `pnpm test:scripts` 116/116; boundary tests 77/77 |
| Development browser smoke | PASS | Homepage, quick start, CRM deep link, refresh, sidebar onboarding, governance links; no page errors or HTTP failures |
| Production browser smoke | PASS | `docusaurus serve` on port 4001 with same route coverage |
| Standalone artifact smoke | PASS | Build copied to an external temporary directory and served on port 4002; same browser route/refresh checks passed |
| Static artifact audit | PASS | 142 files, 60 HTML routes, no `.env`, source TypeScript, symlinks, governance routes or backend files |
| GitHub CI | PENDING | No push performed; old remote run for `3a23494` failed in Admin `QuoteDetailModal` test |
| WeChat/device validation | NOT APPLICABLE | Docs-only change; no mobile runtime behavior changed |

The local browser check used the actual rendered Docusaurus UI, including navigation and reload, rather than treating HTTP 200 as acceptance. CSS, frontmatter IDs/slugs and existing static assets were reviewed and preserved.

## Scope and risks

No API, database schema, Admin business, Taro page, UI design, Core package, or TipTap implementation was changed. A few active README/module guide links were updated because their source document moved; historical code blocks and old path strings in archived records remain intentionally as historical snapshots.

The only remaining external verification is a fresh GitHub Actions run after the branch is pushed by an authorized human. Production deployment and domain/resource checks also remain manual by policy. The Docs boundary checker does not claim to statically resolve arbitrary MDX or computed imports.

## Git result

- Branch: `tmp/api-admin-v2-integration`
- Starting HEAD: `b260a1a docs(architecture): finalize V2 hardening acceptance`
- Local commits: `9b4872c` (Docs application), `8e826e3` (content/governance separation), `d7f8833` (boundary checks)
- PR: none created; no push performed
- Working tree: expected clean after the local commits; generated `build`, `.docusaurus`, logs and temporary consumer directories are ignored
