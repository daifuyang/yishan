# ADR 0001：Product-First Apps

状态：Accepted；2026-10-10 追溯记录既有 V2，不代表本轮重新实施。

背景：产品需要独立入口、配置、安装清单和部署生命周期，公共能力不能依赖某个产品。

决策：Demo 在 apps/demo/{api,admin,app,docs,config} 组合能力；平台开发文档在 apps/portal/docs 独立运行。apps 表示产品，packages 表示能力，根 docs 表示工程治理。只创建实际产品，不创建空 CRM/Axis。

后果：产品不能导入另一个产品的私有或公共应用运行时；新产品组合公开 exports 并注入自己的配置。原目录兼容性已经在前期迁移处理，本轮冻结 API/Admin/App 定位。

证据：[API](../architecture/api-migration-report.md)、[Admin](../architecture/admin-v2-migration-report.md)、[App](../architecture/mobile-architecture-migration-report.md)、[文档体系](../architecture/documentation-system.md)。
