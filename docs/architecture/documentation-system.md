# Documentation system

文档所有权的唯一规范见 [documentation-ownership.md](documentation-ownership.md)。本页只说明构建关系：

```text
apps/demo/docs    → @yishan/docs-kit → Demo 文档静态站
apps/portal/docs  → @yishan/docs-kit → 平台开发者文档静态站
docs/             → 工程治理资产，不参与站点构建
```

两个 Docs 应用使用现有 Docusaurus 3、React 19 和各自的 `content/`、侧栏、页面与发布配置。共享配置工厂、主题 CSS 和无业务 FeatureGrid 位于 `packages/core/docs-kit`；docs-kit 不保存内容，也不依赖产品代码。CRM 规格在 CRM 产品 Docs 建立前保留为 `docs/engineering/history/crm-product-specs/` 的未发布工程记录。

边界检查支持 Docs 应用的公开 Package exports、`@site/` 本地别名以及字面量 TypeScript/JavaScript/CSS 导入，并拒绝产品间和共享包反向依赖。它不解析 MDX 内嵌的计算式 import；内容改动仍需独立构建和人工审查。
