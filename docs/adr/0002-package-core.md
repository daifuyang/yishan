# ADR 0002：Core 与 System 所有权

状态：Accepted；2026-10-10 追溯记录。

背景：多个产品需要复用同一套平台和默认系统能力，同时保持身份、配置和业务的独立性。

决策：contracts/database/api 与 system-api 分工明确；Admin 与 System Admin 沿用 Umi 官方扩展和公开源码贡献；Core App 使用注入式工厂，公共 UI 与独立 TipTap 保持各自职责。Core 不读取产品配置、不反向导入 apps。

后果：跨包只能导入 exports，业务留在产品，System 安全规则不由产品扩展替换。不得为文档站建立 packages/core/docs 或第二套文档实现。

权威契约：[包边界](../architecture/package-boundaries.md)、[数据库所有权](../architecture/database-ownership.md)、[工程收口证据](../architecture/v2-engineering-hardening-report.md)。
