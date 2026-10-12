# 发布与 CI 治理

产品的使用者部署指南在 [产品部署](../../apps/portal/docs/content/deploy/prod.md)；本页只定义工程发布约束，不重复维护部署命令。

Fullstack CI 检查 Workspace、类型、lint、测试、产物和边界。Docs 的 apps/*/docs/** 与 packages/core/docs-kit/** 与根 docs/** 变更触发验证，独立 @yishan/demo-docs、@yishan/portal-docs 与 @yishan/docs-kit 的检查不部署产品。其他 API/Admin/App 的既有验证保留。

发布、真实数据写入和不可恢复清理需要已有明确授权。推送、合并、站点上传、FC、生产迁移和 npm 发布分别按目标核实；本地 build/pack 不是上线。禁止强推、覆盖用户改动、提交 .env、密钥、node_modules 或发布产物。

Docs 发布的是 apps/demo/docs/build 的静态文件；保持现有域名、baseUrl 与公开路由。发布前核对部署目标和深链策略，不把工程审计/历史证据一起编译进网站。独立生命周期见 [Docs README](../../apps/demo/docs/README.md)。
