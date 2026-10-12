# @yishan/portal-docs

移山平台开发者文档产品，负责 API、前端接入、模块/插件开发和部署运维说明。产品使用手册由对应的 apps/{product}/docs 拥有；本应用不保存 Demo、CRM 或 Axis 产品内容。

```bash
pnpm --filter @yishan/portal-docs typecheck
pnpm --filter @yishan/portal-docs build
pnpm --filter @yishan/portal-docs start
```

内容位于 content/，页面和侧栏由本应用维护，共享配置、主题和无业务组件来自 @yishan/docs-kit。部署时通过 DOCS_SITE_URL 和 DOCS_BASE_URL 注入平台文档站点地址。
