# 测试策略

先验证最窄改动，再根据影响范围扩大。根 [README 命令矩阵](../../README.md) 是脚本覆盖的事实来源；禁止删断言、跳过失败或降低类型强度制造 PASS。

Docs 必须执行独立 pnpm --filter @yishan/docs-kit typecheck 与 @yishan/demo-docs、@yishan/portal-docs 的 typecheck/build，再实际启动检查首页、侧栏、内容页、直接 URL、刷新和资源。修改工程脚本/边界时运行 pnpm test:scripts 与 pnpm check:boundaries；本轮产品与 Workspace 迁移按用户要求执行根 typecheck/lint/test/build。

检查器的负面 fixture 必须证明违规会失败，合法公开导入会通过。浏览器页面可访问不能仅用 HTTP200 代替，需核对渲染与交互。生产构建和设备/外部 CI 验收分别标记。

数据库集成只运行隔离命令，历史 CRM 限制见 [数据库所有权](../architecture/database-ownership.md)。未执行、历史 skip、失败与外部阻断分别报告，不把本地成功冒充 Linux CI 或微信真机成功。
