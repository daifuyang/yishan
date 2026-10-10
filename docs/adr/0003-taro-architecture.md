# ADR 0003：独立 Taro 产品与 Source-First Core App

状态：Accepted；2026-10-10 追溯记录，未升级 Taro/React。

背景：不同移动产品需要独立业务和平台入口，但不应复制请求、认证和公共移动 UI。

决策：完整产品位于 apps/<product>/app，共享能力使用私有 Source-First @yishan/core-app 与 @yishan/ui/mobile，沿用官方 compile.include。每个产品创建独立 client/store、Storage key、API base URL 和导航回调。

后果：保持 packages/core/app 定位，不创建另一个 mobile-core 包。WeApp/H5 构建与设备验收分别报告；实例工厂不改变为产品全局单例。

契约与证据：[Core App](../../packages/core/app/README.md)、[迁移报告](../architecture/mobile-architecture-migration-report.md)、[最终工程验证](../architecture/v2-engineering-hardening-report.md)。
