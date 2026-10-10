# 开发与贡献

先按 [贡献指南](../contributing.md) 选择正确基线并核对 Git 状态，保护用户资料与其他 Worktree。工具链由 .tool-versions/packageManager 固定；产品启动和环境准备的单一指南在 [快速开始](../../apps/docs/content/quick-start/environment.md)，根命令覆盖范围见 [README](../../README.md)。

修改前读取目标实现、契约和测试。业务不跨产品导入，跨包通过公开 exports；架构与实例规则见 [包边界](../architecture/package-boundaries.md)。核心实现已稳定，普通功能优先就近组织，不重复拆包或创建空应用。

文档产品运行 pnpm dev:docs，内容维护与静态发布见 [Docs README](../../apps/docs/README.md)。源码文档修正无需数据库；需要数据验证时只使用明确的隔离资源，不能用生产或用户开发库做实验。
