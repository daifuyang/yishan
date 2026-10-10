# Yishan 工程架构入口

apps/ 拥有独立产品；packages/ 提供公共能力；docs/ 保存架构、ADR 和工程治理。Demo 的 API/Admin/App/config 对称装配，Docs 是独立静态文档产品，不创建无业务的 CRM/Axis 空项目。

- [API V2](api-v2.md)、[公共模块契约](module-contract.md)、[数据库所有权](database-ownership.md)。
- [Package 边界](package-boundaries.md)：Core、System、Product 依赖方向。
- [文档体系](documentation-system.md)：站点内容与工程资产的唯一所有者。
- [ADR](../adr/README.md)、[工程指南](../engineering/development.md)、[贡献](../contributing.md)。

Demo 产品使用在 [apps/demo/docs/content](../../apps/demo/docs/content)，平台开发接入在 [apps/portal/docs/content](../../apps/portal/docs/content)，实例请求/认证契约在 [Core App README](../../packages/core/app/README.md)。本入口只指向权威说明，不再维护另一份完整架构正文。
