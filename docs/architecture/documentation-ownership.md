# Yishan Documentation Ownership

Yishan 的文档按所有权分为产品文档、平台开发文档和工程治理文档。每一类只有一个正文所有者，站点之间通过 URL 或贡献指南引用，不复制正文。

```text
Product Docs       → apps/{product}/docs
Platform Docs      → apps/portal/docs
Engineering Docs   → docs/
Shared capability  → packages/core/docs-kit
```

## Product Docs

`apps/demo/docs` 负责 Demo 的快速开始、产品介绍、功能模块、FAQ 和产品配置说明。未来 CRM 或 Axis 产品建立后，各自创建 `apps/crm/docs`、`apps/axis/docs`，只拥有对应产品的用户文档。没有对应产品应用时，不创建空 Docs 应用；CRM 的现有规格暂存于 `docs/engineering/history/crm-product-specs/`，不发布。

产品 Docs 可以依赖 `@yishan/docs-kit`、公开 UI 和其他公开共享 Package exports。它们不能依赖另一个产品的 API、Admin、App 或 Docs，也不能把产品内容写入共享 Package。

## Platform Docs

`apps/portal/docs` 是平台开发者中心，负责 API、OpenAPI/SDK 接入、前端集成、模块与插件开发、部署运维和平台架构说明。它描述如何使用和扩展 Yishan 平台，不承担 Demo、CRM 或 Axis 的产品功能手册。

## Engineering Docs

根 `docs/` 只保存工程治理资产：架构、ADR、开发/测试/发布规范、贡献指南、迁移报告和历史验证记录。它不会被 Docusaurus 扫描，也不承载用户手册或产品功能介绍。

## docs-kit

`packages/core/docs-kit` 是 Core 下无业务内容的 Source-First Workspace Package，包名仍为 `@yishan/docs-kit`。它提供 `createDocsConfig`、共享主题 CSS 和无产品文案的 `FeatureGrid`。它不依赖任何 `apps/*`，也不存储 Markdown。Docs 应用保留自己的内容、侧栏、站点 URL、页面入口、静态资源和发布配置；未来新增产品 Docs 只需消费 docs-kit 并提供自己的内容。

## Build and validation

```bash
pnpm --filter @yishan/docs-kit typecheck
pnpm --filter @yishan/demo-docs typecheck
pnpm --filter @yishan/demo-docs build
pnpm --filter @yishan/portal-docs typecheck
pnpm --filter @yishan/portal-docs build
pnpm check:boundaries
```

Workspace 显式排除各 Docs 应用的 content、页面、组件、配置和 public 子目录；只有包含 package.json 的应用根目录进入依赖图。边界检查禁止 docs-kit 反向依赖产品，也禁止一个产品 Docs 依赖另一个产品 Docs。
