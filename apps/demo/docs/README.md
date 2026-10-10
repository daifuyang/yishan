# @yishan/demo-docs

Demo 产品文档，沿用 Docusaurus 3.9.2、React 19、现有主题和 /docs/... URL。生产域名 https://docs.zerocmf.com 和 baseUrl / 保持原值；平台 API、模块开发和部署指南归属 apps/portal/docs。

## 运行与构建

```bash
pnpm install --frozen-lockfile
pnpm --filter @yishan/demo-docs start
pnpm --filter @yishan/demo-docs typecheck
pnpm --filter @yishan/demo-docs build
pnpm --filter @yishan/demo-docs serve --host 127.0.0.1 --port 4000 --no-open
```

根 pnpm build:docs 同时构建 Demo 与 Portal 文档，Demo 产物位于 apps/demo/docs/build/。内容位于 content/，页面和侧栏由本产品维护，共享配置、主题和无业务组件来自 @yishan/docs-kit。

## 内容边界

content/ 只保存 Demo 的快速开始、功能模块和 FAQ。产品团队拥有这些文档；API、前端接入、模块开发和部署说明由 apps/portal/docs 拥有。CRM 规格尚未进入 CRM 产品 Docs，在 CRM 产品应用建立前只作为 docs/engineering/history/crm-product-specs/ 的工程历史记录保存。

根 docs/ 的 ADR、治理规范、计划、数据库审计和验收截图不进入站点。产品源码 import 只使用公开 Package exports 或本地 @site 路径，产品之间不能互相导入。

## 发布

先执行独立 typecheck/build 与 pnpm check:boundaries，再通过 serve 检查首页、侧栏、内容页、直接 URL、刷新和资源。经明确发布授权后，把 build/ 内容作为 Demo 文档站静态产物部署；源码无需 API 服务，也不导入后端运行时代码。

文档所有权与贡献规则见 [documentation-ownership.md](../../../../docs/architecture/documentation-ownership.md) 和 [contributing.md](../../../../docs/contributing.md)。
