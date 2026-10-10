# 文档产品与工程治理

Yishan 的应用是产品、Package 是能力、根 docs/ 是工程治理。文档站本身是独立产品 apps/docs（@yishan/docs），使用已有 Docusaurus，而不是 Core/UI 的能力包。

~~~text
Product Docs → apps/docs/content → Docusaurus → apps/docs/build
Engineering Docs → docs/{architecture,adr,engineering} 与 contributing.md
~~~

## 唯一所有者

| 内容 | 权威位置 | 发布方式 |
| --- | --- | --- |
| 快速开始、API 使用、模块接入、部署指南、产品规格 | apps/docs/content | 现有 Docs 站点 |
| 文档页面、SEO、导航、主题及组件 | apps/docs/{app,components,config,public} | Docusaurus 官方生命周期 |
| 架构约束、包边界、数据库所有权、迁移报告 | docs/architecture | 仓库工程文档 |
| 决策原因与后果 | docs/adr | 仓库 ADR |
| 开发、测试、编码、发布、文档规范 | docs/engineering | 仓库工程文档 |
| 历史设计、实施计划、验收、审计和截图 | docs/engineering/{history,archive,verification} | 工程记录，不编译进站点 |
| Contributor Guide | docs/contributing.md | 根 CONTRIBUTING.md 保留 GitHub 入口链接 |
| 包的本地使用契约 | 对应 Package README | 源码旁说明；不复制整篇产品指南 |

业务模块接入的正文从原 docs/module-onboarding.md 移至 apps/docs/content/modules/onboarding.md。CRM 说明从 docs/products/crm 移至 apps/docs/content/products/crm；保留规划/历史标记，Demo 默认安装清单不变。原网站文档治理与列表规范正文分别归 engineering/documentation.md、coding-style.md，原站点 URL 只链接到治理来源。

## 运行边界

Docs 不导入其他产品私有源码，其他产品和共享包不导入 Docs。网站可以消费公开 Package exports，不通过相对路径绕过边界。文档中的源码示例与 URL 引用不是应用运行时依赖。apps/docs/content、app、components、config、public 在 Workspace 中显式排除，只有顶层 package.json 是文档应用。

Docusaurus 使用 docs.path=content、pages.path=app/pages、staticDirectories=[public]、customCss 和 sidebarPath 指向本产品目录；CLI --config 指向 config/docusaurus.config.ts。保持原站点 /docs/...、/img/...、域名与主题；没有第二套内容生成/同步系统。

## 维护与验证

维护方法见 [Docs README](../../apps/docs/README.md)、[文档规范](../engineering/documentation.md)及[贡献指南](../contributing.md)。工程规则被产品指南引用，禁止复制两套权威正文。安装/独立 typecheck/build、根回归与浏览器检查结果记录在 [Docs 迁移报告](docs-productization-report.md)。

check-app-boundaries 保留移动端规则，新增 Docs 双向产品隔离和公开导入检查。支持 TS/JS/CSS 的字面量导入和官方 @site 别名；不解析 MDX 内嵌 import、计算式参数或任意自定义 alias。MDX 功能变更需要人工源码审查及真实构建，不能宣称静态检查覆盖全部动态代码。
