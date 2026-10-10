# Docs Ownership Migration Report

状态：**PASS WITH RESTRICTIONS**

本次收口把文档内容按所有权拆分为 Demo 产品文档、平台开发者文档和根工程治理文档，并将共享文档能力归入 Core。没有修改 API、Admin、App、数据库或 UI 业务行为。

## 目录变化

迁移前的单一站点 `apps/docs` 已拆分为：

```text
apps/demo/docs/       @yishan/demo-docs，Demo 产品使用手册
apps/portal/docs/     @yishan/portal-docs，平台 API/SDK/模块开发文档
packages/core/docs-kit/  @yishan/docs-kit，无业务内容的共享 Docusaurus 能力
docs/                 架构、ADR、工程规范和历史验证记录
```

Demo 保留快速开始、系统模块、FAQ 和产品配置说明；API、前端接入、模块/插件开发与部署内容迁移到 Portal Docs。尚未创建 CRM 产品，因此 CRM 规格保留在 `docs/engineering/history/crm-product-specs/`，不会伪装成 Demo 或 Portal 的已发布内容。旧 `apps/docs` 不再作为 Workspace 工程存在；边界测试仍兼容历史临时 fixture。

## Core docs-kit

`@yishan/docs-kit` 位于 `packages/core/docs-kit`，保持 Source-First、private Workspace Package，不保存 Markdown 或产品文案。公开能力为：

- `createDocsConfig` 和 `DocsConfigOptions`；
- `FeatureGrid` 和 `FeatureGridItem`；
- `./theme/custom.css`。

两个站点各自拥有 content、sidebar、页面、静态资源、站点 URL 和发布配置，仅通过公开 exports 消费 docs-kit。docs-kit 不依赖任何 `apps/*`，产品 Docs 之间也不能互相导入。

## 工程调整

- Workspace 保持 `apps/*`、`apps/*/*`、`packages/*`、`packages/*/*` 扫描，并排除各 Docs 应用的内容、页面、组件、配置和资源子目录。
- `check-app-boundaries.mjs` 将 `apps/<product>/docs` 视为 Docs 应用，允许公开共享包导入，拒绝跨产品 Docs、共享包反向依赖产品和其他 Workspace 包反向依赖 Docs；同时保留历史 `apps/docs` fixture 识别能力。
- Fullstack CI 的 Docs path filter 改为 `apps/*/docs/**`、`packages/core/docs-kit/**`，独立执行 docs-kit、Demo Docs、Portal Docs 类型检查和双站点构建。
- `pnpm-lock.yaml` 从任务起点基线恢复，只增加三个新 importer，未重新解析或升级第三方依赖。
- README、AGENTS、CLAUDE、工程指南和架构文档已改为当前 ownership 路径。`docs-productization-report.md` 是上一次迁移的历史报告，保留其当时的 `apps/docs` 术语，不代表当前结构。

## 验证

| Check | Result | Evidence |
| --- | --- | --- |
| Frozen install | PASS | `pnpm install --frozen-lockfile` |
| docs-kit typecheck | PASS | `pnpm --filter @yishan/docs-kit typecheck` |
| Demo Docs typecheck | PASS | `pnpm --filter @yishan/demo-docs typecheck` |
| Portal Docs typecheck | PASS | `pnpm --filter @yishan/portal-docs typecheck` |
| Demo Docs build | PASS | `pnpm --filter @yishan/demo-docs build` |
| Portal Docs build | PASS | `pnpm --filter @yishan/portal-docs build` |
| Ownership tests | PASS | `node --test scripts/test/docs-ownership.test.mjs`，4 passed |
| Script and boundary tests | PASS | `pnpm test:scripts`，120 passed；`pnpm check:boundaries` 通过 |

生产静态构建已经在本地生成并通过 Docusaurus broken-link 检查。没有执行远端 GitHub Actions、真实站点发布、CRM/Axis Docs 构建或生产环境操作；这些属于后续外部验收。

## 扩展判断与限制

新增 `apps/crm/docs`、`apps/axis/docs` 时可以直接消费 `@yishan/docs-kit`，各自维护内容和站点配置，无需改动 Core。当前未创建空的 CRM/Axis Docs 应用，也未验证它们的业务文档内容。Docs 应用的浏览器交互和部署域名仍需在实际发布环境中人工验收。

本报告记录本次 ownership 重构，不代表旧历史迁移报告中的单站点路径仍然有效。
